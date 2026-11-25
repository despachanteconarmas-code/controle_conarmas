// TEMPORÁRIA (só durante a migração): gera o link de upload do pacote para o
// workflow "Exportar Supabase gerenciado", sem ninguém copiar e colar link.
//
// POST com header x-carteira-secret (o mesmo CARTEIRA_N8N_SECRET do GitHub e
// do .env da VPS) -> { url } de upload assinado, de uso único, no bucket
// privado "migracao". Fica fora de supabase/functions de propósito: é copiada
// à mão para a VPS e apagada depois da troca.
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const SECRET = Deno.env.get("CARTEIRA_N8N_SECRET") ?? "";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SECRET || !safeEqual(req.headers.get("x-carteira-secret") ?? "", SECRET)) return json({ error: "forbidden" }, 403);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const { data, error } = await admin.storage.from("migracao").createSignedUploadUrl(`pacote-${stamp}.tar`);
  if (error || !data) {
    console.error("migracao-link:", error);
    return json({ error: "internal" }, 500);
  }
  return json({ url: data.signedUrl, path: data.path });
});
