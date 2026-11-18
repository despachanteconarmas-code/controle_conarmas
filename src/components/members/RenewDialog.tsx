import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { addYearsISO, formatDateBR, Member, todayISO, yearsToBeCurrent } from "@/lib/members";
import { AlertTriangle } from "lucide-react";

interface RenewDialogProps {
  member: Member;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Renovação com data fixa: o novo vencimento é o vencimento atual + N anos,
 * qualquer que seja a data do pagamento (não pode haver período sem filiação).
 */
export function RenewDialog({ member, open, onOpenChange }: RenewDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const current = member.membership_expires_at;
  const needed = yearsToBeCurrent(current);
  const [years, setYears] = useState(1);
  const [paidAt, setPaidAt] = useState(todayISO());

  useEffect(() => {
    if (open) {
      setYears(needed);
      setPaidAt(todayISO());
    }
  }, [open, needed]);

  const newExpiry = addYearsISO(current, years);
  const stillExpired = newExpiry < todayISO();

  const renew = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("renew_membership", {
        p_member_id: member.id,
        p_paid_at: paidAt,
        p_years: years,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member", member.id] });
      queryClient.invalidateQueries({ queryKey: ["member-renewals", member.id] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member-expirations"] });
      toast({ title: "Filiação renovada", description: `Novo vencimento: ${formatDateBR(newExpiry)}` });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível renovar a filiação.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renovar filiação</DialogTitle>
          <DialogDescription>
            {member.full_name} · nº {member.member_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paid-at">Data do pagamento</Label>
              <Input id="paid-at" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="years">Anos</Label>
              <Input
                id="years"
                type="number"
                min={1}
                max={10}
                value={years}
                onChange={(e) => setYears(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vencimento atual</span>
              <span className="tabular-nums">{formatDateBR(current)}</span>
            </div>
            <div className="mt-1 flex justify-between font-semibold">
              <span>Novo vencimento</span>
              <span className="tabular-nums">{formatDateBR(newExpiry)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              O dia e o mês não mudam, mesmo com pagamento em atraso.
            </p>
          </div>

          {stillExpired && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Com {years} ano{years > 1 && "s"} a filiação continua vencida. Para ficar em dia são
                necessários {needed} anos.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={renew.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => renew.mutate()} disabled={renew.isPending || !paidAt}>
            {renew.isPending ? "Renovando..." : "Confirmar renovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
