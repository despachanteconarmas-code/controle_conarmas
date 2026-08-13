import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useOptions, toOptionValue } from "@/hooks/useOptions";
import { OptionCategory, OptionList } from "@/types/database";
import { Plus, X, Check } from "lucide-react";

interface ManagedSelectProps {
  category: OptionCategory;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Grava o rótulo em vez do código. Usado na descrição dos itens da OS,
   * que é texto exibido na tela e no PDF: gravar "MAO_DE_OBRA" faria a
   * OS mostrar o código cru se o item saísse do catálogo depois.
   */
  useLabelAsValue?: boolean;
}

/**
 * Select cujas opções o próprio usuário administra: "+" no rodapé para
 * incluir, "x" em cada linha para remover. Evita depender de deploy para
 * cadastrar um produto ou tipo novo.
 */
export function ManagedSelect({
  category,
  value,
  onChange,
  placeholder = "Selecione",
  disabled,
  useLabelAsValue = false,
}: ManagedSelectProps) {
  const { options, isLoading, addOption, removeOption } = useOptions(category);
  const { toast } = useToast();

  const valueOf = (option: OptionList) =>
    useLabelAsValue ? option.label : option.value;

  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [removeTarget, setRemoveTarget] = useState<OptionList | null>(null);

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;

    try {
      await addOption.mutateAsync(label);
      // Já deixa selecionado: quem digitou o nome quer usá-lo agora
      onChange(useLabelAsValue ? label : toOptionValue(label));
      setNewLabel("");
      setAdding(false);
      toast({
        title: "Opção adicionada",
        description: `"${label}" já está disponível na lista.`,
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a opção.",
        variant: "destructive",
      });
    }
  };

  const handleRemove = async (option: OptionList) => {
    try {
      await removeOption.mutateAsync(option);
      // Se a opção removida estava escolhida, limpa o campo
      if (value === valueOf(option)) onChange("");
      toast({
        title: "Opção removida",
        description: `"${option.label}" saiu da lista. As OS que já usam continuam intactas.`,
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível remover a opção.",
        variant: "destructive",
      });
    } finally {
      setRemoveTarget(null);
    }
  };

  return (
    <>
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled || isLoading}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Carregando..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <div key={option.id} className="relative flex items-center">
              <SelectItem value={valueOf(option)} className="flex-1 pr-9">
                {option.label}
              </SelectItem>
              {/* Fora do SelectItem para o clique não selecionar a opção */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setRemoveTarget(option);
                }}
                className="absolute right-2 rounded-sm p-1 text-muted-foreground opacity-60 transition hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
                aria-label={`Remover ${option.label}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {options.length === 0 && !isLoading && (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">
              Nenhuma opção cadastrada.
            </p>
          )}

          {/* Rodapé: adicionar nova opção */}
          <div className="mt-1 border-t pt-1">
            {adding ? (
              <div
                className="flex items-center gap-1 p-1"
                // Impede que teclar dentro do input mude a seleção do Select
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Input
                  autoFocus
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                    if (e.key === "Escape") {
                      setAdding(false);
                      setNewLabel("");
                    }
                  }}
                  placeholder="Nome da nova opção"
                  className="h-8"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={handleAdd}
                  disabled={addOption.isPending || !newLabel.trim()}
                  aria-label="Confirmar"
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAdding(true);
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                Adicionar opção
              </button>
            )}
          </div>
        </SelectContent>
      </Select>

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover "{removeTarget?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A opção deixa de aparecer neste formulário. As ordens de serviço
              que já usam esse valor continuam exibindo "{removeTarget?.label}"
              normalmente. Você pode adicioná-la de volta depois, com o mesmo
              nome.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && handleRemove(removeTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
