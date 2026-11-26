// Avisos de vencimento por notificação (Web Push).
// O navegador gera uma inscrição por aparelho; ela fica no banco e a
// Edge Function member-push envia os avisos do dia.
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";

/** Chave pública VAPID do clube (a privada fica só no servidor) */
export const VAPID_PUBLIC_KEY =
  "BJu5VrHTdMcZdXkn1rjD09J0S9Zc2slv-DlFKEpQ3krdb3YuftXd49brd32WQAkM1G4xF1t_NFNzWEOYZC6A5qI";

/**
 * unsupported   navegador sem notificações
 * needs-install iPhone/iPad fora do app instalado (a Apple só libera push
 *               para o app adicionado à Tela de Início)
 * denied        o filiado bloqueou as notificações
 * off / on      pode ativar / já ativado neste aparelho
 */
export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function supported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function keyToBytes(base64url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Service worker pronto (com limite: em dev ele não é registrado) */
async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing?.active) return existing;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("sw_timeout")), 10_000)),
  ]);
}

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

/** Estado atual neste aparelho. Se já ativado, confirma a inscrição no banco. */
export async function getPushState(): Promise<PushState> {
  if (!supported()) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub || Notification.permission !== "granted") return "off";
  // Mantém o banco em dia (ex.: outro filiado entrou neste aparelho)
  saveSubscription(sub).catch(() => {});
  return "on";
}

/** Pede a permissão e inscreve este aparelho. Chamar direto no clique. */
export async function enablePush(): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "off";

  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) }));
  await saveSubscription(sub);
  return "on";
}

/** Desinscreve este aparelho (também ao sair da conta) */
export async function disablePush(): Promise<void> {
  if (!supported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.rpc("delete_push_subscription", { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}

/** Notificação de teste nos aparelhos do filiado logado */
export async function sendTestPush(): Promise<{ sent: number }> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/member-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: JSON.stringify({ action: "test" }),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}
