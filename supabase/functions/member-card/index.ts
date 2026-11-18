// Página pública do QR da carteirinha: GET ?token=<verify_token>
//
// Devolve os dados de conferência do filiado em tempo real. NÃO devolve
// CPF, telefone, e-mail, endereço nem o destino das GTs (que pode ser a
// casa do filiado). O token tem 128 bits e é regenerável pela equipe.
//
// Pública (verify_jwt = false em config.toml).
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
  // Dados pessoais: nada de cache em proxy nem indexação
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[0-9a-f]{32}$/.test(token)) return json({ error: "not_found" }, 404);

  try {
    const { data: member, error } = await admin
      .from("members")
      .select("id, member_number, full_name, membership_expires_at, cr_number, cr_expires_at, photo_path")
      .eq("verify_token", token)
      .maybeSingle();
    if (error) throw error;
    if (!member) return json({ error: "not_found" }, 404);

    const [{ data: firearms, error: fErr }, { data: options, error: oErr }, { data: settings }] = await Promise.all([
      admin
        .from("member_firearms")
        .select("id, type, brand, model, sigma_number, caliber, restriction, sigma_expires_at, position, traffic_guides(expires_at, issued_at)")
        .eq("member_id", member.id)
        .order("position")
        .order("created_at"),
      admin.from("option_lists").select("category, value, label").in("category", ["firearm_type", "brand", "caliber"]),
      admin.from("card_settings").select("club_name, club_cr").eq("id", 1).maybeSingle(),
    ]);
    if (fErr) throw fErr;
    if (oErr) throw oErr;

    const label = (category: string, value: string | null) =>
      value ? options?.find((o) => o.category === category && o.value === value)?.label ?? value : null;

    let photoUrl: string | null = null;
    if (member.photo_path) {
      const { data } = await admin.storage.from("member-photos").createSignedUrl(member.photo_path, 600);
      photoUrl = data?.signedUrl ?? null;
    }

    return json({
      club: settings ?? { club_name: "Clube de Tiro Conarmas", club_cr: "396.674" },
      member: {
        member_number: member.member_number,
        full_name: member.full_name,
        membership_expires_at: member.membership_expires_at,
        cr_number: member.cr_number,
        cr_expires_at: member.cr_expires_at,
        photo_url: photoUrl,
      },
      firearms: (firearms ?? []).map((f) => ({
        type: label("firearm_type", f.type),
        brand: label("brand", f.brand),
        model: f.model,
        sigma_number: f.sigma_number,
        caliber: label("caliber", f.caliber),
        restriction: f.restriction,
        sigma_expires_at: f.sigma_expires_at,
        // Só validade: o destino da GT pode ser o endereço do filiado
        traffic_guides: ((f.traffic_guides ?? []) as { expires_at: string; issued_at: string | null }[])
          .map((g) => ({ expires_at: g.expires_at, issued_at: g.issued_at }))
          .sort((a, b) => a.expires_at.localeCompare(b.expires_at)),
      })),
      checked_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("member-card:", e);
    return json({ error: "internal" }, 500);
  }
});
