// Login do filiado no app da carteira: CPF + código de 6 dígitos no WhatsApp.
//
// POST { action: "start",  cpf }        -> envia o código, devolve o telefone mascarado
// POST { action: "verify", cpf, code }  -> confere e devolve a sessão do Supabase
//
// Pública (verify_jwt = false em config.toml): quem chama ainda não tem login.
// Usa a service role, então TODA regra de acesso precisa estar aqui.
//
// Secrets (supabase secrets set):
//   CARTEIRA_N8N_WEBHOOK_URL   webhook do n8n que envia o WhatsApp
//   CARTEIRA_N8N_SECRET        valor do header x-carteira-secret do webhook
//   CARTEIRA_ALLOWED_ORIGINS   origens do app separadas por vírgula (opcional)
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import {
  clientIp,
  CODE_TTL_MINUTES,
  generateCode,
  hashCode,
  isValidCPF,
  maskPhone,
  MAX_CODES_PER_MEMBER,
  MAX_STARTS_PER_IP,
  MAX_VERIFIES_PER_IP,
  MAX_VERIFY_ATTEMPTS,
  onlyDigits,
  RESEND_COOLDOWN_SECONDS,
  safeEqual,
  technicalEmail,
  toWhatsappNumber,
} from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const N8N_URL = Deno.env.get("CARTEIRA_N8N_WEBHOOK_URL") ?? "";
const N8N_SECRET = Deno.env.get("CARTEIRA_N8N_SECRET") ?? "";
const ALLOWED_ORIGINS = (
  Deno.env.get("CARTEIRA_ALLOWED_ORIGINS") ??
  "https://carteira.armascon.com.br,http://localhost:5173,http://localhost:8080"
).split(",").map((o) => o.trim());

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function cors(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

const since = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

async function countEvents(kind: "start" | "verify", column: "ip" | "cpf", value: string, seconds: number) {
  const { count, error } = await admin
    .from("member_login_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq(column, value)
    .gte("created_at", since(seconds));
  if (error) throw error;
  return count ?? 0;
}

async function logEvent(kind: "start" | "verify", cpf: string, ip: string, success: boolean) {
  await admin.from("member_login_events").insert({ kind, cpf, ip, success });
}

async function findMember(cpf: string) {
  const { data, error } = await admin
    .from("members")
    .select("id, member_number, full_name, phone, auth_user_id")
    .eq("cpf", cpf)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------

async function start(cpf: string, ip: string) {
  if (await countEvents("start", "ip", ip, 3600) >= MAX_STARTS_PER_IP) {
    throw new HttpError(429, "rate_limited", "Muitas tentativas. Tente de novo mais tarde.");
  }
  await logEvent("start", cpf, ip, false);

  const member = await findMember(cpf);
  if (!member) {
    throw new HttpError(404, "not_found", "CPF não encontrado entre os filiados. Fale com a Conarmas.");
  }
  if (!member.phone) {
    throw new HttpError(409, "no_phone", "Não há WhatsApp cadastrado para este CPF. Fale com a Conarmas para atualizar.");
  }

  const { data: recent, error: recentError } = await admin
    .from("member_login_codes")
    .select("created_at")
    .eq("member_id", member.id)
    .gte("created_at", since(15 * 60))
    .order("created_at", { ascending: false });
  if (recentError) throw recentError;

  if (recent.length > 0) {
    const elapsed = (Date.now() - new Date(recent[0].created_at).getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      const retryAfter = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
      throw new HttpError(429, "cooldown", `Aguarde ${retryAfter} segundos para pedir outro código.`, { retry_after: retryAfter });
    }
  }
  if (recent.length >= MAX_CODES_PER_MEMBER) {
    throw new HttpError(429, "too_many_codes", "Muitos códigos pedidos. Aguarde 15 minutos e tente de novo.");
  }

  const code = generateCode(() => crypto.getRandomValues(new Uint32Array(1))[0]);
  const now = new Date();

  // Só o código mais recente vale
  await admin
    .from("member_login_codes")
    .update({ expires_at: now.toISOString() })
    .eq("member_id", member.id)
    .is("used_at", null)
    .gt("expires_at", now.toISOString());

  const { data: saved, error: insertError } = await admin
    .from("member_login_codes")
    .insert({
      member_id: member.id,
      code_hash: await hashCode(member.id, code),
      expires_at: new Date(now.getTime() + CODE_TTL_MINUTES * 60_000).toISOString(),
      ip,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  if (!N8N_URL || !N8N_SECRET) {
    await admin.from("member_login_codes").delete().eq("id", saved.id);
    console.error("CARTEIRA_N8N_WEBHOOK_URL / CARTEIRA_N8N_SECRET não configurados");
    throw new HttpError(503, "not_configured", "O envio de códigos ainda não está disponível.");
  }

  const sent = await fetch(N8N_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-carteira-secret": N8N_SECRET },
    // Só número e código: o texto é montado no n8n, para o webhook não
    // servir para mandar mensagens arbitrárias se o segredo vazar
    body: JSON.stringify({
      number: toWhatsappNumber(member.phone),
      code,
      minutes: CODE_TTL_MINUTES,
    }),
  }).catch((e) => {
    console.error("Falha ao chamar o n8n:", e);
    return null;
  });

  if (!sent || !sent.ok) {
    await admin.from("member_login_codes").delete().eq("id", saved.id);
    console.error("n8n respondeu", sent?.status, await sent?.text().catch(() => ""));
    throw new HttpError(502, "send_failed", "Não foi possível enviar o código agora. Tente de novo em instantes.");
  }

  await logEvent("start", cpf, ip, true);
  // Limpeza ocasional de códigos e eventos antigos
  if (Math.random() < 0.05) await admin.rpc("purge_member_login_data");

  return { phone_masked: maskPhone(member.phone), expires_in: CODE_TTL_MINUTES * 60 };
}

// ---------------------------------------------------------------------

/** Usuário do Auth do filiado: o já ligado, ou um novo criado agora */
async function ensureAuthUser(member: { id: string; full_name: string; auth_user_id: string | null }) {
  if (member.auth_user_id) {
    const { data } = await admin.auth.admin.getUserById(member.auth_user_id);
    if (data?.user?.email) return data.user;
  }

  const email = technicalEmail(member.id);
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: member.full_name },
    app_metadata: { member_id: member.id },
  });

  let user = created.data.user;
  if (!user) {
    // Já existe (ligação perdida): o generateLink devolve o usuário existente
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error || !link.data.user) throw created.error ?? link.error;
    user = link.data.user;
  }

  const { error } = await admin.from("members").update({ auth_user_id: user.id }).eq("id", member.id);
  if (error) throw error;
  return user;
}

