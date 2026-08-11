import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ServiceOrder, ServiceOrderFilters, statusConfig } from "@/types/database";
import { formatCurrency, formatDate, statusLabels, isInWarranty, cleanCPF, formatCPF } from "@/lib/formatters";
import { generateServiceOrderPDF } from "@/lib/pdfGenerator";
import { Search, Plus, Eye, Edit, FileText, Filter, BarChart3, ShieldCheck, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import InputMask from "react-input-mask";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<ServiceOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Redirecionar para login se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Estados para filtros
  const [filters, setFilters] = useState<ServiceOrderFilters>({
    search: '',
    cpf: '',
    serial_number: '',
    status: undefined,
    warranty_status: 'all'
  });

  // Debounce dos filtros para melhor performance
  const debouncedFilters = useDebounce(filters, 300);

  // Buscar ordens de serviço
  const { data: serviceOrders = [], isLoading, refetch } = useQuery({
    queryKey: ['service-orders', debouncedFilters],
    queryFn: async () => {
      let query = supabase
        .from('service_orders')
        .select('*')
        .order('entry_date', { ascending: false });

      // Aplicar filtros
      if (debouncedFilters.search) {
        query = query.or(`customer_full_name.ilike.%${debouncedFilters.search}%,os_number.ilike.%${debouncedFilters.search}%`);
      }

      if (debouncedFilters.cpf) {
        const cleanedCpf = cleanCPF(debouncedFilters.cpf);
        query = query.like('customer_cpf', `%${cleanedCpf}%`);
      }

      if (debouncedFilters.serial_number) {
        query = query.ilike('serial_number', `%${debouncedFilters.serial_number}%`);
      }

      if (debouncedFilters.status) {
        query = query.eq('status', debouncedFilters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data as ServiceOrder[];
    },
    enabled: !!user,
  });

  // Filtrar por garantia (local, pois precisa de lógica)
  const filteredOrders = useMemo(() => {
    if (filters.warranty_status === 'all') return serviceOrders;
    
    return serviceOrders.filter(order => {
      if (filters.warranty_status === 'in_warranty') {
        // Em garantia: tem warranty_until E está dentro do prazo
        return order.warranty_until && isInWarranty(order.warranty_until);
      } else {
        // Fora da garantia: não tem warranty_until OU já expirou
        return !order.warranty_until || !isInWarranty(order.warranty_until);
      }
    });
  }, [serviceOrders, filters.warranty_status]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = filteredOrders.length;
    const pending = filteredOrders.filter(o => !['ENTREGUE'].includes(o.status)).length;
    // Em Garantia: Qualquer OS que tenha warranty_until E esteja dentro do prazo
    const inWarranty = filteredOrders.filter(o => 
      o.warranty_until && 
      isInWarranty(o.warranty_until)
    ).length;
    
    return { total, pending, inWarranty };
  }, [filteredOrders]);

  const handleViewOrder = (id: string) => {
    navigate(`/os/${id}`);
  };

  const handleEditOrder = (id: string) => {
    navigate(`/os/${id}/editar`);
  };

  const handleGeneratePDF = async (order: ServiceOrder) => {
    try {
      await generateServiceOrderPDF(order);
      toast({
        title: "PDF gerado com sucesso!",
        description: `O PDF da ${order.os_number} foi baixado.`,
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o PDF. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (order: ServiceOrder) => {
    setOrderToDelete(order);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;

    setIsDeleting(true);

    try {
      // 1. Deletar todos os arquivos associados primeiro
      const { data: fileRecords, error: fetchError } = await supabase
        .from('service_order_files')
        .select('storage_key')
        .eq('service_order_id', orderToDelete.id);

      if (!fetchError && fileRecords && fileRecords.length > 0) {
        // Deletar do storage
        const storageKeys = fileRecords.map(f => f.storage_key);
        const { error: storageError } = await supabase.storage
          .from('os-attachments')
          .remove(storageKeys);

        if (storageError) {
          console.error('Erro ao deletar arquivos do storage:', storageError);
        }

        // Deletar registros do banco
        const { error: filesDbError } = await supabase
          .from('service_order_files')
          .delete()
          .eq('service_order_id', orderToDelete.id);

        if (filesDbError) {
          console.error('Erro ao deletar registros de arquivos:', filesDbError);
        }
      }

      // 2. Deletar a OS
      const { error: osError } = await supabase
        .from('service_orders')
        .delete()
        .eq('id', orderToDelete.id);

      if (osError) {
        throw osError;
      }

      // 3. Invalidar cache
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      
      toast({
        title: "OS deletada com sucesso",
        description: `A ordem de serviço ${orderToDelete.os_number} foi removida permanentemente.`,
      });

    } catch (error) {
      console.error('Erro ao deletar OS:', error);
      toast({
        title: "Erro ao deletar",
        description: error instanceof Error ? error.message : "Não foi possível deletar a ordem de serviço.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setOrderToDelete(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de OS</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                Ordens registradas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">
                Aguardando conclusão
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Garantia</CardTitle>
              <ShieldCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inWarranty}</div>
              <p className="text-xs text-muted-foreground">
                Dentro do prazo
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros e ações */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Ordens de Serviço</CardTitle>
                <CardDescription>
                  Gerencie e acompanhe todas as ordens de serviço
                </CardDescription>
              </div>
              <Button onClick={() => navigate('/nova-os')}>
                <Plus className="h-4 w-4 mr-2" />
                Nova OS
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou OS..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-9"
                />
              </div>

              <InputMask
                mask="999.999.999-99"
                value={filters.cpf}
                onChange={(e) => setFilters(prev => ({ ...prev, cpf: e.target.value }))}
              >
                {(inputProps: any) => (
                  <Input {...inputProps} placeholder="CPF do cliente" />
                )}
              </InputMask>

              <Input
                placeholder="Número de série..."
                value={filters.serial_number}
                onChange={(e) => setFilters(prev => ({ ...prev, serial_number: e.target.value }))}
              />

              <Input
                placeholder="Filtrar por cidade..."
                value={filters.city || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
              />

              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => setFilters(prev => ({ 
                  ...prev, 
                  status: value === 'all' ? undefined : value as ServiceOrder['status']
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.warranty_status || 'all'}
                onValueChange={(value) => setFilters(prev => ({ 
                  ...prev, 
                  warranty_status: value as any 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Garantia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="in_warranty">Em garantia</SelectItem>
                  <SelectItem value="out_of_warranty">Fora da garantia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabela */}
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Carregando ordens...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Nenhuma ordem de serviço encontrada</p>
                <Button 
                  onClick={() => navigate('/nova-os')} 
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeira OS
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº OS</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden sm:table-cell">CPF</TableHead>
                      <TableHead className="hidden md:table-cell">Produto</TableHead>
                      <TableHead className="hidden lg:table-cell">Nº Série</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden xl:table-cell">Garantia</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const warranty = order.warranty_until && isInWarranty(order.warranty_until);
                      const isDeliveredWithWarranty = order.status === 'ENTREGUE' && warranty;
                      const statusInfo = statusConfig[order.status];
                      
                      return (
                        <TableRow 
                          key={order.id}
                          className={isDeliveredWithWarranty ? 'bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30' : ''}
                        >
                          <TableCell className="font-medium">
                            {order.os_number}
                            {isDeliveredWithWarranty && (
                              <span className="ml-2 inline-flex items-center">
                                <ShieldCheck className="h-3 w-3 text-green-600 dark:text-green-400" />
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{order.customer_full_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(order.entry_date)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {formatCPF(order.customer_cpf)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {order.product}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {order.serial_number}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={statusInfo.color === 'green' ? 'default' : 'secondary'}
                              className={
                                statusInfo.color === 'green' ? 'bg-success text-success-foreground' :
                                statusInfo.color === 'blue' ? 'bg-primary text-primary-foreground' :
                                statusInfo.color === 'orange' ? 'bg-warning text-warning-foreground' :
                                statusInfo.color === 'yellow' ? 'bg-warning text-warning-foreground' :
                                'bg-muted text-muted-foreground'
                              }
                            >
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {order.warranty_until ? (
                              <div className="flex flex-col gap-1">
                                <Badge 
                                  variant={warranty ? 'default' : 'secondary'}
                                  className={warranty ? 'bg-green-600 text-white font-semibold' : 'bg-muted text-muted-foreground'}
                                >
                                  {warranty ? '✓ Em garantia' : 'Expirada'}
                                </Badge>
                                {warranty && order.status === 'ENTREGUE' && (
                                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                    até {formatDate(order.warranty_until)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                {order.status === 'ENTREGUE' ? 'Sem garantia' : '-'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewOrder(order.id)}
                                className="h-8 w-8"
                                title="Visualizar"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditOrder(order.id)}
                                className="h-8 w-8"
                                title="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleGeneratePDF(order)}
                                className="h-8 w-8"
                                title="Gerar PDF"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(order)}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title="Deletar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso irá deletar permanentemente a ordem de serviço{' '}
              <strong>{orderToDelete?.os_number}</strong> e todos os arquivos associados a ela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deletando...' : 'Sim, deletar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}