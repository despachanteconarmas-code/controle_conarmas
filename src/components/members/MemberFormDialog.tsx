import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import InputMask from "react-input-mask";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { formatCPF, formatPhone } from "@/lib/formatters";
import { isValidCPF, Member } from "@/lib/members";

const digits = (v: string) => v.replace(/\D/g, "");

const memberSchema = z.object({
  member_number: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+$/.test(v), "Somente números"),
  full_name: z.string().trim().min(3, "Informe o nome completo"),
  cpf: z.string().refine((v) => isValidCPF(v), "CPF inválido"),
  phone: z
    .string()
    .refine((v) => v === "" || [10, 11].includes(digits(v).length), "Telefone incompleto"),
  email: z.string().trim().refine((v) => v === "" || z.string().email().safeParse(v).success, "E-mail inválido"),
  cr_number: z.string().trim(),
  cr_expires_at: z.string(),
  membership_expires_at: z.string().min(10, "Informe o vencimento da filiação"),
  notes: z.string(),
});

type MemberFormData = z.infer<typeof memberSchema>;

const empty: MemberFormData = {
  member_number: "",
  full_name: "",
  cpf: "",
  phone: "",
  email: "",
  cr_number: "",
  cr_expires_at: "",
  membership_expires_at: "",
  notes: "",
};

interface MemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Filiado em edição; ausente = novo cadastro */
  member?: Member | null;
  onSaved?: (id: string) => void;
}

export function MemberFormDialog({ open, onOpenChange, member, onSaved }: MemberFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: empty,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      member
        ? {
            member_number: String(member.member_number),
            full_name: member.full_name,
            cpf: formatCPF(member.cpf),
            phone: member.phone ? formatPhone(member.phone) : "",
            email: member.email ?? "",
            cr_number: member.cr_number ?? "",
            cr_expires_at: member.cr_expires_at ?? "",
            membership_expires_at: member.membership_expires_at,
            notes: member.notes ?? "",
          }
        : empty,
    );
  }, [open, member, form]);

  const save = useMutation({
    mutationFn: async (data: MemberFormData) => {
      const payload = {
        full_name: data.full_name.trim(),
        cpf: digits(data.cpf),
        phone: data.phone ? digits(data.phone) : null,
        email: data.email.trim() || null,
        cr_number: data.cr_number.trim() || null,
        cr_expires_at: data.cr_expires_at || null,
        membership_expires_at: data.membership_expires_at,
        notes: data.notes.trim() || null,
        // Vazio no cadastro novo = o banco gera o maior nº + 1
        ...(data.member_number ? { member_number: Number(data.member_number) } : {}),
      };

      if (member) {
        const { error } = await supabase.from("members").update(payload).eq("id", member.id);
        if (error) throw error;
        return member.id;
      }
      const { data: created, error } = await supabase
        .from("members")
        .insert([payload])
        .select("id")
        .single();
      if (error) throw error;
      return created.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member", id] });
      queryClient.invalidateQueries({ queryKey: ["member-expirations"] });
      toast({ title: member ? "Filiado atualizado" : "Filiado cadastrado" });
      onOpenChange(false);
      onSaved?.(id);
    },
    onError: (error: { code?: string; message?: string }) => {
      let description = "Não foi possível salvar o filiado.";
      if (error.code === "23505") {
        description = error.message?.includes("cpf")
          ? "Já existe um filiado com esse CPF."
          : "Já existe um filiado com esse número de filiação.";
      }
      toast({ title: "Erro", description, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{member ? "Editar filiado" : "Novo filiado"}</DialogTitle>
          <DialogDescription>
            Dados da carteirinha e do Livro de Habitualidade.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[160px_1fr]">
              <FormField
                control={form.control}
                name="member_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº de filiação</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="numeric" placeholder={member ? "" : "Automático"} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome como no CR" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF *</FormLabel>
                    <FormControl>
                      <InputMask mask="999.999.999-99" {...field}>
                        {(inputProps: React.InputHTMLAttributes<HTMLInputElement>) => (
                          <Input {...inputProps} placeholder="000.000.000-00" />
                        )}
                      </InputMask>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp</FormLabel>
                    <FormControl>
                      <InputMask mask="(99) 99999-9999" maskChar={null} {...field}>
                        {(inputProps: React.InputHTMLAttributes<HTMLInputElement>) => (
                          <Input {...inputProps} placeholder="(37) 99999-9999" />
                        )}
                      </InputMask>
                    </FormControl>
                    <FormDescription>Usado para o filiado entrar no app.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="opcional" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="membership_expires_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vencimento da filiação *</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormDescription>
                      {member ? "Para renovar, use o botão Renovar." : "Dia e mês ficam fixos."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cr_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº do CR</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cr_expires_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validade do CR</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    {/* O app do filiado não mostra este campo, mas ele faz
                        parte do cadastro que o próprio filiado consegue ler */}
                    <Textarea {...field} placeholder="Anotações da equipe (não use para dados sigilosos)" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
