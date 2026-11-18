import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { FirearmDialog } from "@/components/members/FirearmDialog";
import { GuideDialog } from "@/components/members/GuideDialog";
import { StatusBadge } from "@/components/members/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { formatDateBR, MemberFirearm, restrictionLabels, Restriction, TrafficGuide } from "@/lib/members";
import { supabase } from "../supabase";
import { CarteiraData, labelOf } from "../data";
import { Crosshair, MapPin, Pencil, Plus, Trash2 } from "lucide-react";

type Confirm = { kind: "firearm"; item: MemberFirearm } | { kind: "guide"; item: TrafficGuide };

export default function FirearmsPage({ data, refresh }: { data: CarteiraData; refresh: () => void }) {
  const { member, firearms, options } = data;
  const { toast } = useToast();
  const [firearmDialog, setFirearmDialog] = useState<{ open: boolean; item?: MemberFirearm | null }>({ open: false });
  const [guideDialog, setGuideDialog] = useState<{ open: boolean; firearm?: MemberFirearm; item?: TrafficGuide | null }>({ open: false });
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const readOnlyOptions = useMemo(() => {
    const of = (category: string) => options.filter((o) => o.category === category).map(({ value, label }) => ({ value, label }));
    return { firearm_type: of("firearm_type"), brand: of("brand"), caliber: of("caliber") };
  }, [options]);

  const name = (f: MemberFirearm) =>
    [labelOf(options, "firearm_type", f.type), labelOf(options, "brand", f.brand), f.model].filter(Boolean).join(" ") || "Arma";

  const remove = useMutation({
    mutationFn: async (c: Confirm) => {
      const table = c.kind === "firearm" ? "member_firearms" : "traffic_guides";
      const { error } = await supabase.from(table).delete().eq("id", c.item.id);
      if (error) throw error;
    },
    onSuccess: (_, c) => {
      toast({ title: c.kind === "firearm" ? "Arma excluída" : "GT excluída" });
      setConfirm(null);
      refresh();
    },
    onError: () => toast({ title: "Não foi possível excluir", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Mantenha CRAF e GTs em dia. A Conarmas vê o que você atualizar aqui.</p>
        <Button size="sm" onClick={() => setFirearmDialog({ open: true, item: null })} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" /> Arma
        </Button>
      </div>

      {firearms.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Crosshair className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma arma cadastrada ainda.</p>
        </div>
      )}

      {firearms.map((f) => (
        <div key={f.id} className="rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{name(f)}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {labelOf(options, "caliber", f.caliber) || "Calibre não informado"} · SIGMA {f.sigma_number || "—"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {f.restriction && (
                  <Badge variant={f.restriction === "RESTRITO" ? "destructive" : "secondary"}>
                    {restrictionLabels[f.restriction as Restriction]}
                  </Badge>
                )}
                <StatusBadge expiresAt={f.sigma_expires_at} label="CRAF" />
              </div>
            </div>
            <div className="flex shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setFirearmDialog({ open: true, item: f })} aria-label={`Editar ${name(f)}`}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setConfirm({ kind: "firearm", item: f })} aria-label={`Excluir ${name(f)}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Guias de Tráfego</p>
              <Button variant="ghost" size="sm" onClick={() => setGuideDialog({ open: true, firearm: f, item: null })}>
                <Plus className="mr-1 h-4 w-4" /> GT
              </Button>
            </div>
            {f.traffic_guides.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma GT cadastrada.</p>
            ) : (
              [...f.traffic_guides]
                .sort((a, b) => a.expires_at.localeCompare(b.expires_at))
                .map((g) => (
                  <div key={g.id} className="flex items-start justify-between gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="flex items-start gap-1">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="break-words">{g.destination_address}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Validade {formatDateBR(g.expires_at)}</p>
                      <StatusBadge expiresAt={g.expires_at} className="mt-1" />
                    </div>
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setGuideDialog({ open: true, firearm: f, item: g })} aria-label="Editar GT">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setConfirm({ kind: "guide", item: g })} aria-label="Excluir GT">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      ))}

      <FirearmDialog
        memberId={member.id}
        open={firearmDialog.open}
        onOpenChange={(open) => setFirearmDialog((s) => ({ ...s, open }))}
        firearm={firearmDialog.item}
        nextPosition={firearms.length + 1}
        readOnlyOptions={readOnlyOptions}
        onSaved={refresh}
      />
      {guideDialog.firearm && (
        <GuideDialog
          memberId={member.id}
          firearmId={guideDialog.firearm.id}
          firearmLabel={name(guideDialog.firearm)}
          open={guideDialog.open}
          onOpenChange={(open) => setGuideDialog((s) => ({ ...s, open }))}
          guide={guideDialog.item}
          onSaved={refresh}
        />
      )}

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === "firearm" ? "Excluir arma?" : "Excluir GT?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "firearm" ? "A arma e as GTs dela saem da sua carteira." : "A GT sai da sua carteira."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirm) remove.mutate(confirm);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
