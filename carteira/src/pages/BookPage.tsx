import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/members/StatusBadge";
import { cn } from "@/lib/utils";
import { formatDateBR, restrictionLabels, Restriction } from "@/lib/members";
import { CarteiraData, labelOf } from "../data";
import { Plus } from "lucide-react";

/** Uma linha do livro: rótulo pequeno, valor grande para copiar à mão */
function Row({ n, label, value, expiresAt }: { n?: number; label: string; value: string; expiresAt?: string | null }) {
  return (
    <div className="flex items-start gap-3 border-b py-3 last:border-b-0">
      {/* Sem número: dado extra, fora das colunas do livro */}
      <span className="mt-1 w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{n ?? ""}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-gold">{label}</p>
        <p className="break-words text-2xl font-bold tabular-nums leading-tight">{value || "—"}</p>
        {expiresAt !== undefined && <StatusBadge expiresAt={expiresAt} className="mt-1" />}
      </div>
    </div>
  );
}

/**
 * Modo Livro: os dados na ordem das colunas do Livro de Registro de
 * Habitualidade, uma arma por vez, em letra grande para copiar no estande.
 */
export default function BookPage({ data }: { data: CarteiraData }) {
  const { member, firearms, options } = data;
  const [index, setIndex] = useState(0);
  const firearm = firearms[Math.min(index, firearms.length - 1)];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Na ordem das colunas do Livro de Habitualidade. Data, hora, finalidade, disparos e assinatura são preenchidos no dia.
      </p>

      {firearms.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Armas">
          {firearms.map((f, i) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm",
                i === index ? "border-gold bg-primary/15 text-gold" : "text-muted-foreground",
              )}
            >
              {labelOf(options, "firearm_type", f.type) || "Arma"} {f.model}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border bg-card px-4">
        <Row n={1} label="Nº filiação" value={String(member.member_number)} />
        <Row n={2} label="Vencimento filiação" value={formatDateBR(member.membership_expires_at)} expiresAt={member.membership_expires_at} />
        <Row n={3} label="Nome" value={member.full_name.toUpperCase()} />
        <Row n={4} label="CR" value={member.cr_number ?? ""} />
        <Row n={5} label="Val. CR" value={member.cr_expires_at ? formatDateBR(member.cr_expires_at) : ""} expiresAt={member.cr_expires_at} />
        {firearm ? (
          <>
            <Row n={6} label="SIGMA" value={firearm.sigma_number ?? ""} expiresAt={firearm.sigma_expires_at} />
            <Row n={7} label="Calibre" value={labelOf(options, "caliber", firearm.caliber)} />
            <Row
              n={8}
              label="Tipo"
              value={firearm.restriction ? restrictionLabels[firearm.restriction as Restriction] : ""}
            />
            <Row label="Nº de série" value={firearm.serial_number ?? ""} />
          </>
        ) : (
          <div className="py-5 text-center">
            <p className="mb-3 text-sm text-muted-foreground">Cadastre sua arma para ver SIGMA, calibre e tipo aqui.</p>
            <Button asChild size="sm">
              <Link to="/armas">
                <Plus className="mr-1 h-4 w-4" /> Cadastrar arma
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
