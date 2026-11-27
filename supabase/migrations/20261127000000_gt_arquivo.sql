-- =====================================================================
-- Arquivo da GT (PDF ou foto da guia)
-- =====================================================================
-- Bucket privado member-documents, uma pasta por filiado:
--   <member_id>/gt/<arquivo>
-- A equipe acessa tudo; o filiado só a própria pasta (igual à foto).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'member-documents', 'member-documents', false, 10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Equipe acessa documentos de filiados"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'member-documents' AND public.is_staff())
WITH CHECK (bucket_id = 'member-documents' AND public.is_staff());

CREATE POLICY "Filiado acessa os próprios documentos"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'member-documents'
  AND (storage.foldername(name))[1] = (SELECT public.current_member_id())::text
)
WITH CHECK (
  bucket_id = 'member-documents'
  AND (storage.foldername(name))[1] = (SELECT public.current_member_id())::text
);

ALTER TABLE public.traffic_guides
  ADD COLUMN file_path TEXT,          -- caminho no bucket member-documents
  ADD COLUMN file_name TEXT,          -- nome original, para mostrar
  ADD COLUMN file_type VARCHAR(100);  -- MIME, para o ícone