async function verify(cpf: string, code: string, ip: string) {
  if (await countEvents("verify", "ip", ip, 3600) >= MAX_VERIFIES_PER_IP) {
    throw new HttpError(429, "rate_limited", "Muitas tentativas. Tente de novo mais tarde.");
  }
  await logEvent("verify", cpf, ip, false);

  const invalid = new HttpError(400, "invalid_code", "Código inválido ou expirado. Peça um novo código.");
  const member = await findMember(cpf);
  if (!member) throw invalid;

  const { data: pending, error } = await admin
    .from("member_login_codes")
    .select("id, code_hash, attempts")
    .eq("member_id", member.id)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!pending) throw invalid;

  if (pending.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new HttpError(429, "too_many_attempts", "Muitas tentativas com este código. Peça um novo código.");
  }

  const ok = safeEqual(pending.code_hash, await hashCode(member.id, code));
  if (!ok) {
    const attempts = pending.attempts + 1;
    await admin.from("member_login_codes").update({ attempts }).eq("id", pending.id);
    const left = MAX_VERIFY_ATTEMPTS - attempts;
    throw new HttpError(
      400,
      "wrong_code",
      left > 0 ? `Código incorreto. Você ainda tem ${left} tentativa${left > 1 ? "s" : ""}.` : "Código incorreto. Peça um novo código.",
      { attempts_left: left },
    );
  }

  // Marca como usado antes de criar a sessão: o mesmo código não serve duas vezes
  const { data: consumed } = await admin
    .from("member_login_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", pending.id)
    .is("used_at", null)
    .select("id");
  if (!consumed?.length) throw invalid;

  const user = await ensureAuthUser(member);

  // Conta da equipe nunca entra por aqui: um código de WhatsApp não pode
  // virar sessão com acesso ao sistema de OS
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile && profile.role !== "MEMBER") {
    console.error("Filiado ligado a conta da equipe:", member.id);
    throw new HttpError(403, "staff_account", "Esta conta não pode entrar pelo app da carteira. Fale com a Conarmas.");
  }

  // Gera e consome um link mágico aqui mesmo: o token nunca sai do servidor
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email! });
  if (link.error) throw link.error;
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: otpError } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.data.properties.hashed_token,
  });
  if (otpError || !auth.session) throw otpError ?? new Error("Sessão não criada");

  await logEvent("verify", cpf, ip, true);

  return {
    access_token: auth.session.access_token,
    refresh_token: auth.session.refresh_token,
    expires_at: auth.session.expires_at,
  };
}

// ---------------------------------------------------------------------

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const cpf = onlyDigits(body.cpf);
    const ip = clientIp(req.headers.get("x-forwarded-for"));

    if (!isValidCPF(cpf)) throw new HttpError(400, "invalid_cpf", "CPF inválido.");

    let result: unknown;
    if (body.action === "start") {
      result = await start(cpf, ip);
    } else if (body.action === "verify") {
      const code = onlyDigits(body.code);
      if (code.length !== 6) throw new HttpError(400, "invalid_code", "O código tem 6 dígitos.");
      result = await verify(cpf, code, ip);
    } else {
      throw new HttpError(400, "invalid_action", "Ação inválida.");
    }
    return new Response(JSON.stringify(result), { headers });
  } catch (e) {
    if (e instanceof HttpError) {
      return new Response(JSON.stringify({ error: e.code, message: e.message, ...e.extra }), { status: e.status, headers });
    }
    console.error("Erro inesperado:", e);
    return new Response(
      JSON.stringify({ error: "internal", message: "Erro inesperado. Tente de novo em instantes." }),
      { status: 500, headers },
    );
  }
});
