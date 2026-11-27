import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { disablePush } from "./push";
import type { CardSettings, Member, MemberFirearm, MembershipRenewal, TrafficGuide } from "@/lib/members";

export interface OptionLabel {
  category: string;
  value: string;
  label: string;
}

export interface CarteiraData {
  member: Member;
  firearms: MemberFirearm[];
  /** GTs do filiado, uma por endereço do acervo. Pode faltar no cache antigo. */
  guides?: TrafficGuide[];
  renewals: MembershipRenewal[];
  settings: CardSettings | null;
  options: OptionLabel[];
  /** Foto já como data URL, para aparecer também offline */
  photo: string | null;
}

// ---------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------

interface AuthState {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    // Quem sai do aparelho para de receber os avisos nele
    await disablePush().catch(() => {});
    clearCache();
    queryClient.clear();
    await supabase.auth.signOut();
  }, [queryClient]);

  return <AuthContext.Provider value={{ session, loading, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}

// ---------------------------------------------------------------------
// Cópia local (estande sem sinal). Fica só no aparelho do próprio filiado.
// ---------------------------------------------------------------------

const CACHE_KEY = "carteira-conarmas-dados-v1";

interface Cached {
  userId: string;
  savedAt: string;
  data: CarteiraData;
}

function readCache(userId: string): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    return parsed.userId === userId ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(userId: string, data: CarteiraData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, savedAt: new Date().toISOString(), data }));
  } catch {
    // Sem espaço ou modo privado: segue sem cópia local
  }
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* nada a fazer */
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function loadPhoto(path: string | null, previous: CarteiraData | null): Promise<string | null> {
  if (!path) return null;
  // Mesma foto da última vez: reaproveita a cópia local
  if (previous?.member.photo_path === path && previous.photo) return previous.photo;
  const { data, error } = await supabase.storage.from("member-photos").download(path);
  if (error || !data) return null;
  return blobToDataUrl(data);
}

async function fetchCarteira(userId: string): Promise<CarteiraData | null> {
  const { data: member, error } = await supabase.from("members").select("*").eq("auth_user_id", userId).maybeSingle();
  if (error) throw error;
  if (!member) return null;

  const [firearms, guides, renewals, settings, options] = await Promise.all([
    supabase.from("member_firearms").select("*").eq("member_id", member.id).order("position").order("created_at"),
    supabase.from("traffic_guides").select("*").eq("member_id", member.id).order("expires_at"),
    supabase.from("membership_renewals").select("*").eq("member_id", member.id).order("created_at", { ascending: false }),
    supabase.from("card_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("option_lists").select("category, value, label").in("category", ["firearm_type", "brand", "caliber"]),
  ]);
  for (const r of [firearms, guides, renewals, settings, options]) if (r.error) throw r.error;

  const previous = readCache(userId)?.data ?? null;
  return {
    member: member as Member,
    firearms: (firearms.data ?? []) as MemberFirearm[],
    guides: (guides.data ?? []) as TrafficGuide[],
    renewals: (renewals.data ?? []) as MembershipRenewal[],
    settings: (settings.data ?? null) as CardSettings | null,
    options: (options.data ?? []) as OptionLabel[],
    photo: await loadPhoto(member.photo_path, previous),
  };
}

export interface UseCarteira {
  data: CarteiraData | null | undefined;
  isLoading: boolean;
  /** Mostrando a cópia local porque a internet falhou */
  offlineSince: string | null;
  refresh: () => Promise<unknown>;
}

export function useCarteira(): UseCarteira {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const cached = userId ? readCache(userId) : null;

  const query = useQuery({
    queryKey: ["carteira", userId],
    enabled: !!userId,
    queryFn: async () => {
      const data = await fetchCarteira(userId);
      if (data) writeCache(userId, data);
      return data;
    },
    initialData: cached?.data,
    // A cópia local aparece na hora, mas é sempre conferida com o servidor
    initialDataUpdatedAt: 0,
    retry: 1,
  });

  const offline = query.isError && !!cached;
  return {
    data: query.data ?? (offline ? cached!.data : undefined),
    isLoading: query.isLoading && !cached,
    offlineSince: offline ? cached!.savedAt : null,
    refresh: query.refetch,
  };
}

/** Rótulo de tipo/marca/calibre ("PISTOLA" -> "Pistola") */
export function labelOf(options: OptionLabel[], category: string, value: string | null | undefined): string {
  if (!value) return "";
  return options.find((o) => o.category === category && o.value === value)?.label ?? value;
}
