import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/members/StatusBadge";
import { formatDateBR, guideUseLabel, TrafficGuide } from "@/lib/members";
import { MapPin, Pencil, Trash2 } from "lucide-react";

interface GuideListProps {
  guides: TrafficGuide[];
  onEdit: (g: TrafficGuide) => void;
  onDelete: (g: TrafficGuide) => void;
  emptyText?: string;
}

/** GTs do filiado, uma por endereço do acervo, da que vence primeiro */
export function GuideList({ guides, onEdit, onDelete, emptyText = "Nenhuma GT cadastrada." }: GuideListProps) {
  if (guides.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;

  const sorted = [...guides].sort((a, b) => a.expires_at.localeCompare(b.expires_at));
  return (
    <div className="space-y-2">
      {sorted.map((g) => (
        <div key={g.id} className="flex items-start justify-between gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="min-w-0 space-y-1.5">
            <p className="flex items-start gap-1.5 font-medium">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="break-words">{g.address}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={g.restricted ? "destructive" : "secondary"}>{guideUseLabel(g)}</Badge>
              <StatusBadge expiresAt={g.expires_at} />
            </div>
            <p className="text-xs text-muted-foreground">
              {g.guide_number && <>Nº {g.guide_number} · </>}
              {g.issued_at && <>Emitida em {formatDateBR(g.issued_at)} · </>}
              Validade {formatDateBR(g.expires_at)}
            </p>
          </div>
          <div className="flex shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(g)} aria-label="Editar GT" title="Editar GT">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(g)} aria-label="Excluir GT" title="Excluir GT">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
