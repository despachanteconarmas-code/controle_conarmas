// Abre o painel de filiação da carteira já logado, a partir do sistema de OS.
//
// POST com o login da equipe (Authorization: Bearer <sessão do OS>)
//   -> { token_hash } de uso único, que a carteira troca por uma sessão
//      própria (verifyOtp). A carteira ganha uma sessão independente: se
//      reaproveitasse o refresh token do OS, uma aba derrubaria a outra.
//
// Só a equipe (profiles.role STAFF/ADMIN) recebe o acesso.
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const headers = {
  "Access-Control-Allow-Origin": "https://controle.armascon.com.br",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth, error } = await admin.auth.getUser(token);
  if (error || !auth?.user?.email) return json({ error: "unauthorized" }, 401);

  const { data: profile } = await admin.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (!profile || !["STAFF", "ADMIN"].includes(profile.role)) return json({ error: "forbidden" }, 403);

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: auth.user.email });
  if (link.error) {
    console.error("painel-sso:", link.error);
    return json({ error: "internal" }, 500);
  }
  return json({ token_hash: link.data.properties.hashed_token });
});
