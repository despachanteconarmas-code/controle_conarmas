import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { customerSchema, CustomerFormData } from "@/lib/validations";
import {
  formatCPF,
  cleanCPF,
  formatPhone,
  cleanPhone,
  formatCurrency,
  formatDate,
  statusLabels,
} from "@/lib/formatters";
import { Customer, ServiceOrder } from "@/types/database";
import InputMask from "react-input-mask";
import { Search, Plus, Pencil, Trash2, FileText, Users } from "lucide-react";

export default function Customers() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [historyOf, setHistoryOf] = useState<Customer | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", debouncedSearch],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase.from("customers").select("*").order("full_name");

      const term = debouncedSearch.trim();
      if (term) {
        const digits = term.replace(/\D/g, "");
        query = digits.length >= 2
          ? query.ilike("cpf", `%${digits}%`)
          : query.ilike("full_name", `%${term}%`);
      }

      // Em lista cabe muito mais gente na tela do que cabia em cartões
      const { data, error } = await query.limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Customer[];
    },
  });

  // OS do cliente aberto no histórico
  const { data: customerOrders = [] } = useQuery({
    queryKey: ["customer-orders", historyOf?.id],
    enabled: !!historyOf,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*")
        .eq("customer_id", historyOf!.id)
        .order("entry_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as ServiceOrder[];
    },
  });

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: "",
      cpf: "",
      phone: "",
      address_street: "",
      address_number: "",
      address_neighborhood: "",
      address_city: "",
      address_complement: "",
      notes: "",
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      full_name: "",
      cpf: "",
      phone: "",
      address_street: "",
      address_number: "",
      address_neighborhood: "",
      address_city: "",
      address_complement: "",
      notes: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    form.reset({
      full_name: customer.full_name,
      cpf: formatCPF(customer.cpf),
      phone: customer.phone ? formatPhone(customer.phone) : "",
      address_street: customer.address_street ?? "",
      address_number: customer.address_number ?? "",
      address_neighborhood: customer.address_neighborhood ?? "",
      address_city: customer.address_city ?? "",
      address_complement: customer.address_complement ?? "",
      notes: customer.notes ?? "",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const payload = {
        full_name: data.full_name,
        cpf: cleanCPF(data.cpf),
        phone: data.phone ? cleanPhone(data.phone) : null,
        address_street: data.address_street || null,
        address_number: data.address_number || null,
        address_neighborhood: data.address_neighborhood || null,
        address_city: data.address_city || null,
        address_complement: data.address_complement || null,
        notes: data.notes || null,
      };

      if (editing) {
        const { error } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setDialogOpen(false);
      toast({
        title: editing ? "Cliente atualizado" : "Cliente cadastrado",
        description: "Os dados foram salvos com sucesso.",
      });
    },
    onError: (error: unknown) => {
      // 23505 = violação de UNIQUE, ou seja, CPF já cadastrado
      const isDuplicate =
        typeof error === "object" && error !== null && "code" in error &&
        (error as { code?: string }).code === "23505";
      toast({
        title: "Erro",
        description: isDuplicate
          ? "Já existe um cliente cadastrado com esse CPF."
          : "Não foi possível salvar o cliente.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (customer: Customer) => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setDeleteTarget(null);
      toast({
        title: "Cliente excluído",
        description: "As ordens de serviço dele foram preservadas.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o cliente.",
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-1/4 rounded bg-muted" />
            <div className="h-64 rounded bg-muted" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground">
              Cadastro reaproveitado ao abrir novas ordens de serviço
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo cliente
          </Button>
        </div>

        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou CPF..."
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded bg-muted" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                {search
                  ? "Nenhum cliente encontrado para essa busca."
                  : "Nenhum cliente cadastrado ainda."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden sm:table-cell">CPF</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="hidden lg:table-cell">Cidade</TableHead>
                  <TableHead className="w-[130px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      {customer.full_name}
                      {/* Nas telas estreitas as colunas somem, então o CPF
                          acompanha o nome para a linha não ficar ambígua */}
                      <span className="block text-xs font-normal text-muted-foreground sm:hidden">
                        {formatCPF(customer.cpf)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell tabular-nums">
                      {formatCPF(customer.cpf)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell tabular-nums">
                      {customer.phone ? formatPhone(customer.phone) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {customer.address_city || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setHistoryOf(customer)}
                          title="Histórico de OS"
                          aria-label={`Histórico de ${customer.full_name}`}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(customer)}
                          title="Editar"
                          aria-label={`Editar ${customer.full_name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(customer)}
                          title="Excluir"
                          aria-label={`Excluir ${customer.full_name}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Cadastro / edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar cliente" : "Novo cliente"}
            </DialogTitle>
            <DialogDescription>
              Estes dados preenchem automaticamente as próximas ordens de
              serviço deste cliente.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome completo do cliente" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF *</FormLabel>
                      <FormControl>
                        <InputMask mask="999.999.999-99" {...field}>
                          {(inputProps: any) => (
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
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <InputMask
                          mask="(99) 99999-9999"
                          maskChar={null}
                          {...field}
                          value={field.value ?? ""}
                        >
                          {(inputProps: any) => (
                            <Input {...inputProps} placeholder="(37) 99999-9999" />
                          )}
                        </InputMask>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="address_street"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Rua</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder="Rua das Flores" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder="120" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="address_neighborhood"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder="Centro" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder="Divinópolis" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address_complement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complemento</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="Apto 302, Bloco B" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Preferências, referências, histórico relevante..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={saveMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Histórico de OS do cliente */}
      <Dialog open={!!historyOf} onOpenChange={(open) => !open && setHistoryOf(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de {historyOf?.full_name}</DialogTitle>
            <DialogDescription>
              Ordens de serviço vinculadas a este cliente
            </DialogDescription>
          </DialogHeader>

          {customerOrders.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              Nenhuma ordem de serviço encontrada.
            </p>
          ) : (
            <div className="space-y-2">
              {customerOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => navigate(`/os/${order.id}`)}
                  className="flex w-full items-center justify-between gap-4 rounded-md border p-3 text-left transition-colors hover:bg-accent"
                >
                  <div>
                    <p className="font-medium">{order.os_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(order.entry_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{statusLabels[order.status]}</Badge>
                    <span className="whitespace-nowrap font-medium tabular-nums">
                      {formatCurrency(order.repair_value_cents)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.full_name} será removido do cadastro. As ordens de
              serviço já registradas continuam no sistema, apenas deixam de
              apontar para este cliente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
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
