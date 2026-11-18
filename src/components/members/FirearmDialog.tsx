import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ManagedSelect } from "@/components/ManagedSelect";
import { OptionSelect, SimpleOption } from "@/components/members/OptionSelect";
import { useToast } from "@/hooks/use-toast";
import { MemberFirearm, Restriction } from "@/lib/members";

interface FirearmDialogProps {
  memberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firearm?: MemberFirearm | null;
  /** Posição da arma nova na lista (PS 1, PS 2...) */
  nextPosition: number;
  /**
   * Listas só de leitura (app do filiado). Sem elas, usa o ManagedSelect do
   * painel, que permite incluir e remover opções.
   */
  readOnlyOptions?: { firearm_type: SimpleOption[]; brand: SimpleOption[]; caliber: SimpleOption[] };
  onSaved?: () => void;
}

const empty = {
  type: "",
  brand: "",
  model: "",
  sigma_number: "",
  caliber: "",
  restriction: "" as Restriction | "",
  sigma_expires_at: "",
};

export function FirearmDialog({ memberId, open, onOpenChange, firearm, nextPosition, readOnlyOptions, onSaved }: FirearmDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);
  const set = (key: keyof typeof empty) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!open) return;
    setForm(
      firearm
        ? {
            type: firearm.type ?? "",
            brand: firearm.brand ?? "",
            model: firearm.model ?? "",
            sigma_number: firearm.sigma_number ?? "",
            caliber: firearm.caliber ?? "",
            restriction: (firearm.restriction as Restriction) ?? "",
            sigma_expires_at: firearm.sigma_expires_at ?? "",
          }
        : empty,
    );
  }, [open, firearm]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        type: form.type || null,
        brand: form.brand || null,
        model: form.model.trim() || null,
        sigma_number: form.sigma_number.trim() || null,
        caliber: form.caliber || null,
        restriction: form.restriction || null,
        sigma_expires_at: form.sigma_expires_at || null,
      };
      if (firearm) {
        const { error } = await supabase.from("member_firearms").update(payload).eq("id", firearm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("member_firearms")
          .insert([{ ...payload, member_id: memberId, position: nextPosition }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-firearms", memberId] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member-expirations"] });
      toast({ title: firearm ? "Arma atualizada" : "Arma cadastrada" });
      onOpenChange(false);
      onSaved?.();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar a arma.", variant: "destructive" });
    },
  });

  const canSave = form.type && form.model.trim() && form.restriction;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{firearm ? "Editar arma" : "Nova arma"}</DialogTitle>
          <DialogDescription>Dados do CRAF, na ordem do Livro de Habitualidade.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              {readOnlyOptions ? (
                <OptionSelect options={readOnlyOptions.firearm_type} value={form.type} onChange={set("type")} />
              ) : (
                <ManagedSelect category="firearm_type" value={form.type} onChange={set("type")} />
              )}
            </div>
            <div className="space-y-2">
              <Label>Marca</Label>
              {readOnlyOptions ? (
                <OptionSelect options={readOnlyOptions.brand} value={form.brand} onChange={set("brand")} />
              ) : (
                <ManagedSelect category="brand" value={form.brand} onChange={set("brand")} />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fa-model">Modelo *</Label>
            <Input id="fa-model" value={form.model} onChange={(e) => set("model")(e.target.value)} placeholder="G2C, RT 82..." />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Calibre</Label>
              {readOnlyOptions ? (
                <OptionSelect options={readOnlyOptions.caliber} value={form.caliber} onChange={set("caliber")} />
              ) : (
                <ManagedSelect category="caliber" value={form.caliber} onChange={set("caliber")} />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fa-sigma">Nº SIGMA</Label>
              <Input id="fa-sigma" value={form.sigma_number} onChange={(e) => set("sigma_number")(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Permitido ou restrito *</Label>
              <RadioGroup
                value={form.restriction}
                onValueChange={set("restriction")}
                className="flex gap-4 pt-2"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="PERMITIDO" /> Permitido
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="RESTRITO" /> Restrito
                </label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fa-exp">Validade do CRAF</Label>
              <Input id="fa-exp" type="date" value={form.sigma_expires_at} onChange={(e) => set("sigma_expires_at")(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
