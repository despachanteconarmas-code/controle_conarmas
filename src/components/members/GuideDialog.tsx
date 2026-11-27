import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { addMonthsISO, GUIDE_VALIDITY_MONTHS, TrafficGuide } from "@/lib/members";

interface GuideDialogProps {
  memberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guide?: TrafficGuide | null;
  /** Quantas GTs o filiado já tem (para o título "2º endereço") */
  existingCount?: number;
  onSaved?: () => void;
}

/**
 * GT do filiado: uma por endereço do acervo, cobrindo uso permitido,
 * restrito ou os dois, cada uma com a sua validade.
 */
export function GuideDialog({ memberId, open, onOpenChange, guide, existingCount = 0, onSaved }: GuideDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [address, setAddress] = useState("");
  const [permitted, setPermitted] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [number, setNumber] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  // Enquanto a validade não for mexida à mão, ela acompanha a emissão
  const [expiryTouched, setExpiryTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAddress(guide?.address ?? "");
    setPermitted(guide ? guide.permitted : true);
    setRestricted(guide?.restricted ?? false);
    setNumber(guide?.guide_number ?? "");
    setIssuedAt(guide?.issued_at ?? "");
    setExpiresAt(guide?.expires_at ?? "");
    setExpiryTouched(!!guide);
  }, [open, guide]);

  const onIssuedChange = (value: string) => {
    setIssuedAt(value);
    if (!expiryTouched && value) setExpiresAt(addMonthsISO(value, GUIDE_VALIDITY_MONTHS));
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        address: address.trim(),
        permitted,
        restricted,
        guide_number: number.trim() || null,
        issued_at: issuedAt || null,
        expires_at: expiresAt,
      };
      if (guide) {
        const { error } = await supabase.from("traffic_guides").update(payload).eq("id", guide.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("traffic_guides").insert([{ ...payload, member_id: memberId }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-guides", memberId] });
      queryClient.invalidateQueries({ queryKey: ["member-expirations"] });
      toast({ title: guide ? "GT atualizada" : "GT cadastrada" });
      onOpenChange(false);
      onSaved?.();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar a GT.", variant: "destructive" });
    },
  });

  const noUse = !permitted && !restricted;
  const title = guide
    ? "Editar Guia de Tráfego"
    : existingCount > 0
      ? `Nova GT (${existingCount + 1}º endereço)`
      : "Nova Guia de Tráfego";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Uma GT para cada endereço do acervo. Com dois endereços, cadastre duas GTs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gt-address">Endereço do acervo *</Label>
            <Textarea
              id="gt-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Endereço que consta na GT"
              rows={2}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium leading-none">Uso *</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={permitted} onCheckedChange={(v) => setPermitted(v === true)} />
                Permitido
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={restricted} onCheckedChange={(v) => setRestricted(v === true)} />
                Restrito
              </label>
            </div>
            {noUse && <p className="text-xs text-destructive">Marque permitido, restrito ou os dois.</p>}
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="gt-number">Nº da GT</Label>
            <Input id="gt-number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="opcional" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gt-issued">Emissão</Label>
              <DateInput id="gt-issued" value={issuedAt} onChange={onIssuedChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gt-expires">Validade *</Label>
              <DateInput
                id="gt-expires"
                value={expiresAt}
                onChange={(v) => {
                  setExpiresAt(v);
                  setExpiryTouched(true);
                }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A validade é preenchida com a emissão + {GUIDE_VALIDITY_MONTHS} meses e pode ser ajustada.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!address.trim() || !expiresAt || noUse || save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
