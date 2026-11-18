import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
}

// Sessão longa: o refresh token mantém o filiado conectado por semanas
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    storageKey: "carteira-conarmas-auth",
    persistSession: true,
    autoRefreshToken: true,
  },
});

/** Chamada às Edge Functions públicas, com a mensagem de erro já em português */
export async function callFunction<T>(name: string, init: RequestInit & { query?: Record<string, string> } = {}): Promise<T> {
  const qs = init.query ? `?${new URLSearchParams(init.query)}` : "";
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${name}${qs}`, {
      ...init,
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, ...(init.headers ?? {}) },
    });
  } catch {
    throw new FunctionError("Sem conexão. Verifique a internet e tente de novo.", "offline", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new FunctionError(body.message ?? "Algo deu errado. Tente de novo.", body.error ?? "error", res.status, body);
  }
  return body as T;
}

export class FunctionError extends Error {
  constructor(message: string, public code: string, public status: number, public body: Record<string, unknown> = {}) {
    super(message);
  }
}
