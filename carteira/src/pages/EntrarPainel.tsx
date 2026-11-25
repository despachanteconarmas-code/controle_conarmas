import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Chegada a partir do botão "Abrir no painel da carteira" do sistema de OS.
 * Troca o acesso de uso único (token_hash) por uma sessão de equipe própria
 * desta aba e segue para o painel de filiação.
 */
export default function EntrarPainel() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const tokenHash = params.get("token_hash");
    // Tira o token da barra de endereço e do histórico
    window.history.replaceState(null, "", "/entrar-painel");
    if (!tokenHash) {
      navigate("/auth", { replace: true });
      return;
    }
    supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash }).then(({ error }) => {
      if (error) setErro(true);
      else navigate("/filiados", { replace: true });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <img src="/brasao.jpg" alt="" className={`h-20 w-20 ${erro ? "" : "animate-pulse"}`} />
      {erro ? (
        <>
          <p className="font-semibold">O link de acesso expirou ou já foi usado.</p>
          <Button onClick={() => navigate("/auth", { replace: true })}>Entrar com e-mail e senha</Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Abrindo o painel de filiação...</p>
      )}
    </div>
  );
}
