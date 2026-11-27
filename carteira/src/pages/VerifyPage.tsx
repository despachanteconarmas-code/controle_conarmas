import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { StatusBadge } from "@/components/members/StatusBadge";
import { formatDateTime } from "@/lib/formatters";
import { formatDateBR, guideUseLabel, restrictionLabels, Restriction } from "@/lib/members";
import { callFunction, FunctionError } from "../supabase";
import { ShieldCheck, UserRound } from "lucide-react";

interface PublicCard {
  club: { club_name: string; club_cr: string };
  member: {
    member_number: number;
    full_name: string;
    membership_expires_at: string;
    cr_number: string | null;
    cr_expires_at: string | null;
    photo_url: string | null;
  };
  firearms: {
    type: string | null;
    brand: string | null;
    model: string | null;
    sigma_number: string | null;
    caliber: string | null;
    restriction: string | null;
    sigma_expires_at: string | null;
  }[];
  /** Ausente se a função ainda for a versão antiga */
  traffic_guides?: { permitted: boolean; restricted: boolean; expires_at: string; issued_at: string | null }[];
  checked_at: string;
}

/**
 * Página aberta pelo QR do verso (inclusive da carteirinha impressa).
 * Dados em tempo real, sem login, sem CPF/telefone/endereço.
 */
export default function VerifyPage() {
  const { token = "" } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["verify", token],
    queryFn: () => callFunction<PublicCard>("member-card", { method: "GET", query: { token } }),
    retry: (count, e) => (e as FunctionError).status !== 404 && count < 2,
  });

  if (isLoading) {
    return <div className="flex min-h-[100dvh] items-center justify-center text-muted-foreground">Consultando...</div>;
  }

  if (error || !data) {
    const notFound = (error as FunctionError)?.status === 404;
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-6 text-center">
        <img src="/brasao.jpg" alt="" className="h-20 w-20" />
        <p className="text-lg font-semibold">{notFound ? "Carteirinha não encontrada" : "Não foi possível consultar agora"}</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          {notFound
            ? "Este QR Code não é válido ou foi substituído por um novo. Confira com o filiado ou com o Clube de Tiro Conarmas."
            : "Verifique a conexão e tente de novo."}
        </p>
      </div>
    );
  }

  const { member, firearms, club } = data;
  const guides = data.traffic_guides ?? [];

  return (
    <div className="mx-auto min-h-[100dvh] max-w-xl px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <img src="/brasao.jpg" alt="" className="h-12 w-12" />
        <div>
          <p className="font-semibold text-gold">{club.club_name}</p>
          <p className="text-xs text-muted-foreground">CR do clube {club.club_cr}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex gap-4">
          <div className="flex aspect-[3/4] w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 border-gold bg-neutral-900">
            {member.photo_url ? (
              <img src={member.photo_url} alt="Foto do filiado" className="h-full w-full object-cover" />
            ) : (
              <UserRound className="h-10 w-10 text-neutral-500" aria-label="Sem foto" />
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-lg font-bold uppercase leading-tight">{member.full_name}</p>
            <p className="text-sm text-muted-foreground">Filiado nº {member.member_number}</p>
            <div className="space-y-1 text-sm">
              <p>Filiação até <span className="font-semibold tabular-nums">{formatDateBR(member.membership_expires_at)}</span></p>
              <StatusBadge expiresAt={member.membership_expires_at} label="Filiação" />
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Nº do CR</p>
            <p className="font-semibold">{member.cr_number || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Validade do CR</p>
            <p className="font-semibold tabular-nums">{member.cr_expires_at ? formatDateBR(member.cr_expires_at) : "—"}</p>
            <StatusBadge expiresAt={member.cr_expires_at} className="mt-1" />
          </div>
        </div>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">Acervo ({firearms.length})</h2>
      <div className="space-y-3">
        {firearms.map((f, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-semibold">{[f.type, f.brand, f.model].filter(Boolean).join(" ") || "Arma"}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div><p className="text-xs text-muted-foreground">Calibre</p><p>{f.caliber || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Tipo</p><p>{f.restriction ? restrictionLabels[f.restriction as Restriction] : "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">SIGMA / CRAF</p><p className="tabular-nums">{f.sigma_number || "—"}</p></div>
              <div>
                <p className="text-xs text-muted-foreground">Validade do CRAF</p>
                <p className="tabular-nums">{f.sigma_expires_at ? formatDateBR(f.sigma_expires_at) : "—"}</p>
                <StatusBadge expiresAt={f.sigma_expires_at} className="mt-1" />
              </div>
            </div>
          </div>
        ))}
        {firearms.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma arma informada.</p>}
      </div>

      {guides.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">Guias de Tráfego ({guides.length})</h2>
          <div className="space-y-2">
            {guides.map((g, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-xl border bg-card p-4 text-sm">
                <div>
                  <p className="font-semibold">{guideUseLabel(g)}</p>
                  <p className="tabular-nums text-muted-foreground">até {formatDateBR(g.expires_at)}</p>
                </div>
                <StatusBadge expiresAt={g.expires_at} />
              </div>
            ))}
          </div>
        </>
      )}

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4" /> Consulta em tempo real · {formatDateTime(data.checked_at)}
      </p>
    </div>
  );
}
