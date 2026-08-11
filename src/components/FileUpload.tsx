import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, File, Download, Trash2, Image, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface StagingFile {
  id: string;
  storage_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}

interface FileInfo {
  id: string;
  service_order_id: string;
  storage_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  file_url_signed?: string | null;
  created_at: string;
}

interface FileUploadProps {
  serviceOrderId?: string;
  uploadSessionId?: string;
  files: FileInfo[] | StagingFile[];
  onFilesChange: (files: FileInfo[] | StagingFile[]) => void;
  disabled?: boolean;
  mode?: 'staging' | 'persistent';
}

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/quicktime'
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILES = 10;

export function FileUpload({ 
  serviceOrderId, 
  uploadSessionId,
  files, 
  onFilesChange, 
  disabled,
  mode = 'persistent'
}: FileUploadProps) {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Tipo de arquivo não permitido. Use apenas JPG, PNG, WebP, MP4 ou MOV.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'Arquivo muito grande. Máximo 25MB por arquivo.';
    }
    if (files.length >= MAX_FILES) {
      return 'Máximo 10 arquivos por ordem de serviço.';
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    const validation = validateFile(file);
    if (validation) {
      toast({
        title: "Arquivo inválido",
        description: validation,
        variant: "destructive",
      });
      return;
    }

    const fileId = crypto.randomUUID();
    setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const formData = new FormData();
      formData.append('file', file);

      // Simular progresso de upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: Math.min((prev[fileId] || 0) + 10, 90)
        }));
      }, 100);

      let response;
      
      if (mode === 'staging' && uploadSessionId) {
        // Upload para staging
        response = await fetch(
          `https://utwujmzfwpyixczstdjw.supabase.co/functions/v1/upload-to-staging/${uploadSessionId}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: formData,
          }
        );
      } else if (mode === 'persistent' && serviceOrderId) {
        // Upload direto para OS
        response = await fetch(
          `https://utwujmzfwpyixczstdjw.supabase.co/functions/v1/upload-os-file/${serviceOrderId}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: formData,
          }
        );
      } else {
        throw new Error('Configuração inválida de upload');
      }

      clearInterval(progressInterval);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro no upload');
      }

      const result = await response.json();
      
      setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));
      
      // Adicionar arquivo à lista
      if (mode === 'staging') {
        onFilesChange([...files, result.file as StagingFile]);
      } else {
        // Buscar arquivos atualizados para modo persistente
        await refreshFiles();
      }

      toast({
        title: "Sucesso",
        description: "Arquivo enviado com sucesso!",
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      // Remover progresso após 2 segundos
      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      }, 2000);
    }
  };

  const refreshFiles = async () => {
    if (!serviceOrderId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `https://utwujmzfwpyixczstdjw.supabase.co/functions/v1/get-os-files/${serviceOrderId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        onFilesChange(result.files || []);
      }
    } catch (error) {
      console.error('Error refreshing files:', error);
    }
  };

  const deleteFile = async (fileId: string) => {
    if (mode === 'staging') {
      // Remover do estado local em modo staging
      onFilesChange(files.filter(f => f.id !== fileId));
      toast({
        title: "Sucesso",
        description: "Arquivo removido com sucesso!",
      });
      return;
    }

    if (!serviceOrderId) {
      toast({
        title: "Erro",
        description: "ID da ordem de serviço não encontrado",
        variant: "destructive",
      });
      return;
    }

    if (!fileId) {
      toast({
        title: "Erro",
        description: "ID do arquivo não encontrado",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Deletando arquivo:', { osId: serviceOrderId, fileId });

      // Buscar informações do arquivo primeiro
      const { data: fileData, error: fetchError } = await supabase
        .from('service_order_files')
        .select('storage_key')
        .eq('id', fileId)
        .eq('service_order_id', serviceOrderId)
        .single();

      if (fetchError || !fileData) {
        throw new Error('Arquivo não encontrado no banco de dados');
      }

      // Deletar do storage
      const { error: storageError } = await supabase.storage
        .from('os-attachments')
        .remove([fileData.storage_key]);

      if (storageError) {
        console.error('Storage error:', storageError);
        throw new Error('Erro ao deletar arquivo do storage');
      }

      // Deletar do banco de dados
      const { error: dbError } = await supabase
        .from('service_order_files')
        .delete()
        .eq('id', fileId)
        .eq('service_order_id', serviceOrderId);

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error('Erro ao deletar registro do banco de dados');
      }

      // Atualizar UI
      onFilesChange(files.filter((f: any) => f.id !== fileId));
      await refreshFiles();
      
      toast({
        title: "Sucesso",
        description: "Arquivo removido com sucesso!",
      });

    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível remover o arquivo.",
        variant: "destructive",
      });
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    droppedFiles.forEach(uploadFile);
  }, [disabled]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    const selectedFiles = Array.from(e.target.files || []);
    selectedFiles.forEach(uploadFile);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    if (mimeType.startsWith('video/')) {
      return <Video className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  const downloadFile = (file: FileInfo) => {
    if ('file_url_signed' in file && file.file_url_signed) {
      const link = document.createElement('a');
      link.href = file.file_url_signed;
      link.download = file.original_name;
      link.target = '_blank';
      link.click();
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card 
        className={cn(
          "border-2 border-dashed transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <Upload className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Anexar fotos e vídeos</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Arraste arquivos aqui ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Máximo 10 arquivos • 25MB por arquivo • JPG, PNG, WebP, MP4, MOV
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />
          
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            Selecionar Arquivos
          </Button>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {Object.entries(uploadProgress).length > 0 && (
        <div className="space-y-2">
          {Object.entries(uploadProgress).map(([fileId, progress]) => (
            <div key={fileId} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Enviando arquivo...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          ))}
        </div>
      )}

      {/* Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Arquivos anexados ({files.length}/10)</h4>
          <div className="grid gap-2">
            {files.map((file) => (
              <Card key={file.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {getFileIcon(file.mime_type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {file.original_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size_bytes)}
                        {'created_at' in file && ` • ${new Date(file.created_at).toLocaleDateString('pt-BR')}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {mode === 'persistent' && 'file_url_signed' in file && file.file_url_signed && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => downloadFile(file as FileInfo)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => deleteFile(file.id)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
