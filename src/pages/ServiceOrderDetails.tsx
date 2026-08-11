import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ServiceOrder, statusConfig, ServiceOrderFile } from "@/types/database";
import { 
  formatCurrency, 
  formatDate, 
  formatCPF, 
  statusLabels, 
  productLabels, 
  typeLabels, 
  authorityLabels,
  isInWarranty,
  warrantyDaysLeft
} from "@/lib/formatters";
import { generateServiceOrderPDF } from "@/lib/pdfGenerator";
import { 
  ArrowLeft, 
  Edit, 
  FileText, 
  Calendar, 
  User, 
  MapPin, 
  Hash, 
  Tag, 
  DollarSign,
  Clock,
  Shield,
  Trash2
} from "lucide-react";

export default function ServiceOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<ServiceOrderFile[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Buscar OS
  const { data: serviceOrder, isLoading, error } = useQuery({
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

  // Buscar arquivos da OS
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

    if (user) {
      loadFiles();
    }
  }, [id, user]);

  const handleEdit = () => {
    navigate(`/os/${id}/editar`);
  };

  const handleGeneratePDF = async () => {
    if (!serviceOrder) return;
    
    try {
      await generateServiceOrderPDF(serviceOrder);
      toast({
        title: "PDF gerado com sucesso!",
        description: `O PDF da ${serviceOrder.os_number} foi baixado.`,
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

  const handleDelete = async () => {
    if (!id) return;

    setIsDeleting(true);

    try {
      // 1. Deletar todos os arquivos associados primeiro
      if (files.length > 0) {
        // Buscar todos os storage_keys
        const { data: fileRecords, error: fetchError } = await supabase
          .from('service_order_files')
          .select('storage_key')
          .eq('service_order_id', id);

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
            .eq('service_order_id', id);

          if (filesDbError) {
            console.error('Erro ao deletar registros de arquivos:', filesDbError);
          }
        }
      }

      // 2. Deletar a OS
      const { error: osError } = await supabase
        .from('service_orders')
        .delete()
        .eq('id', id);

      if (osError) {
        throw osError;
      }

      // 3. Invalidar cache e redirecionar
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      
      toast({
        title: "OS deletada com sucesso",
        description: `A ordem de serviço foi removida permanentemente.`,
      });

      navigate('/');

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando ordem de serviço...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !serviceOrder) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Ordem de Serviço não encontrada</h1>
            <p className="text-muted-foreground mb-6">
              A ordem de serviço solicitada não existe ou você não tem permissão para visualizá-la.
            </p>
            <Button onClick={() => navigate('/')}>
              Voltar ao Dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const statusInfo = statusConfig[serviceOrder.status];
  const warranty = serviceOrder.warranty_until && isInWarranty(serviceOrder.warranty_until);
  const daysLeft = serviceOrder.warranty_until ? warrantyDaysLeft(serviceOrder.warranty_until) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Header da página */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{serviceOrder.os_number}</h1>
              <p className="text-muted-foreground">
                Criada em {formatDate(serviceOrder.created_at)}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleEdit} variant="outline" className="gap-2">
              <Edit className="h-4 w-4" />
              Editar
            </Button>
            <Button onClick={handleGeneratePDF} variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Gerar PDF
            </Button>
            <Button 
              onClick={() => setShowDeleteDialog(true)} 
              variant="destructive" 
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Deletar
            </Button>
          </div>
        </div>

        {/* Status e Garantia */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Status Atual</CardTitle>
            </CardHeader>
            <CardContent>
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
              <p className="text-sm text-muted-foreground mt-2">
                {statusInfo.description}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Valor do Serviço</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(serviceOrder.repair_value_cents)}
              </div>
            </CardContent>
          </Card>

          {serviceOrder.warranty_until && (
            <Card className={warranty && serviceOrder.status === 'ENTREGUE' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className={`h-5 w-5 ${warranty && serviceOrder.status === 'ENTREGUE' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                  Garantia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge 
                    variant={warranty ? 'default' : 'secondary'}
                    className={warranty && serviceOrder.status === 'ENTREGUE' 
                      ? 'bg-green-600 text-white font-semibold text-base px-3 py-1' 
                      : 'bg-muted text-muted-foreground'}
                  >
                    {warranty && serviceOrder.status === 'ENTREGUE' 
                      ? `✓ Garantia Ativa - ${daysLeft} dias restantes` 
                      : warranty 
                      ? `${daysLeft} dias restantes` 
                      : 'Expirada'}
                  </Badge>
                  <p className={`text-sm mt-2 ${warranty && serviceOrder.status === 'ENTREGUE' ? 'text-green-700 dark:text-green-300 font-medium' : 'text-muted-foreground'}`}>
                    {warranty && serviceOrder.status === 'ENTREGUE' 
                      ? `Garantia válida até ${formatDate(serviceOrder.warranty_until)}` 
                      : `Válida até ${formatDate(serviceOrder.warranty_until)}`}
                  </p>
                  {serviceOrder.delivery_date && (
                    <p className="text-xs text-muted-foreground">
                      Entregue em {formatDate(serviceOrder.delivery_date)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Informações principais */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dados do Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nome Completo</label>
                <p className="text-base">{serviceOrder.customer_full_name}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">CPF</label>
                <p className="text-base">{formatCPF(serviceOrder.customer_cpf)}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Endereço</label>
                <p className="text-base">{serviceOrder.customer_address}</p>
              </div>
            </CardContent>
          </Card>

          {/* Dados do Equipamento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Dados do Equipamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Produto</label>
                <p className="text-base">{productLabels[serviceOrder.product]}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Número de Série</label>
                <p className="text-base font-mono">{serviceOrder.serial_number}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                <p className="text-base">{typeLabels[serviceOrder.type]}</p>
              </div>

              {serviceOrder.authority && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Autoridade</label>
                  <p className="text-base">{authorityLabels[serviceOrder.authority]}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Dados do Serviço */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Dados do Serviço
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Data de Entrada</label>
                <p className="text-base">{formatDate(serviceOrder.entry_date)}</p>
              </div>
              
              {serviceOrder.repair_date && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Data de Conserto</label>
                  <p className="text-base">{formatDate(serviceOrder.repair_date)}</p>
                </div>
              )}
              
              {serviceOrder.delivery_date && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Data de Entrega</label>
                  <p className="text-base">{formatDate(serviceOrder.delivery_date)}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Última Atualização</label>
                <p className="text-base">{formatDate(serviceOrder.updated_at)}</p>
              </div>
            </div>
            
            {serviceOrder.notes && (
              <>
                <Separator className="my-6" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Observações</label>
                  <p className="text-base mt-2 whitespace-pre-wrap">{serviceOrder.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Anexos (fotos/vídeos) */}
        {files.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Anexos (fotos/vídeos)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {files.map((file) => (
                  <a
                    key={file.id}
                    href={file.file_url_signed || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="block group border rounded-md overflow-hidden"
                    title={file.original_name}
                  >
                    {file.mime_type.startsWith('image/') ? (
                      <img
                        src={file.file_url_signed || ''}
                        alt={file.original_name}
                        className="h-32 w-full object-cover group-hover:opacity-90"
                      />
                    ) : (
                      <div className="h-32 w-full flex items-center justify-center text-sm text-muted-foreground px-2 text-center">
                        {file.original_name}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso irá deletar permanentemente a ordem de serviço{' '}
              <strong>{serviceOrder?.os_number}</strong> e todos os arquivos associados a ela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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