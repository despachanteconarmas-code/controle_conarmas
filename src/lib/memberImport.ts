// Importação dos filiados atuais a partir da planilha do sistema antigo.
// Lógica pura (sem React nem Supabase) para poder ser testada isoladamente.
import { isValidCPF } from "./members";

export type ImportField =
  | "member_number"
  | "full_name"
  | "cpf"
  | "membership_expires_at"
  | "phone"
  | "email"
  | "cr_number"
  | "cr_expires_at"
  | "notes";

export const importFields: { key: ImportField; label: string; required: boolean; hints: string[] }[] = [
  { key: "member_number", label: "Nº de filiação", required: true, hints: ["filiacao", "matricula", "codigo", "cod", "numero", "n", "no", "id cliente", "cliente"] },
  { key: "full_name", label: "Nome", required: true, hints: ["nome", "nome completo", "filiado", "atirador"] },
  { key: "cpf", label: "CPF", required: true, hints: ["cpf"] },
  { key: "membership_expires_at", label: "Vencimento da filiação", required: true, hints: ["vencimento", "validade filiacao", "vencimento filiacao", "venc", "validade"] },
  { key: "phone", label: "WhatsApp", required: false, hints: ["whatsapp", "celular", "telefone", "fone", "contato"] },
  { key: "email", label: "E-mail", required: false, hints: ["email", "e mail"] },
  { key: "cr_number", label: "Nº do CR", required: false, hints: ["cr", "numero cr", "n cr", "certificado de registro"] },
  { key: "cr_expires_at", label: "Validade do CR", required: false, hints: ["validade cr", "vencimento cr", "val cr", "venc cr"] },
  { key: "notes", label: "Observações", required: false, hints: ["obs", "observacao", "observacoes"] },
];

export type Mapping = Partial<Record<ImportField, number>>;

export type Cell = string | number | Date | null | undefined;

export interface ParsedMember {
  member_number: number;
  full_name: string;
  cpf: string;
  membership_expires_at: string;
  phone: string | null;
  email: string | null;
  cr_number: string | null;
  cr_expires_at: string | null;
  notes: string | null;
}

export interface RowIssue {
  /** Linha na planilha (1 = cabeçalho) */
  line: number;
  name: string;
  message: string;
}

export interface ValidationResult {
  valid: { line: number; member: ParsedMember }[];
  errors: RowIssue[];
  warnings: RowIssue[];
}

const normalizeHeader = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replace(/[º°ª.#_\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Sugere qual coluna da planilha corresponde a cada campo. Coincidência
 * exata ganha de coincidência parcial, e cada coluna só é usada uma vez.
 */
export function guessMapping(headers: string[]): Mapping {
  const norm = headers.map((h) => normalizeHeader(String(h ?? "")));
  const used = new Set<number>();
  const mapping: Mapping = {};

  // CR antes de filiação: "validade cr" não pode ser capturado por "validade"
  const order: ImportField[] = ["cr_expires_at", "cr_number", "cpf", "email", "phone", "full_name", "membership_expires_at", "member_number", "notes"];
  for (const key of order) {
    const { hints } = importFields.find((f) => f.key === key)!;
    let found = -1;
    for (const exact of [true, false]) {
      found = norm.findIndex((h, i) => {
        if (used.has(i) || !h) return false;
        return hints.some((hint) =>
          exact ? h === hint : hint.length > 2 && (` ${h} `).includes(` ${hint} `),
        );
      });
      if (found >= 0) break;
    }
    if (found >= 0) {
      mapping[key] = found;
      used.add(found);
    }
  }
  return mapping;
}

const text = (v: Cell): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};

/**
 * Aceita 31/12/2026, 31-12-26, 2026-12-31, data do Excel (Date) e o número
 * serial do Excel (46022). Devolve YYYY-MM-DD ou null.
 */
export function parseDate(v: Cell): string | null {
  if (v === null || v === undefined || v === "") return null;
  const iso = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    if (y < 1900 || y > 2200) return null;
    return dt.toISOString().slice(0, 10);
  };
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return iso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  }
  if (typeof v === "number" || /^\d{5}(\.\d+)?$/.test(String(v).trim())) {
    // Serial do Excel: dias desde 30/12/1899
    const serial = Math.floor(Number(v));
    if (serial < 20000 || serial > 80000) return null;
    const dt = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
    return dt.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    let y = +m[3];
    if (m[3].length === 2) y += y >= 70 ? 1900 : 2000;
    return iso(y, +m[2], +m[1]);
  }
  return null;
}

/** CPF que o Excel guardou como número perde os zeros à esquerda */
export function normalizeCPF(v: Cell): string {
  const digits = text(v).replace(/\D/g, "");
  return digits.length >= 8 && digits.length < 11 ? digits.padStart(11, "0") : digits;
}

