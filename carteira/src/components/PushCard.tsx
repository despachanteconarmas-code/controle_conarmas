import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { disablePush, enablePush, getPushState, PushState, sendTestPush } from "../push";
import { Bell, BellOff, BellRing, Share } from "lucide-react";

interface PushCardProps {
  /** compact: só o convite para ativar (tela da carteirinha); some quando ativado */
  compact?: boolean;
}

/** Ativar/desativar os avisos de vencimento por notificação neste aparelho */
export function PushCard({ compact = false }: PushCardProps) {
  const { toast } = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setState).catch(() => setState("unsupported"));
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const next = await enablePush();
      setState(next);
      if (next === "on") {
        toast({ title: "Avisos ativados", description: "Enviamos uma notificação de teste para este aparelho." });
        sendTestPush().catch(() => {});
      } else if (next === "denied") {
        toast({ title: "Notificações bloqueadas", description: "Libere nas configurações do celular para receber os avisos.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Não foi possível ativar os avisos", description: "Tente de novo em instantes.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await disablePush();
      setState("off");
      toast({ title: "Avisos desativados neste aparelho" });
    } catch {
      toast({ title: "Não foi possível desativar", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const { sent } = await sendTestPush();
      toast(sent > 0 ? { title: "Notificação de teste enviada" } : { title: "Nenhum aparelho recebeu", description: "Desative e ative os avisos de novo.", variant: "destructive" });
    } catch {
      toast({ title: "Não foi possível enviar o teste", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (state === null) return null;
  // Na carteirinha, só convida quem pode ativar agora
  if (compact && state !== "off") return null;

  return (
    <section className={cn("rounded-xl border bg-card text-sm", compact ? "p-4" : "p-5")}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full p-2 text-gold" style={{ backgroundColor: "hsl(var(--gold) / 0.15)" }}>
          {state === "on" ? <BellRing className="h-4 w-4" /> : state === "denied" ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{compact ? "Receba um aviso antes de vencer" : "Avisos no celular"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {state === "on"
              ? "Ativados neste aparelho. Você recebe um lembrete 30, 15 e 7 dias antes e no dia do vencimento da filiação, CR, CRAF e GT."
              : "Lembrete 30, 15 e 7 dias antes e no dia do vencimento da filiação, CR, CRAF e GT."}
          </p>

          {state === "needs-install" && (
            <p className="mt-2 text-xs">
              No iPhone, os avisos só funcionam com o app na tela inicial: no Safari, toque em{" "}
              <Share className="inline h-3.5 w-3.5" /> Compartilhar, depois em "Adicionar à Tela de Início", e abra a carteira pelo ícone.
            </p>
          )}
          {state === "unsupported" && (
            <p className="mt-2 text-xs">Este navegador não recebe notificações. Os lembretes continuam chegando pelo WhatsApp.</p>
          )}
          {state === "denied" && (
            <p className="mt-2 text-xs">
              As notificações estão bloqueadas para a carteira. Libere em Ajustes do celular, em Notificações, e volte aqui.
            </p>
          )}

          {state === "off" && (
            <Button size="sm" className="mt-3" onClick={enable} disabled={busy}>
              <Bell className="mr-2 h-4 w-4" />
              {busy ? "Ativando..." : "Ativar avisos"}
            </Button>
          )}
          {state === "on" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={test} disabled={busy}>
                Enviar teste
              </Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={disable} disabled={busy}>
                Desativar
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
