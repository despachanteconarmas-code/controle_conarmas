import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OptionList, OptionCategory } from "@/types/database";
import { productLabels, typeLabels, authorityLabels } from "@/lib/formatters";

// Usados enquanto a lista do banco não carrega, e como rede de segurança
// caso uma OS antiga tenha um valor que não está mais cadastrado
const fallbackLabels: Record<OptionCategory, Record<string, string>> = {
  product: productLabels,
  type: typeLabels,
  authority: authorityLabels,
  // Itens do reparo, calibre e marca nasceram já no banco: não existe
  // lista fixa anterior para servir de fallback
  service_item: {},
  caliber: {},
  brand: {},
};

// Marcas de acento que sobram depois do normalize("NFD")
const DIACRITICS = /[̀-ͯ]/g;

/**
 * Converte o que o usuário digitou em um código estável.
 * "Finca Pino" -> "FINCA_PINO"
 */
export function toOptionValue(label: string): string {
  return label
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

export function useOptions(category: OptionCategory) {
  const queryClient = useQueryClient();

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["option-lists", category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("option_lists")
        .select("*")
        .eq("category", category)
        .order("position");

      if (error) throw error;
      return (data ?? []) as unknown as OptionList[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["option-lists", category] });
  };

  const addOption = useMutation({
    mutationFn: async (label: string) => {
      const trimmed = label.trim();
      const value = toOptionValue(trimmed);
      if (!value) throw new Error("Nome inválido");

      // Se o valor já existe mas foi removido antes, reativa em vez de
      // tentar inserir de novo e esbarrar no UNIQUE
      const existing = options.find((o) => o.value === value);
      if (existing) {
        const { error } = await supabase
          .from("option_lists")
          .update({ is_active: true, label: trimmed })
          .eq("id", existing.id);
        if (error) throw error;
        return;
      }

      const nextPosition =
        options.reduce((max, o) => Math.max(max, o.position), 0) + 1;

      const { error } = await supabase.from("option_lists").insert([
        { category, value, label: trimmed, position: nextPosition },
      ]);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removeOption = useMutation({
    mutationFn: async (option: OptionList) => {
      // Remoção lógica: preserva o rótulo das OS que já usam este valor
      const { error } = await supabase
        .from("option_lists")
        .update({ is_active: false })
        .eq("id", option.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Só as ativas aparecem no formulário
  const activeOptions = options.filter((o) => o.is_active);

  // Já a tradução considera as inativas, senão uma OS antiga mostraria
  // "FINCA_PINO" em vez de "Finca Pino"
  const getLabel = (value?: string | null): string => {
    if (!value) return "";
    const found = options.find((o) => o.value === value);
    return found?.label ?? fallbackLabels[category][value] ?? value;
  };

  return {
    options: activeOptions,
    allOptions: options,
    isLoading,
    getLabel,
    addOption,
    removeOption,
  };
}
