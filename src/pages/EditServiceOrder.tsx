import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { updateServiceOrderSchema, UpdateServiceOrderData } from "@/lib/validations";
import { ServiceOrder, ServiceOrderItem } from "@/types/database";
import { formatCurrency, formatCPF, cleanCPF, cleanPhone, formatPhone, statusLabels } from "@/lib/formatters";
import { ArrowLeft, Save } from "lucide-react";
import InputMask from "react-input-mask";
import { FileUpload } from "@/components/FileUpload";
import { ServiceOrderItems, ItemDraft, calculateItemsTotal } from "@/components/ServiceOrderItems";

export default function EditServiceOrder() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [files, setFiles] = useState<any[]>([]);

  // Redirecionar para login se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Buscar OS
  const { data: serviceOrder, isLoading } = useQuery({
    queryKey: ['service-order', id],
    queryFn: async () => {
      if (!id) throw new Error('ID não fornecido');
      
      const { data, error } = await supabase
        .from('service_orders')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as ServiceOrder;
    },
    enabled: !!id && !!user,
  });

  // Carregar anexos existentes da OS
  useEffect(() => {
    const loadFiles = async () => {
      if (!id) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      try {
        const response = await fetch(
          `https://utwujmzfwpyixczstdjw.supabase.co/functions/v1/get-os-files/${id}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );
        if (response.ok) {
          const result = await response.json();
          setFiles(result.files || []);
        }
      } catch (e) {
        console.error('Erro ao carregar arquivos da OS', e);
      }
    };

    if (user && id) {
      loadFiles();
    }
  }, [user, id]);

  const form = useForm<UpdateServiceOrderData>({
    resolver: zodResolver(updateServiceOrderSchema),
    defaultValues: {
      customer_full_name: "",
      address_street: "",
      address_number: "",
      address_neighborhood: "",
      address_city: "",
      address_complement: "",
      customer_cpf: "",
      customer_phone: "",
      product: undefined,
      serial_number: "",
      type: undefined,
      authority: undefined,
      repair_value_cents: 0,
      status: 'RECEBIDA',
      notes: "",
    },
  });

  // Itens do reparo já lançados nesta OS
  const [items, setItems] = useState<ItemDraft[]>([]);

  const { data: existingItems } = useQuery({
    queryKey: ['service-order-items', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_order_items')
        .select('*')
        .eq('service_order_id', id!)
        .order('position');

      if (error) throw error;
      return (data ?? []) as unknown as ServiceOrderItem[];
    },
  });

  // Carrega os itens no editor. OS antigas não têm itens, mas têm um
  // valor digitado à mão: vira um item único para não perder o valor.
  useEffect(() => {
    if (!existingItems || !serviceOrder) return;

    if (existingItems.length > 0) {
      setItems(
        existingItems.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit_value_cents: item.unit_value_cents,
        }))
      );
    } else if (serviceOrder.repair_value_cents > 0) {
      setItems([
        {
          description: "Reparo",
          quantity: 1,
          unit_value_cents: serviceOrder.repair_value_cents,
        },
      ]);
    }
  }, [existingItems, serviceOrder]);

  // Atualizar form quando OS carregar
  useEffect(() => {
    if (serviceOrder) {
      form.reset({
        customer_full_name: serviceOrder.customer_full_name,
        address_street: serviceOrder.address_street || "",
        address_number: serviceOrder.address_number || "",
        address_neighborhood: serviceOrder.address_neighborhood || "",
        address_city: serviceOrder.address_city || "",
        address_complement: serviceOrder.address_complement || "",
        customer_cpf: formatCPF(serviceOrder.customer_cpf),
        customer_phone: serviceOrder.customer_phone ? formatPhone(serviceOrder.customer_phone) : "",
        product: serviceOrder.product,
        serial_number: serviceOrder.serial_number,
        type: serviceOrder.type,
        authority: serviceOrder.authority || undefined,
        repair_value_cents: serviceOrder.repair_value_cents,
        status: serviceOrder.status,
        notes: serviceOrder.notes || "",
      });
    }
  }, [serviceOrder, form]);

  // Mutation para atualizar OS
  const updateMutation = useMutation({
    mutationFn: async (data: UpdateServiceOrderData) => {
      if (!id) throw new Error('ID não fornecido');

      const updateData = {
        customer_full_name: data.customer_full_name,
        address_street: data.address_street,
        address_number: data.address_number,
        address_neighborhood: data.address_neighborhood,
        address_city: data.address_city,
        address_complement: data.address_complement || null,
        customer_cpf: data.customer_cpf ? cleanCPF(data.customer_cpf) : undefined,
        customer_phone: data.customer_phone ? cleanPhone(data.customer_phone) : null,
        product: data.product,
        serial_number: data.serial_number,
        type: data.type,
        authority: data.authority || null,
        repair_value_cents: calculateItemsTotal(items),
        status: data.status,
        notes: data.notes || null,
        updated_at: new Date().toISOString(),
      };

      const { data: result, error } = await supabase
        .from('service_orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Regrava os itens: apagar e reinserir mantém a ordem correta sem
      // precisar diferenciar item novo, editado e removido. O trigger do
      // banco recalcula o total da OS ao final.
      const { error: deleteError } = await supabase
        .from('service_order_items')
        .delete()
        .eq('service_order_id', id);

      if (deleteError) throw deleteError;

      const validItems = items.filter((item) => item.description.trim() !== "");
      if (validItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('service_order_items')
          .insert(
            validItems.map((item, index) => ({
              service_order_id: id,
              description: item.description.trim(),
              quantity: item.quantity,
              unit_value_cents: item.unit_value_cents,
              position: index,
            }))
          );

        if (itemsError) throw itemsError;
      }

      // Mantém o cadastro do cliente em dia com o que foi editado na OS
      if (data.customer_cpf) {
        await supabase.from('customers').upsert(
          {
            full_name: data.customer_full_name!,
            cpf: cleanCPF(data.customer_cpf),
            phone: data.customer_phone ? cleanPhone(data.customer_phone) : null,
            address_street: data.address_street,
            address_number: data.address_number,
            address_neighborhood: data.address_neighborhood,
            address_city: data.address_city,
            address_complement: data.address_complement || null,
          },
          { onConflict: 'cpf' }
        );
      }

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
      toast({
        title: "OS atualizada com sucesso",
        description: `Ordem de Serviço ${data.os_number} foi atualizada.`,
      });
      navigate(`/os/${id}`);
    },
    onError: (error) => {
      console.error('Erro ao atualizar OS:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a ordem de serviço.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: UpdateServiceOrderData) => {
    updateMutation.mutate(data);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </main>
      </div>
    );
  }

  if (!serviceOrder) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">OS não encontrada</h1>
            <Button onClick={() => navigate('/')}>
              Voltar ao Dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(`/os/${id}`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar aos Detalhes
          </Button>
          
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl font-bold text-foreground">
              Editar OS {serviceOrder.os_number}
            </h1>
            <Badge variant="outline" className="text-sm">
              {statusLabels[serviceOrder.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Atualize as informações da ordem de serviço
          </p>
        </div>

        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>Editar Ordem de Serviço</CardTitle>
            <CardDescription>
              Modifique as informações necessárias da OS
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Dados do Cliente */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Dados do Cliente</h3>
                  
                  <FormField
                    control={form.control}
                    name="customer_full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nome completo do cliente" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Endereço em Grid */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium">Endereço</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="address_street"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rua</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Av. Primeiro de Junho" />
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
                              <Input {...field} placeholder="120" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="address_neighborhood"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Centro" />
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
                              <Input {...field} placeholder="Divinópolis" />
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
                            <Input {...field} placeholder="Apto 302, Bloco B" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customer_cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF</FormLabel>
                          <FormControl>
                            <InputMask
                              mask="999.999.999-99"
                              {...field}
                            >
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
                      name="customer_phone"
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
                </div>

                {/* Dados do Equipamento */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Dados do Equipamento</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="product"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Produto</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o produto" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="PISTOLA">Pistola</SelectItem>
                              <SelectItem value="CARABINA">Carabina</SelectItem>
                              <SelectItem value="REVOLVER">Revólver</SelectItem>
                              <SelectItem value="ESPINGARDA">Espingarda</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="FOGO">Arma de Fogo</SelectItem>
                              <SelectItem value="PRESSAO">Pressão</SelectItem>
                              <SelectItem value="AIRSOFT">Airsoft</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="serial_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de Série</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Número de série do equipamento" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch('type') === 'FOGO' && (
                    <FormField
                      control={form.control}
                      name="authority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Autoridade Competente</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a autoridade" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="EXERCITO">Exército</SelectItem>
                              <SelectItem value="POLICIA_FEDERAL">Polícia Federal</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Dados da OS */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Dados da Ordem de Serviço</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="RECEBIDA">Recebida</SelectItem>
                              <SelectItem value="AGUARDANDO_ORCAMENTO">Aguardando Orçamento</SelectItem>
                              <SelectItem value="EM_MANUTENCAO">Em Manutenção</SelectItem>
                              <SelectItem value="AGUARDANDO_PECAS">Aguardando Peças</SelectItem>
                              <SelectItem value="PRONTA">Pronta</SelectItem>
                              <SelectItem value="ENTREGUE">Entregue</SelectItem>
                            </SelectContent>
                          </Select>
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
                          <Textarea 
                            {...field} 
                            placeholder="Observações sobre o equipamento ou reparo..."
                            className="min-h-[100px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Itens do reparo */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Itens do Reparo</h3>
                    <p className="text-sm text-muted-foreground">
                      Lance peças e serviços separadamente. O valor total é
                      somado automaticamente.
                    </p>
                  </div>
                  <ServiceOrderItems items={items} onChange={setItems} />
                </div>

                {/* Anexos (fotos/vídeos) */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Anexos (fotos/vídeos)</h3>
                  {id && (
                    <FileUpload
                      serviceOrderId={id}
                      files={files}
                      onFilesChange={setFiles}
                      mode="persistent"
                    />
                  )}
                </div>

                <div className="flex gap-4 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/os/${id}`)}
                    disabled={updateMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="flex-1"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}