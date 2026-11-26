import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/members/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import type { CardPdfFormat } from "@/lib/cardPdf";
import { expiryStatus, whatsappLink } from "@/lib/members";
import { CardView } from "../components/CardView";
import { PushCard } from "../components/PushCard";
import { CarteiraData } from "../data";
import { AlertTriangle, Download, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export default function CardPage({ data }: { data: CarteiraData }) {
  const { member, settings, photo } = data;
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const status = expiryStatus(member.membership_expires_at);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const downloadPdf = async (format: CardPdfFormat) => {
    setBusy(true);
    try {
      // Carregado só aqui: o gerador de PDF é a parte mais pesada do app
      const { buildCardPdf, cardPdfFileName, imageUrlToDataUrl, photoTo3x4 } = await import("@/lib/cardPdf");
      const [brasao, photo3x4] = await Promise.all([
        imageUrlToDataUrl("/brasao.jpg"),
        photo ? photoTo3x4(photo) : Promise.resolve(null),
      ]);
      const doc = await buildCardPdf(
        { ...member },
        settings ?? {
          club_name: "Clube de Tiro Conarmas",
          club_cr: "396.674",
          address: null,
          whatsapp: null,
          instagram: null,
          website: null,
          email: null,
          legal_text: null,
        },
        { brasao, photo: photo3x4 },
        format,
      );
      doc.save(cardPdfFileName(member.member_number, format));
    } catch {
      toast({ title: "Não foi possível gerar o PDF", description: "Tente de novo em instantes.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const renewText = `Olá! Sou ${member.full_name}, filiado nº ${member.member_number}, e quero renovar minha filiação.`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <StatusBadge expiresAt={member.membership_expires_at} label="Filiação" className="px-3 py-1 text-sm" />
        <StatusBadge expiresAt={member.cr_expires_at} label="CR" className="px-3 py-1 text-sm" />
      </div>

      {status === "VENCIDA" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Filiação vencida</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Sem a filiação em dia, o uso do estande e a habitualidade ficam prejudicados.</p>
            {settings?.whatsapp && (
              <Button size="sm" variant="secondary" asChild>
                <a href={whatsappLink(settings.whatsapp, renewText)} target="_blank" rel="noreferrer">
                  Renovar pelo WhatsApp
                </a>
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <CardView member={member} settings={settings} photo={photo} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full" disabled={busy}>
            <Download className="mr-2 h-4 w-4" />
            {busy ? "Gerando PDF..." : "Baixar PDF da carteirinha"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-72">
          <DropdownMenuItem onClick={() => downloadPdf("a4")}>
            <div>
              <p className="font-medium">Folha A4 para imprimir</p>
              <p className="text-xs text-muted-foreground">Frente e verso com marcas de corte</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadPdf("cr80")}>
            <div>
              <p className="font-medium">Tamanho cartão, para gráfica</p>
              <p className="text-xs text-muted-foreground">85,6 × 54 mm, frente e verso</p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PushCard compact />

      {!standalone && (installEvent || isIos) && (
        <div className="rounded-lg border bg-card p-4 text-sm">
          <p className="font-medium">Deixe a carteira na tela inicial</p>
          {installEvent ? (
            <Button size="sm" className="mt-2" onClick={() => installEvent.prompt().then(() => setInstallEvent(null))}>
              Instalar app
            </Button>
          ) : (
            <p className="mt-1 text-muted-foreground">
              No Safari, toque em <Share className="inline h-4 w-4" /> Compartilhar e depois em "Adicionar à Tela de Início".
            </p>
          )}
        </div>
      )}
    </div>
  );
}
