// Endereço das Edge Functions, a partir do VITE_SUPABASE_URL do build.
// Antes o endereço do Supabase gerenciado estava escrito direto em cada
// chamada, o que impedia trocar de servidor só mudando a configuração.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export const functionUrl = (path: string) => `${SUPABASE_URL}/functions/v1/${path}`;
