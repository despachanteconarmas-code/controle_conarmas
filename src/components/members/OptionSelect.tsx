import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SimpleOption {
  value: string;
  label: string;
}

const OTHER = "__outro__";

interface OptionSelectProps {
  options: SimpleOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Lista só de leitura, com "Outro…" para digitar quando a opção não existe.
 * É a versão do app do filiado: ele escolhe, mas não altera as listas do
 * clube (o painel usa o ManagedSelect).
 */
export function OptionSelect({ options, value, onChange, placeholder = "Selecione" }: OptionSelectProps) {
  const known = !value || options.some((o) => o.value === value);
  const [other, setOther] = useState(!known);

  useEffect(() => {
    if (value && !options.some((o) => o.value === value)) setOther(true);
  }, [value, options]);

  return (
    <div className="space-y-2">
      <Select
        value={other ? OTHER : value || undefined}
        onValueChange={(v) => {
          if (v === OTHER) {
            setOther(true);
            onChange("");
          } else {
            setOther(false);
            onChange(v);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
          <SelectItem value={OTHER}>Outro…</SelectItem>
        </SelectContent>
      </Select>
      {other && (
        <Input value={value} onChange={(e) => onChange(e.target.value.slice(0, 50))} placeholder="Digite" autoFocus />
      )}
    </div>
  );
}
