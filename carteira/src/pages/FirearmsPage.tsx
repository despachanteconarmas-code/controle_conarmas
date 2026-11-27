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
import { GuideList } from "@/components/members/GuideList";
import { removeGuideFiles } from "@/lib/guideFiles";
import { StatusBadge } from "@/components/members/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { MemberFirearm, restrictionLabels, Restriction, TrafficGuide } from "@/lib/members";
import { supabase } from "../supabase";
import { CarteiraData, labelOf } from "../data";
import { Crosshair, Pencil, Plus, Trash2 } from "lucide-react";

type Confirm = { kind: "firearm"; item: MemberFirearm } | { kind: "guide"; item: TrafficGuide };

export default function FirearmsPage({ data, refresh }: { data: CarteiraData; refresh: () => void }) {
  const { member, firearms, options } = data;
  const guides = data.guides ?? [];
  const { toast } = useToast();
  const [firearmDialog, setFirearmDialog] = useState<{ open: boolean; item?: MemberFirearm | null }>({ open: false });
  const [guideDialog, setGuideDialog] = useState<{ open: boolean; item?: TrafficGuide | null }>({ open: false });
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
      if (c.kind === "guide") await removeGuideFiles(supabase, [c.item.file_path]);
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
      <p className="text-sm text-muted-foreground">Mantenha CRAF e GTs em dia. A Conarmas vê o que você atualizar aqui.</p>

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Armas</h2>
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
        </div>
      ))}

      <div className="flex items-center justify-between gap-2 pt-4">
        <div>
          <h2 className="text-base font-semibold">Guias de Tráfego</h2>
          <p className="text-xs text-muted-foreground">Uma GT por endereço do acervo</p>
        </div>
        <Button size="sm" onClick={() => setGuideDialog({ open: true, item: null })} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" /> GT
        </Button>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <GuideList
          guides={guides}
          onEdit={(g) => setGuideDialog({ open: true, item: g })}
          onDelete={(g) => setConfirm({ kind: "guide", item: g })}
          emptyText="Nenhuma GT cadastrada. Se você tiver dois endereços de acervo, cadastre uma GT para cada."
          client={supabase}
        />
      </div>

      <FirearmDialog
        memberId={member.id}
        open={firearmDialog.open}
        onOpenChange={(open) => setFirearmDialog((s) => ({ ...s, open }))}
        firearm={firearmDialog.item}
        nextPosition={firearms.length + 1}
        readOnlyOptions={readOnlyOptions}
        client={supabase}
        onSaved={refresh}
      />
      <GuideDialog
        memberId={member.id}
        open={guideDialog.open}
        onOpenChange={(open) => setGuideDialog((s) => ({ ...s, open }))}
        guide={guideDialog.item}
        existingCount={guides.length}
        client={supabase}
        onSaved={refresh}
      />

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === "firearm" ? "Excluir arma?" : "Excluir GT?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "firearm" ? "A arma sai da sua carteira." : "A GT sai da sua carteira."}
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
