import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";
import { CardSettings, formatDateBR, Member, verifyUrl } from "@/lib/members";
import { RotateCw, UserRound } from "lucide-react";

interface CardViewProps {
  member: Member;
  settings: CardSettings | null;
  photo: string | null;
}

/** Rótulo dourado + valor, no estilo do cartão físico */
function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[2.6cqw] font-bold uppercase tracking-wide text-gold">{label}</p>
      <p className="truncate text-[4.1cqw] font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

/**
 * Carteirinha frente e verso no tamanho proporcional do cartão (85,6 × 54).
 * As medidas usam cqw (largura do cartão), então tudo escala junto.
 */
export function CardView({ member, settings, photo }: CardViewProps) {
  const [flipped, setFlipped] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const clubName = settings?.club_name ?? "Clube de Tiro Conarmas";

  useEffect(() => {
    QRCode.toDataURL(verifyUrl(member.verify_token), { margin: 0, width: 360, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(null));
  }, [member.verify_token]);

  const face = "flip-face absolute inset-0 overflow-hidden rounded-[4.5cqw] bg-black p-[1.6cqw] shadow-2xl";
  const frame = "flex h-full w-full rounded-[3.4cqw] border-[0.6cqw] border-gold";

  return (
    <div className="mx-auto w-full max-w-[440px]">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="flip-scene block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-[4.5cqw]"
        style={{ containerType: "inline-size" }}
        aria-label={flipped ? "Mostrar a frente da carteirinha" : "Mostrar o verso da carteirinha"}
      >
        <div className={cn("flip-card relative w-full", flipped && "is-flipped")} style={{ aspectRatio: "85.6 / 54" }}>
          {/* Frente */}
          <div className={face} aria-hidden={flipped}>
            <div className={cn(frame, "flex-col p-[3cqw]")}>
              <div className="flex items-center gap-[2.5cqw]">
                <img src="/brasao.jpg" alt="" className="h-[14cqw] w-[14cqw] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[4.6cqw] font-bold leading-tight text-gold">CARTEIRA DE FILIADO</p>
                  <p className="truncate text-[3.2cqw] text-white">{clubName}</p>
                </div>
              </div>
              <div className="mt-[2.5cqw] flex min-h-0 flex-1 gap-[3.5cqw]">
                <div className="flex aspect-[3/4] h-full shrink-0 items-center justify-center overflow-hidden border-[0.35cqw] border-gold bg-neutral-800">
                  {photo ? (
                    <img src={photo} alt="Foto do filiado" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound className="h-1/2 w-1/2 text-neutral-500" aria-label="Sem foto" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between py-[0.5cqw]">
                  <div className="min-w-0">
                    <p className="text-[2.6cqw] font-bold uppercase tracking-wide text-gold">Nome</p>
                    <p className="line-clamp-2 text-[4cqw] font-bold uppercase leading-tight text-white">{member.full_name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-[2cqw] gap-y-[1.6cqw]">
                    <Item label="Nº de filiação" value={String(member.member_number)} />
                    <Item label="Vencimento" value={formatDateBR(member.membership_expires_at)} />
                    <Item label="Nº do CR" value={member.cr_number || "—"} />
                    <Item label="Validade do CR" value={member.cr_expires_at ? formatDateBR(member.cr_expires_at) : "—"} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Verso */}
          <div className={cn(face, "flip-back")} aria-hidden={!flipped}>
            <div className={cn(frame, "gap-[3.5cqw] p-[3.5cqw]")}>
              <div className="flex w-[33%] shrink-0 flex-col items-center justify-center gap-[1.5cqw]">
                <div className="w-full rounded-[1cqw] bg-white p-[1.4cqw]">
                  {qr && <img src={qr} alt="QR Code para conferir os dados" className="w-full" />}
                </div>
                <p className="text-center text-[2.5cqw] leading-tight text-gold">Aponte a câmera para conferir os dados</p>
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-[3.6cqw] font-bold uppercase text-gold">{clubName}</p>
                {settings?.legal_text && (
                  <p className="mt-[1.5cqw] line-clamp-6 text-[2.6cqw] leading-snug text-white">{settings.legal_text}</p>
                )}
                <div className="mt-[1.5cqw] space-y-[0.4cqw] text-[2.4cqw] leading-snug text-neutral-400">
                  {[settings?.address, settings?.whatsapp && `WhatsApp ${settings.whatsapp}`, settings?.instagram, settings?.website]
                    .filter(Boolean)
                    .slice(0, 4)
                    .map((line) => (
                      <p key={line as string} className="truncate">{line}</p>
                    ))}
                </div>
                <p className="mt-auto text-[2.8cqw] font-bold text-gold">CR DO CLUBE: {settings?.club_cr ?? "396.674"}</p>
              </div>
            </div>
          </div>
        </div>
      </button>
      <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <RotateCw className="h-3.5 w-3.5" /> Toque no cartão para ver {flipped ? "a frente" : "o verso"}
      </p>
    </div>
  );
}
