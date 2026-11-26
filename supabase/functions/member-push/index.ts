// Notificações de vencimento no celular (Web Push), para quem ativou os
// avisos no app da carteira.
//
// 1) Rotina diária (cron da VPS), header x-carteira-secret:
//      POST {}                        -> envia os avisos do dia e os marca
//      POST { dry_run: true }         -> mostra quem receberia, sem enviar
//      POST { test_member_number: N } -> notificação de teste para o filiado N
// 2) Filiado logado (Authorization: Bearer <sessão do app>):
//      POST { action: "test" }        -> teste nos aparelhos dele, logo
//                                        depois de ativar os avisos
//
// Inscrição que o navegador diz não existir mais (404/410) é apagada.
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import webpush from "npm:web-push@3.6.7";
import { PushPayload, ReminderItem, reminderPayload, safeEqual, testPayload } from "./format.ts";

const SECRET = Deno.env.get("CARTEIRA_N8N_SECRET") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "https://carteira.armascon.com.br";
const ALLOWED_ORIGINS = (
  Deno.env.get("CARTEIRA_ALLOWED_ORIGINS") ??
  "https://carteira.armascon.com.br,http://localhost:5173,http://localhost:8080"
).split(",").map((o) => o.trim());

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Subscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failures: number;
}

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});

/** Envia para todos os aparelhos do filiado. Devolve quantos receberam. */
async function sendToMember(memberId: string, payload: PushPayload) {
  const { data: subs, error } = await admin
    .from("member_push_subscriptions")
    .select("id, endpoint, p256dh, auth, failures")
    .eq("member_id", memberId);
  if (error) throw error;

  const result = { sent: 0, removed: 0, failed: 0 };
  for (const sub of (subs ?? []) as Subscription[]) {
    try {
      const details = webpush.generateRequestDetails(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        {
          vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY },
          TTL: 60 * 60 * 24, // fora do ar por até 1 dia: entrega quando voltar
          urgency: "normal",
        },
      );
      const res = await fetch(details.endpoint, { method: details.method, headers: details.headers, body: details.body });
      await res.body?.cancel();

      if (res.ok) {
        result.sent++;
        await admin.from("member_push_subscriptions").update({ last_sent_at: new Date().toISOString(), failures: 0 }).eq("id", sub.id);
      } else if (res.status === 404 || res.status === 410) {
        // Desinstalou o app ou revogou a permissão
        result.removed++;
        await admin.from("member_push_subscriptions").delete().eq("id", sub.id);
      } else {
        result.failed++;
        console.error("member-push: envio recusado", res.status, new URL(sub.endpoint).host);
        await admin.from("member_push_subscriptions").update({ failures: sub.failures + 1 }).eq("id", sub.id);
      }
    } catch (e) {
      result.failed++;
      console.error("member-push: erro ao enviar", e);
    }
  }
  return result;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return json({ error: "push_not_configured" }, 503);

  const body = await req.json().catch(() => ({}));
  const secret = req.headers.get("x-carteira-secret");

  try {
    // ---------- Filiado logado: teste nos próprios aparelhos ----------
    if (secret === null) {
      if (body?.action !== "test") return json({ error: "bad_request" }, 400);
      const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: auth, error } = await admin.auth.getUser(token);
      if (error || !auth?.user) return json({ error: "unauthorized" }, 401);
      const { data: member } = await admin.from("members").select("id").eq("auth_user_id", auth.user.id).maybeSingle();
      if (!member) return json({ error: "forbidden" }, 403);
      return json(await sendToMember(member.id, testPayload()));
    }

    // ---------- Rotina diária (VPS) ----------
    if (!SECRET || !safeEqual(secret, SECRET)) return json({ error: "forbidden" }, 403);

    if (Number.isInteger(body?.test_member_number)) {
      const { data: member } = await admin.from("members").select("id").eq("member_number", body.test_member_number).maybeSingle();
      if (!member) return json({ error: "member_not_found" }, 404);
      return json(await sendToMember(member.id, testPayload()));
    }

    const dryRun = body?.dry_run === true;
    const { data, error } = await admin.rpc("claim_expiry_reminders", { p_dry_run: dryRun, p_channel: "push" });
    if (error) throw error;
    const rows = (data ?? []) as { member_id: string; member_number: number; items: ReminderItem[] }[];

    if (dryRun) {
      return json({ dry_run: true, count: rows.length, members: rows.map((r) => ({ member_number: r.member_number, ...reminderPayload(r.items) })) });
    }

    const total = { members: rows.length, sent: 0, removed: 0, failed: 0 };
    for (const row of rows) {
      const r = await sendToMember(row.member_id, reminderPayload(row.items));
      total.sent += r.sent;
      total.removed += r.removed;
      total.failed += r.failed;
    }
    console.log("member-push:", JSON.stringify(total));
    return json(total);
  } catch (e) {
    console.error("member-push:", e);
    return json({ error: "internal" }, 500);
  }
});
