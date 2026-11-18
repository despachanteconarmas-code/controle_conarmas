// Avisos de vencimento do dia, para o n8n enviar pelo WhatsApp.
//
// POST { dry_run?: boolean }  com header x-carteira-secret
//   -> { count, messages: [{ number, text, member_number }] }
//
// Chamada só pelo workflow "Carteira -> Avisos de vencimento" do n8n.
// dry_run = true mostra quem seria avisado sem marcar nada como enviado.
// Cada item é marcado como avisado ao ser devolvido (no máximo um aviso
// por faixa de 30/15/7/0 dias), então o n8n deve enviar tudo que receber.
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { reminderText, safeEqual, toWhatsappNumber, ReminderItem } from "./format.ts";

const SECRET = Deno.env.get("CARTEIRA_N8N_SECRET") ?? "";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const given = req.headers.get("x-carteira-secret") ?? "";
  if (!SECRET || !safeEqual(given, SECRET)) return json({ error: "forbidden" }, 403);

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const { data, error } = await admin.rpc("claim_expiry_reminders", { p_dry_run: dryRun });
    if (error) throw error;

    const messages = (data ?? []).map((row: { member_number: number; full_name: string; phone: string; items: ReminderItem[] }) => ({
      member_number: row.member_number,
      number: toWhatsappNumber(row.phone),
      text: reminderText(row.full_name, row.items),
    }));
    return json({ dry_run: dryRun, count: messages.length, messages });
  } catch (e) {
    console.error("member-reminders:", e);
    return json({ error: "internal" }, 500);
  }
});
