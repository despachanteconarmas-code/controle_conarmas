// Regras e tipos da carteira digital de filiação (ver carteira-digital/ESCOPO.md)
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];

export type Member = Tables["members"]["Row"];
export type MemberOverview = Views["member_overview"]["Row"];
export type MemberExpiration = Views["member_expirations"]["Row"];
export type MembershipRenewal = Tables["membership_renewals"]["Row"];
export type MemberFirearm = Tables["member_firearms"]["Row"];
export type TrafficGuide = Tables["traffic_guides"]["Row"];
export type CardSettings = Tables["card_settings"]["Row"];

export type ExpiryStatus = "ATIVA" | "VENCENDO" | "VENCIDA" | "SEM_DATA";
export type Restriction = "PERMITIDO" | "RESTRITO";

/** Dias de antecedência a partir dos quais o item aparece como "vence em X dias" */
export const EXPIRING_WINDOW_DAYS = 30;

/** Validade padrão da GT, em meses a partir da emissão */
export const GUIDE_VALIDITY_MONTHS = 6;

/** Endereço do app do filiado (Fase 4) */
export const MEMBER_APP_URL = "https://carteira.armascon.com.br";

// ---------------------------------------------------------------------
// Datas. O banco guarda DATE ("2027-03-30"); aqui elas são tratadas como
// data local, sem fuso, para "30/03" não virar "29/03" no Brasil.
// ---------------------------------------------------------------------

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toUTC(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** "2027-03-30" -> "30/03/2027" */
export function formatDateBR(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Dias corridos de hoje até a data (negativo = já passou) */
export function daysUntil(iso: string): number {
  return Math.round((toUTC(iso) - toUTC(todayISO())) / 86_400_000);
}

/** Soma meses mantendo o último dia do mês quando ele não existe (31/08 + 6m = 28/02) */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function addYearsISO(iso: string, years: number): string {
  return addMonthsISO(iso, years * 12);
}

/** Mesma regra de public.expiry_status() no banco */
export function expiryStatus(iso?: string | null): ExpiryStatus {
  if (!iso) return "SEM_DATA";
  const days = daysUntil(iso);
  if (days < 0) return "VENCIDA";
  if (days < EXPIRING_WINDOW_DAYS) return "VENCENDO";
  return "ATIVA";
}

/** Texto do selo. A cor sempre vem acompanhada do texto escrito. */
export function statusText(status: ExpiryStatus | string | null | undefined, iso?: string | null): string {
  switch (status) {
    case "ATIVA":
      return "Ativa";
    case "VENCENDO": {
      if (!iso) return "Vence em breve";
      const days = daysUntil(iso);
      if (days === 0) return "Vence hoje";
      if (days === 1) return "Vence amanhã";
      return `Vence em ${days} dias`;
    }
    case "VENCIDA": {
      if (!iso) return "Vencida";
      const days = -daysUntil(iso);
      if (days >= 365) {
        const years = Math.floor(days / 365);
        return `Vencida há ${years} ano${years > 1 ? "s" : ""}`;
      }
      return days === 0 ? "Vencida" : `Vencida há ${days} dia${days > 1 ? "s" : ""}`;
    }
    default:
      return "Não informada";
  }
}

// ---------------------------------------------------------------------
// Renovação: vencimento atual + N anos, nunca a data do pagamento
// ---------------------------------------------------------------------

/**
 * Menor quantidade de anos que deixa a filiação em dia. Quem está vencido
 * há mais de um ano precisa de mais de um ano para voltar a ficar ativo.
 */
export function yearsToBeCurrent(currentExpiry: string): number {
  let years = 1;
  while (years < 10 && addYearsISO(currentExpiry, years) < todayISO()) years++;
  return years;
}

// ---------------------------------------------------------------------
// CPF e telefone
// ---------------------------------------------------------------------

export function isValidCPF(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

/** Link do WhatsApp (wa.me) com o 55 na frente */
export function whatsappLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith("55") && digits.length > 11 ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

export const restrictionLabels: Record<Restriction, string> = {
  PERMITIDO: "Permitido",
  RESTRITO: "Restrito",
};

export const expirationKindLabels: Record<string, string> = {
  FILIACAO: "Filiação",
  CR: "CR",
  CRAF: "CRAF",
  GT: "GT",
};
