// Regras puras do login do filiado (sem Supabase nem Deno), testáveis à parte.

export const CODE_TTL_MINUTES = 10;
export const MAX_VERIFY_ATTEMPTS = 5;
/** Códigos por filiado numa janela de 15 minutos */
export const MAX_CODES_PER_MEMBER = 3;
/** Intervalo mínimo entre dois envios para o mesmo filiado */
export const RESEND_COOLDOWN_SECONDS = 60;
/** Pedidos de código por IP por hora (inclui CPF inexistente) */
export const MAX_STARTS_PER_IP = 20;
/** Conferências de código por IP por hora */
export const MAX_VERIFIES_PER_IP = 40;

export const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

/** "37999990156" -> "(37) 9••••-••56". Mostra o bastante para o filiado reconhecer. */
export function maskPhone(phone: string): string {
  const d = onlyDigits(phone);
  if (d.length < 10) return "••••";
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  const first = rest.length === 9 ? rest[0] : "";
  const tail = rest.slice(-2);
  return rest.length === 9 ? `(${ddd}) ${first}••••-••${tail}` : `(${ddd}) ••••-••${tail}`;
}

/** Número no formato internacional que a Uazapi espera (55 + DDD + número) */
export function toWhatsappNumber(phone: string): string {
  const d = onlyDigits(phone);
  return d.startsWith("55") && d.length > 11 ? d : `55${d}`;
}

/**
 * Código de 6 dígitos uniforme. `random` devolve inteiros de 32 bits
 * (crypto.getRandomValues); descarta o topo da faixa para não enviesar.
 */
export function generateCode(random: () => number): string {
  const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  let n: number;
  do n = random(); while (n >= limit);
  return String(n % 1_000_000).padStart(6, "0");
}

export async function hashCode(memberId: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(`${memberId}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparação em tempo constante para strings de mesmo tamanho */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * E-mail técnico do usuário do Supabase Auth. O filiado entra por CPF e
 * WhatsApp; este endereço só existe porque o Auth precisa de um
 * identificador para gerar a sessão. Nenhuma mensagem é enviada para ele.
 */
export function technicalEmail(memberId: string): string {
  return `filiado-${memberId}@carteira.armascon.com.br`;
}

/** Primeiro IP do X-Forwarded-For */
export function clientIp(forwardedFor: string | null): string {
  return (forwardedFor ?? "").split(",")[0].trim() || "desconhecido";
}
