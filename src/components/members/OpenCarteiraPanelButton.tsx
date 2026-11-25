import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { functionUrl } from "@/lib/supabaseUrl";
import { CARTEIRA_URL } from "@/lib/appVariant";
import { ExternalLink } from "lucide-react";

/**
 * Abre o mesmo painel de filiação no app da carteira, já logado.
 * Pede à Edge Function painel-sso um acesso de uso único: a carteira cria
 * uma sessão própria, sem mexer na sessão deste sistema.
 */
export function OpenCarteiraPanelButton() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    // A aba abre já no clique (senão o navegador bloqueia como pop-up)
    const tab = window.open("about:blank", "_blank");
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(functionUrl("painel-sso"), {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.token_hash) throw new Error(String(res.status));
      const url = `${CARTEIRA_URL}/entrar-painel?token_hash=${encodeURIComponent(body.token_hash)}`;
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch {
      tab?.close();
      toast({
        title: "Não foi possível abrir o painel da carteira",
        description: `Abra ${CARTEIRA_URL}/filiados e entre com o seu e-mail e senha.`,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={open} disabled={busy} className="ml-auto shrink-0">
      <ExternalLink className="mr-2 h-4 w-4" />
      {busy ? "Abrindo..." : "Abrir no painel da carteira"}
    </Button>
  );
}
