import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/members/StatusBadge";
import { formatDateBR, daysUntil, whatsappLink } from "@/lib/members";
import { CarteiraData } from "../data";
import { MessageCircle } from "lucide-react";

export default function MembershipPage({ data }: { data: CarteiraData }) {
  const { member, renewals, settings } = data;
  const days = daysUntil(member.membership_expires_at);
  const renewText = `Olá! Sou ${member.full_name}, filiado nº ${member.member_number}, e quero renovar minha filiação.`;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">Filiação nº {member.member_number}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{formatDateBR(member.membership_expires_at)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {days > 0 ? `faltam ${days} dia${days > 1 ? "s" : ""}` : days === 0 ? "vence hoje" : `venceu há ${-days} dia${days < -1 ? "s" : ""}`}
        </p>
        <StatusBadge expiresAt={member.membership_expires_at} className="mt-3 px-3 py-1 text-sm" />
        <p className="mt-4 text-xs text-muted-foreground">
          A filiação é anual e vence sempre no mesmo dia e mês. Na renovação só muda o ano.
        </p>
      </div>

      {settings?.whatsapp ? (
        <Button className="h-12 w-full text-base" asChild>
          <a href={whatsappLink(settings.whatsapp, renewText)} target="_blank" rel="noreferrer">
            <MessageCircle className="mr-2 h-5 w-5" /> Renovar pelo WhatsApp
          </a>
        </Button>
      ) : (
        <p className="text-center text-sm text-muted-foreground">Para renovar, fale com a Conarmas.</p>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Histórico de renovações</h2>
        {renewals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma renovação registrada no app ainda.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {renewals.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="tabular-nums">
                  {formatDateBR(r.previous_expires_at)} → <span className="font-semibold">{formatDateBR(r.new_expires_at)}</span>
                </span>
                <span className="text-xs text-muted-foreground">pago em {formatDateBR(r.paid_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
