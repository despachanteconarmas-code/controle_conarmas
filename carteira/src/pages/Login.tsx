import { useEffect, useState } from "react";
import InputMask from "react-input-mask";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isValidCPF } from "@/lib/members";
import { callFunction, FunctionError, supabase } from "../supabase";
import { MessageCircle, ArrowLeft } from "lucide-react";

type Step = { kind: "cpf" } | { kind: "code"; phoneMasked: string };

interface StartResponse {
  phone_masked: string;
  expires_in: number;
}
interface VerifyResponse {
  access_token: string;
  refresh_token: string;
}

const RESEND_SECONDS = 60;

export default function Login() {
  const [step, setStep] = useState<Step>({ kind: "cpf" });
  const [cpf, setCpf] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const digits = cpf.replace(/\D/g, "");

  const requestCode = async () => {
    setError(null);
    if (!isValidCPF(digits)) {
      setError("Confira o CPF: os números não formam um CPF válido.");
      return;
    }
    setBusy(true);
    try {
      const res = await callFunction<StartResponse>("member-auth", {
        method: "POST",
        body: JSON.stringify({ action: "start", cpf: digits }),
      });
      setStep({ kind: "code", phoneMasked: res.phone_masked });
      setCode("");
      setWait(RESEND_SECONDS);
    } catch (e) {
      const err = e as FunctionError;
      if (err.code === "cooldown" && typeof err.body.retry_after === "number") setWait(err.body.retry_after);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    if (value.length !== 6 || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await callFunction<VerifyResponse>("member-auth", {
        method: "POST",
        body: JSON.stringify({ action: "verify", cpf: digits, code: value }),
      });
      const { error: sessionError } = await supabase.auth.setSession(res);
      if (sessionError) throw new FunctionError("Não foi possível entrar. Tente de novo.", "session", 0);
      // O AuthProvider percebe a sessão e leva para a carteirinha
    } catch (e) {
      setError((e as Error).message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-10">
      <img src="/brasao.jpg" alt="Clube de Tiro Conarmas" className="mb-6 h-28 w-28" />
      <h1 className="text-2xl font-bold text-gold">Carteira de Filiado</h1>
      <p className="mb-8 text-sm text-muted-foreground">Clube de Tiro Conarmas</p>

      <div className="w-full max-w-sm space-y-5">
        {step.kind === "cpf" ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              requestCode();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <InputMask mask="999.999.999-99" value={cpf} onChange={(e) => setCpf(e.target.value)}>
                {(props: React.InputHTMLAttributes<HTMLInputElement>) => (
                  <Input {...props} id="cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" className="h-12 text-lg" />
                )}
              </InputMask>
            </div>
            <Button type="submit" className="h-12 w-full text-base" disabled={busy || digits.length !== 11 || wait > 0}>
              <MessageCircle className="mr-2 h-5 w-5" />
              {busy ? "Enviando..." : wait > 0 ? `Aguarde ${wait}s` : "Receber código no WhatsApp"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-center text-sm">
              Enviamos um código de 6 dígitos para o WhatsApp
              <span className="block font-semibold tabular-nums">{step.phoneMasked}</span>
            </p>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (v.length === 6) verify(v);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                disabled={busy}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-11 text-xl" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {busy && <p className="text-center text-sm text-muted-foreground">Conferindo...</p>}
            <div className="flex items-center justify-between text-sm">
              <Button variant="ghost" size="sm" onClick={() => setStep({ kind: "cpf" })} disabled={busy}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Trocar CPF
              </Button>
              <Button variant="ghost" size="sm" onClick={requestCode} disabled={busy || wait > 0}>
                {wait > 0 ? `Reenviar em ${wait}s` : "Reenviar código"}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <p className="text-center text-xs text-muted-foreground">
          O WhatsApp usado é o que está no cadastro da Conarmas. Se ele mudou, fale com o clube para atualizar.
        </p>
      </div>
    </div>
  );
}