/** Telefone com DDD, sem o 55. Devolve null se não der 10 ou 11 dígitos. */
export function normalizePhone(v: Cell): string | null {
  let digits = text(v).replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 11 || digits.length === 10) return digits;
  return null;
}

export function validateRows(rows: Cell[][], mapping: Mapping, headerLine = 1): ValidationResult {
  const result: ValidationResult = { valid: [], errors: [], warnings: [] };
  const get = (row: Cell[], key: ImportField) => (mapping[key] === undefined ? undefined : row[mapping[key]!]);
  const numberOf = (row: Cell[]) => text(get(row, "member_number")).replace(/\.0+$/, "");

  // Nº ou CPF repetido na planilha: não dá para saber qual linha está
  // certa, então todas as ocorrências ficam de fora até alguém corrigir
  const linesBy = (key: (row: Cell[]) => string) => {
    const map = new Map<string, number[]>();
    rows.forEach((row, index) => {
      const k = key(row);
      if (k) map.set(k, [...(map.get(k) ?? []), headerLine + 1 + index]);
    });
    return map;
  };
  const numberLines = linesBy((row) => (/^\d+$/.test(numberOf(row)) ? String(Number(numberOf(row))) : ""));
  const cpfLines = linesBy((row) => normalizeCPF(get(row, "cpf")));
  const others = (lines: number[] | undefined, line: number) =>
    (lines ?? []).filter((l) => l !== line).join(", ");

  rows.forEach((row, index) => {
    const line = headerLine + 1 + index;
    if (row.every((c) => text(c) === "")) return; // linha em branco

    const name = text(get(row, "full_name")).replace(/\s+/g, " ");
    const issues: string[] = [];
    const warn = (message: string) => result.warnings.push({ line, name, message });

    const numberRaw = numberOf(row);
    const memberNumber = /^\d+$/.test(numberRaw) ? Number(numberRaw) : NaN;
    if (!numberRaw) issues.push("Nº de filiação vazio");
    else if (!Number.isInteger(memberNumber) || memberNumber <= 0) issues.push(`Nº de filiação inválido: "${numberRaw}"`);
    else if (numberLines.get(String(memberNumber))!.length > 1)
      issues.push(`Nº ${memberNumber} repetido na planilha (também na linha ${others(numberLines.get(String(memberNumber)), line)})`);

    if (name.length < 3) issues.push("Nome vazio");

    const cpf = normalizeCPF(get(row, "cpf"));
    if (!cpf) issues.push("CPF vazio");
    else if (!isValidCPF(cpf)) issues.push(`CPF inválido: "${text(get(row, "cpf"))}"`);
    else if (cpfLines.get(cpf)!.length > 1) issues.push(`CPF repetido na planilha (também na linha ${others(cpfLines.get(cpf), line)})`);

    const expiresRaw = get(row, "membership_expires_at");
    const expires = parseDate(expiresRaw);
    if (!text(expiresRaw)) issues.push("Vencimento da filiação vazio");
    else if (!expires) issues.push(`Vencimento em formato não reconhecido: "${text(expiresRaw)}"`);

    if (issues.length) {
      for (const message of issues) result.errors.push({ line, name, message });
      return;
    }

    // Campos opcionais: problema vira aviso e o campo fica vazio
    const phoneRaw = text(get(row, "phone"));
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    if (phoneRaw && !phone) warn(`WhatsApp ignorado (incompleto): "${phoneRaw}"`);
    else if (!phoneRaw) warn("Sem WhatsApp: não vai conseguir entrar no app");

    const crRaw = get(row, "cr_expires_at");
    const crExpires = parseDate(crRaw);
    if (text(crRaw) && !crExpires) warn(`Validade do CR ignorada (formato): "${text(crRaw)}"`);

    const email = text(get(row, "email")).toLowerCase();
    const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) warn(`E-mail ignorado: "${email}"`);

    result.valid.push({
      line,
      member: {
        member_number: memberNumber,
        full_name: name,
        cpf,
        membership_expires_at: expires!,
        phone,
        email: email && emailOk ? email : null,
        cr_number: text(get(row, "cr_number")) || null,
        cr_expires_at: crExpires,
        notes: text(get(row, "notes")) || null,
      },
    });
  });

  return result;
}

/** Relatório de erros/avisos em CSV (separador ; para abrir direto no Excel) */
export function issuesToCSV(issues: (RowIssue & { kind: string })[]): string {
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const lines = [["Linha", "Tipo", "Nome", "Problema"].map(esc).join(";")];
  for (const i of issues) lines.push([i.line, i.kind, i.name, i.message].map(esc).join(";"));
  return "\uFEFF" + lines.join("\r\n");
}
