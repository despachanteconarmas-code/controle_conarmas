-- Criar tabela para arquivos das OSs
CREATE TABLE public.service_order_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para melhor performance
CREATE INDEX idx_service_order_files_service_order_id ON public.service_order_files(service_order_id);

-- RLS para service_order_files
ALTER TABLE public.service_order_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view files" 
ON public.service_order_files 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create files" 
ON public.service_order_files 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete files" 
ON public.service_order_files 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Criar bucket para anexos das OSs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('os-attachments', 'os-attachments', false);

-- Políticas para o bucket os-attachments
CREATE POLICY "Authenticated users can view files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'os-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'os-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'os-attachments' AND auth.uid() IS NOT NULL);