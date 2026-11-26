import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CaptionProps, useDayPicker, useNavigation } from "react-day-picker";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** "2026-12-31" -> Date local (sem fuso), ou undefined */
function isoToDate(iso: string | null | undefined): Date | undefined {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : undefined;
}

const isoToBR = (iso: string | null | undefined) => {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

/** "31/12/2026" -> "2026-12-31", ou null se a data não existir */
function brToISO(text: string): string | null {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [+m[1], +m[2], +m[3]];
  const dt = new Date(y, mo - 1, d);
  if (y < 1900 || dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Digita só números: 31122026 -> 31/12/2026 */
const maskBR = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
};

/** Cabeçalho do calendário: setas + mês e ano em listas, no estilo do sistema */
function DateCaption({ displayMonth }: CaptionProps) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation();
  const { fromDate, toDate } = useDayPicker();
  const firstYear = fromDate?.getFullYear() ?? displayMonth.getFullYear() - 30;
  const lastYear = toDate?.getFullYear() ?? displayMonth.getFullYear() + 30;
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);

  return (
    <div className="flex items-center justify-between gap-1 pb-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex gap-1">
        <Select
          value={String(displayMonth.getMonth())}
          onValueChange={(m) => goToMonth(new Date(displayMonth.getFullYear(), Number(m), 1))}
        >
          <SelectTrigger className="h-8 w-[118px] px-2 text-sm font-medium" aria-label="Mês">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {MONTHS.map((name, i) => (
              <SelectItem key={name} value={String(i)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(displayMonth.getFullYear())}
          onValueChange={(y) => goToMonth(new Date(Number(y), displayMonth.getMonth(), 1))}
        >
          <SelectTrigger className="h-8 w-[82px] px-2 text-sm font-medium tabular-nums" aria-label="Ano">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {years.map((y) => (
              <SelectItem key={y} value={String(y)} className="tabular-nums">
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export interface DateInputProps
  extends Pick<React.InputHTMLAttributes<HTMLInputElement>, "aria-invalid" | "aria-describedby"> {
  /** Data em "AAAA-MM-DD" ("" = vazio) */
  value: string | null | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
  /** Faixa de anos do calendário */
  fromYear?: number;
  toYear?: number;
}

/**
 * Campo de data no visual do sistema: digita dd/mm/aaaa ou escolhe no
 * calendário. Trabalha com "AAAA-MM-DD", como o <input type="date">.
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, onBlur, id, name, disabled, className, fromYear, toYear, ...aria }, ref) => {
    const thisYear = new Date().getFullYear();
    const [text, setText] = React.useState(isoToBR(value));
    const [open, setOpen] = React.useState(false);
    const selected = isoToDate(value);

    React.useEffect(() => setText(isoToBR(value)), [value]);

    const handleText = (raw: string) => {
      const masked = maskBR(raw);
      setText(masked);
      if (masked === "") onChange("");
      else {
        const iso = brToISO(masked);
        if (iso && iso !== value) onChange(iso);
      }
    };

    return (
      <div className={cn("relative", className)}>
        <Input
          {...aria}
          ref={ref}
          id={id}
          name={name}
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          value={text}
          disabled={disabled}
          onChange={(e) => handleText(e.target.value)}
          onBlur={() => {
            // Data incompleta ou inexistente volta para a última válida
            if (text && !brToISO(text)) setText(isoToBR(value));
            onBlur?.();
          }}
          className="pr-10 tabular-nums"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Abrir calendário"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              locale={ptBR}
              selected={selected}
              defaultMonth={selected ?? new Date()}
              fromYear={fromYear ?? Math.min(1990, thisYear - 30)}
              toYear={toYear ?? thisYear + 30}
              onSelect={(d) => {
                if (d) onChange(format(d, "yyyy-MM-dd"));
                setOpen(false);
              }}
              components={{ Caption: DateCaption }}
              footer={
                <div className="mt-2 flex justify-end border-t pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      onChange(format(new Date(), "yyyy-MM-dd"));
                      setOpen(false);
                    }}
                  >
                    Hoje
                  </Button>
                </div>
              }
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);
DateInput.displayName = "DateInput";
