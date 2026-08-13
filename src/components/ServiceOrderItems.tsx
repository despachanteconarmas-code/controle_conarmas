import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/CurrencyInput";
import { ManagedSelect } from "@/components/ManagedSelect";
import { formatCurrency } from "@/lib/formatters";
import { Plus, Trash2 } from "lucide-react";

// Item ainda não persistido. `id` só existe quando veio do banco.
export interface ItemDraft {
  id?: string;
  description: string;
  quantity: number;
  unit_value_cents: number;
}

interface ServiceOrderItemsProps {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  disabled?: boolean;
}

export function calculateItemsTotal(items: ItemDraft[]): number {
  return items.reduce(
    (total, item) => total + item.quantity * item.unit_value_cents,
    0
  );
}

export function ServiceOrderItems({ items, onChange, disabled }: ServiceOrderItemsProps) {
  const total = calculateItemsTotal(items);

  const addItem = () => {
    onChange([...items, { description: "", quantity: 1, unit_value_cents: 0 }]);
  };

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum item lançado. Adicione peças e serviços para que o sistema
          calcule o valor total do reparo.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Cabeçalho: só faz sentido em telas largas */}
          <div className="hidden gap-3 px-1 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[1fr_90px_140px_120px_40px]">
            <span>Descrição</span>
            <span>Qtd.</span>
            <span>Valor unitário</span>
            <span className="text-right">Subtotal</span>
            <span />
          </div>

          {items.map((item, index) => (
            <div
              key={item.id ?? index}
              className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-[1fr_90px_140px_120px_40px] md:items-center md:border-0 md:p-0"
            >
              <div>
                <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                  Descrição
                </span>
                {/* Catálogo de serviços: evita redigitar o mesmo item em
                    toda OS. `useLabelAsValue` porque a descrição é o texto
                    que aparece na OS e no PDF. */}
                <ManagedSelect
                  category="service_item"
                  value={item.description}
                  onChange={(description) => updateItem(index, { description })}
                  placeholder="Selecione ou cadastre o serviço"
                  useLabelAsValue
                  disabled={disabled}
                />
              </div>

              <div>
                <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                  Quantidade
                </span>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(index, {
                      // Campo vazio vira 1 para o subtotal não virar NaN
                      quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  disabled={disabled}
                />
              </div>

              <div>
                <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                  Valor unitário
                </span>
                <CurrencyInput
                  value={item.unit_value_cents}
                  onValueChange={(cents) =>
                    updateItem(index, { unit_value_cents: cents ?? 0 })
                  }
                  placeholder="R$ 0,00"
                  disabled={disabled}
                />
              </div>

              <div className="flex items-center justify-between md:justify-end">
                <span className="text-xs text-muted-foreground md:hidden">Subtotal</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(item.quantity * item.unit_value_cents)}
                </span>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(index)}
                  disabled={disabled}
                  aria-label={`Remover item ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          disabled={disabled}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar item
        </Button>

        <div className="flex items-baseline gap-2 sm:justify-end">
          <span className="text-sm text-muted-foreground">Valor total do reparo</span>
          <span className="text-2xl font-bold tabular-nums">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}
