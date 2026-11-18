import { cn } from "@/lib/utils";
import { ExpiryStatus, expiryStatus, statusText } from "@/lib/members";
import { CircleCheck, CircleAlert, CircleX, CircleDashed } from "lucide-react";

const styles: Record<ExpiryStatus, string> = {
  ATIVA: "bg-success/15 text-success border-success/30",
  VENCENDO: "bg-warning/15 text-amber-700 dark:text-amber-400 border-warning/40",
  VENCIDA: "bg-destructive/15 text-destructive border-destructive/30",
  SEM_DATA: "bg-muted text-muted-foreground border-border",
};

const icons: Record<ExpiryStatus, typeof CircleCheck> = {
  ATIVA: CircleCheck,
  VENCENDO: CircleAlert,
  VENCIDA: CircleX,
  SEM_DATA: CircleDashed,
};

interface StatusBadgeProps {
  /** Data de vencimento (YYYY-MM-DD). A situação é calculada a partir dela. */
  expiresAt?: string | null;
  /** Rótulo opcional antes do texto, ex.: "CR" */
  label?: string;
  className?: string;
}

/** Selo de situação: cor + ícone + texto, nunca só a cor */
export function StatusBadge({ expiresAt, label, className }: StatusBadgeProps) {
  const status = expiryStatus(expiresAt);
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        styles[status],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label && <span className="font-semibold">{label}:</span>}
      {statusText(status, expiresAt)}
    </span>
  );
}
