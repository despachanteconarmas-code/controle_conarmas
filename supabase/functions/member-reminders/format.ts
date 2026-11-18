// Texto do aviso de vencimento (puro, testável sem Deno)

export interface ReminderItem {
  kind: "FILIACAO" | "CR" | "CRAF" | "GT" | string;
  description: string;
  expires_at: string;
  days_left: number;
}

export const APP_URL = "https://carteira.armascon.com.br";

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
  if (item.days_left <= 0) return `vence *hoje* (${br(item.expires_at)})`;
  if (item.days_left === 1) return `vence *amanhã* (${br(item.expires_at)})`;
  return `vence em ${item.days_left} dias (${br(item.expires_at)})`;
}

export function reminderText(fullName: string, items: ReminderItem[]): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] || "filiado";
  const name = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  const lines = items.map((i) => `• ${what(i)}: ${when(i)}`);
  return (
    `Olá, ${name}! Aqui é o Clube de Tiro Conarmas com um lembrete de vencimento:\n\n` +
    `${lines.join("\n")}\n\n` +
    `Sua carteira digital: ${APP_URL}\n` +
    `Qualquer dúvida, é só responder esta mensagem.`
  );
}

export const toWhatsappNumber = (phone: string) => {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.startsWith("55") && d.length > 11 ? d : `55${d}`;
};

/** Comparação em tempo constante */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
