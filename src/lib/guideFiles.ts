import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Cliente Supabase de quem está usando a tela. O painel usa o de
 * "@/integrations/supabase/client"; o app do filiado usa o próprio
 * (carteira/src/supabase.ts), que guarda a sessão em outra chave.
 */
export type DbClient = SupabaseClient<Database>;

/** Bucket privado dos documentos do filiado (pasta <member_id>/...) */
export const DOCS_BUCKET = "member-documents";
export const GUIDE_FILE_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";
export const GUIDE_FILE_MAX_MB = 10;

const ALLOWED = GUIDE_FILE_ACCEPT.split(",");

/** Mensagem de erro, ou null se o arquivo pode ser enviado */
export function validateGuideFile(file: File): string | null {
  if (file.type && !ALLOWED.includes(file.type)) return "Envie um PDF ou uma foto (JPG, PNG, WebP ou HEIC).";
  if (file.size > GUIDE_FILE_MAX_MB * 1024 * 1024) return `O arquivo passa de ${GUIDE_FILE_MAX_MB} MB.`;
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export async function uploadGuideFile(client: DbClient, memberId: string, file: File) {
  const ext = (file.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  const path = `${memberId}/gt/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from(DOCS_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return { file_path: path, file_name: file.name, file_type: file.type || null };
}

/** Apaga arquivos do bucket sem travar a tela se falhar (sobra órfão, não quebra nada) */
export async function removeGuideFiles(client: DbClient, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length === 0) return;
  const { error } = await client.storage.from(DOCS_BUCKET).remove(list);
  if (error) console.warn("Não foi possível apagar o arquivo da GT", error);
}

/**
 * Abre o arquivo da GT numa aba nova. A aba é aberta antes da espera para o
 * navegador (inclusive o app instalado no iPhone) não bloquear como pop-up.
 */
export async function openGuideFile(client: DbClient, path: string) {
  const tab = window.open("", "_blank");
  try {
    const { data, error } = await client.storage.from(DOCS_BUCKET).createSignedUrl(path, 600);
    if (error || !data) throw error ?? new Error("sem link");
    if (tab) tab.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  } catch (e) {
    tab?.close();
    throw e;
  }
}
