// Texto da notificação de vencimento (puro, testável sem Deno)

export interface ReminderItem {
  kind: "FILIACAO" | "CR" | "CRAF" | "GT" | string;
  description: string;
  expires_at: string;
  days_left: number;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

const br = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

function what(item: ReminderItem): string {
  const desc = (item.description ?? "").trim();
  switch (item.kind) {
    case "FILIACAO":
      return "Filiação ao clube";
    case "CR":
      return desc && desc !== "CR" ? desc : "CR";
    case "CRAF":
      return desc ? `CRAF (${desc})` : "CRAF";
    case "GT":
      return desc ? `Guia de Tráfego (${desc})` : "Guia de Tráfego";
    default:
      return desc || item.kind;
  }
}

function when(item: ReminderItem): string {
  if (item.days_left <= 0) return `vence hoje (${br(item.expires_at)})`;
  if (item.days_left === 1) return `vence amanhã (${br(item.expires_at)})`;
  return `vence em ${item.days_left} dias (${br(item.expires_at)})`;
}

/** Uma notificação por filiado com todos os itens do dia */
export function reminderPayload(items: ReminderItem[]): PushPayload {
  const sorted = [...items].sort((a, b) => a.days_left - b.days_left);
  const soonest = sorted[0];
  const title =
    sorted.length === 1
      ? soonest.days_left <= 0
        ? `${what(soonest)} vence hoje`
        : soonest.days_left === 1
          ? `${what(soonest)} vence amanhã`
          : `${what(soonest)} vence em ${soonest.days_left} dias`
      : `${sorted.length} vencimentos próximos`;
  const body =
    sorted.length === 1
      ? `Vencimento em ${br(soonest.expires_at)}. Toque para ver sua carteira.`
      : sorted.map((i) => `${what(i)}: ${when(i)}`).join("\n");
  // Filiação abre a tela da filiação; o resto, a carteirinha
  const url = sorted.every((i) => i.kind === "FILIACAO") ? "/filiacao" : "/";
  return { title, body, url, tag: "vencimentos" };
}

export const testPayload = (): PushPayload => ({
  title: "Avisos ativados",
  body: "Você vai receber aqui os lembretes de vencimento da filiação, CR, CRAF e GT.",
  url: "/",
  tag: "teste",
});

/** Comparação em tempo constante */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
