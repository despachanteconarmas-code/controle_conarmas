import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { createServiceOrderSchema, CreateServiceOrderData } from "@/lib/validations";
import { formatCurrency, formatDate, cleanCPF, cleanPhone, formatPhone, formatZipCode, cleanZipCode } from "@/lib/formatters";
import { useCepLookup } from "@/hooks/useCepLookup";
import { ArrowLeft, Save, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import InputMask from "react-input-mask";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FileUpload } from "@/components/FileUpload";
import { ServiceOrderFile, Customer } from "@/types/database";
import { CustomerPicker } from "@/components/CustomerPicker";
import { ManagedSelect } from "@/components/ManagedSelect";
import { ServiceOrderItems, ItemDraft, calculateItemsTotal } from "@/components/ServiceOrderItems";

export default function NewServiceOrder() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Redirecionar para login se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Form setup
  const form = useForm<CreateServiceOrderData>({
    resolver: zodResolver(createServiceOrderSchema),
    defaultValues: {
      customer_full_name: "",
      address_zip_code: "",
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
      craf_number: "",
      caliber: undefined,
      brand: undefined,
      model: "",
      entry_date: new Date(),
      repair_value_cents: 0,
      notes: "",
    }
  });

  // Itens do reparo. O valor total da OS é a soma deles.
  const [items, setItems] = useState<ItemDraft[]>([]);
  // Cliente escolhido na busca; nulo quando é um cadastro novo
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const { lookup: lookupCep, isLoading: cepLoading } = useCepLookup();

  // Preenche rua, bairro e cidade a partir do CEP. Só sobrescreve o que
  // a ViaCEP devolveu preenchido: CEP de cidade inteira vem sem
  // logradouro, e apagar o que já foi digitado seria pior que não buscar.
  const applyCep = async (rawZip: string) => {
    const address = await lookupCep(rawZip);
    if (!address) return;
    if (address.street) form.setValue('address_street', address.street);
    if (address.neighborhood) form.setValue('address_neighborhood', address.neighborhood);
    if (address.city) form.setValue('address_city', address.city);
  };

  // Preenche o formulário com os dados de um cliente já cadastrado
  const applyCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    form.setValue('customer_full_name', customer.full_name);
    form.setValue('customer_cpf', customer.cpf);
    form.setValue('customer_phone', customer.phone ? formatPhone(customer.phone) : "");
    form.setValue('address_zip_code', formatZipCode(customer.address_zip_code));
    form.setValue('address_street', customer.address_street ?? "");
    form.setValue('address_number', customer.address_number ?? "");
    form.setValue('address_neighborhood', customer.address_neighborhood ?? "");
    form.setValue('address_city', customer.address_city ?? "");
    form.setValue('address_complement', customer.address_complement ?? "");
    toast({
      title: "Cliente carregado",
      description: `Dados de ${customer.full_name} preenchidos automaticamente.`,
    });
  };

  // Mutation para criar OS
  const createMutation = useMutation({
    mutationFn: async (data: CreateServiceOrderData) => {
      const cpf = cleanCPF(data.customer_cpf);
      const phone = data.customer_phone ? cleanPhone(data.customer_phone) : null;
      const zipCode = data.address_zip_code ? cleanZipCode(data.address_zip_code) || null : null;

      // Cadastra ou atualiza o cliente antes da OS, para que ele fique
      // disponível na próxima vez que essa pessoa aparecer
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .upsert(
          {
            full_name: data.customer_full_name,
            cpf,
            phone,
            address_zip_code: zipCode,
            address_street: data.address_street,
            address_number: data.address_number,
            address_neighborhood: data.address_neighborhood,
            address_city: data.address_city,
            address_complement: data.address_complement || null,
          },
          { onConflict: 'cpf' }
        )
        .select()
        .single();

      if (customerError) throw customerError;

      const insertData = {
        customer_id: customer?.id ?? selectedCustomerId,
        customer_phone: phone,
        customer_full_name: data.customer_full_name,
        customer_address: `${data.address_street}, ${data.address_number}${data.address_complement ? ' - ' + data.address_complement : ''}, ${data.address_neighborhood} - ${data.address_city}`,
        address_street: data.address_street,
        address_number: data.address_number,
        address_neighborhood: data.address_neighborhood,
        address_city: data.address_city,
        address_complement: data.address_complement || null,
        address_zip_code: zipCode,
        customer_cpf: cleanCPF(data.customer_cpf),
        product: data.product,
        serial_number: data.serial_number,
        type: data.type,
        authority: data.authority || null,
        craf_number: data.craf_number?.trim() || null,
        caliber: data.caliber || null,
        brand: data.brand || null,
        model: data.model?.trim() || null,
        entry_date: data.entry_date.toISOString(),
        // Soma dos itens. O trigger no banco recalcula a cada mudança
        // de item; este valor cobre o caso de OS sem itens lançados.
        repair_value_cents: calculateItemsTotal(items),
        notes: data.notes || null,
      } as any;

      const { data: result, error } = await supabase
        .from('service_orders')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      // Itens do reparo, na ordem em que foram lançados
      const validItems = items.filter((item) => item.description.trim() !== "");
      if (validItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('service_order_items')
          .insert(
            validItems.map((item, index) => ({
              service_order_id: result.id,
              description: item.description.trim(),
              quantity: item.quantity,
              unit_value_cents: item.unit_value_cents,
              position: index,
            }))
          );

        if (itemsError) throw itemsError;
      }

      // Finalizar sessão de upload se houver arquivos
      if (uploadSessionId && stagingFiles.length > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetch(
            'https://utwujmzfwpyixczstdjw.supabase.co/functions/v1/finalize-upload-session',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                upload_session_id: uploadSessionId,
                service_order_id: result.id
              }),
            }
          );
        }
      }

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      toast({
        title: "OS criada com sucesso",
        description: `Ordem de Serviço ${data.os_number} foi registrada.`,
      });
      setCreatedOrderId(data.id);
      navigate(`/os/${data.id}`);
    },
    onError: (error) => {
      console.error('Erro ao criar OS:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a ordem de serviço.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: CreateServiceOrderData) => {
    createMutation.mutate(data);
  };

  const [stagingFiles, setStagingFiles] = useState<any[]>([]);
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  // Criar sessão de upload ao montar o componente
  useEffect(() => {
    if (user && !uploadSessionId) {
      const createSession = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          const response = await fetch(
            'https://utwujmzfwpyixczstdjw.supabase.co/functions/v1/create-upload-session',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const result = await response.json();
            setUploadSessionId(result.upload_session_id);
          }
        } catch (error) {
          console.error('Error creating upload session:', error);
        }
      };
      
      createSession();
    }
  }, [user, uploadSessionId]);

  if (authLoading) {
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          
          <h1 className="text-3xl font-bold text-foreground">Nova Ordem de Serviço</h1>
          <p className="text-muted-foreground">
            Registre uma nova ordem de serviço no sistema
          </p>
        </div>

        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>Criar Nova OS</CardTitle>
            <CardDescription>
              Preencha todos os campos obrigatórios para registrar a OS
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Dados do Cliente */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Dados do Cliente</h3>

                  {/* Reaproveita um cliente já cadastrado em vez de redigitar */}
                  <CustomerPicker onSelect={applyCustomer} />

                  <FormField
                    control={form.control}
                    name="customer_full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo *</FormLabel>
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

                    {/* CEP primeiro: preenche rua, bairro e cidade sozinho */}
                    <FormField
                      control={form.control}
                      name="address_zip_code"
                      render={({ field }) => (
                        <FormItem className="md:max-w-[220px]">
                          <FormLabel>CEP</FormLabel>
                          <FormControl>
                            <InputMask
                              mask="99999-999"
                              maskChar={null}
                              {...field}
                              value={field.value ?? ""}
                              // `disabled` fica aqui e não no Input de dentro:
                              // o react-input-mask lança Invariant Violation
                              // se a função filha alterar esta prop
                              disabled={cepLoading}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                field.onChange(e);
                                applyCep(e.target.value);
                              }}
                            >
                              {(inputProps: any) => (
                                <Input {...inputProps} placeholder="35500-000" />
                              )}
                            </InputMask>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="address_street"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rua *</FormLabel>
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
                            <FormLabel>Número *</FormLabel>
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
                            <FormLabel>Bairro *</FormLabel>
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
                            <FormLabel>Cidade *</FormLabel>
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
                          <FormLabel>CPF *</FormLabel>
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
                          <FormLabel>Produto *</FormLabel>
                          <FormControl>
                            <ManagedSelect
                              category="product"
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Selecione o produto"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo *</FormLabel>
                          <FormControl>
                            <ManagedSelect
                              category="type"
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Selecione o tipo"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marca</FormLabel>
                          <FormControl>
                            <ManagedSelect
                              category="brand"
                              value={field.value || undefined}
                              onChange={field.onChange}
                              placeholder="Selecione a marca"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modelo</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              placeholder="Ex: PT 100"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="caliber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Calibre</FormLabel>
                          <FormControl>
                            <ManagedSelect
                              category="caliber"
                              value={field.value || undefined}
                              onChange={field.onChange}
                              placeholder="Selecione o calibre"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="serial_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Série *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Número de série do equipamento" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Só para arma de fogo: autoridade e registro da arma */}
                  {form.watch('type') === 'FOGO' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="authority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Autoridade Competente *</FormLabel>
                            <FormControl>
                              <ManagedSelect
                                category="authority"
                                value={field.value || undefined}
                                onChange={field.onChange}
                                placeholder="Selecione a autoridade"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="craf_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número do CRAF</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value ?? ""}
                                placeholder="Registro da arma"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Dados da OS */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Dados da Ordem de Serviço</h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="entry_date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Data de Entrada *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                   {field.value ? (
                                     format(field.value, "dd/MM/yyyy", { locale: ptBR })
                                   ) : (
                                     <span>Selecione a data</span>
                                   )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date > new Date() || date < new Date("1900-01-01")
                                }
                                locale={ptBR}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
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

                {/* Anexos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Anexos (fotos/vídeos)</h3>
                  <FileUpload
                    uploadSessionId={uploadSessionId || undefined}
                    files={stagingFiles}
                    onFilesChange={setStagingFiles}
                    mode="staging"
                  />
                </div>

                <div className="flex gap-4 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/')}
                    disabled={createMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="flex-1"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {createMutation.isPending ? 'Criando...' : 'Criar OS'}
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