-- Restaura objetos fora do schema public que não vieram na migração para o
-- Supabase self-hosted (25/11/2026): a importação levou só o schema public,
-- então as políticas de storage.objects e o trigger em auth.users sumiram.
-- Sem as políticas, nenhum upload pelo app funcionava (foto do filiado no
-- app e no painel). Idempotente: pode rodar de novo sem efeito.

-- Anexos de OS: só a equipe (fase 0)
DROP POLICY IF EXISTS "Equipe acessa anexos de OS" ON storage.objects;
CREATE POLICY "Equipe acessa anexos de OS"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'os-attachments' AND public.is_staff())
WITH CHECK (bucket_id = 'os-attachments' AND public.is_staff());

-- Fotos dos filiados: a equipe acessa todas, o filiado só a pasta dele
DROP POLICY IF EXISTS "Equipe acessa fotos de filiados" ON storage.objects;
CREATE POLICY "Equipe acessa fotos de filiados"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'member-photos' AND public.is_staff())
WITH CHECK (bucket_id = 'member-photos' AND public.is_staff());

DROP POLICY IF EXISTS "Filiado acessa a própria foto" ON storage.objects;
CREATE POLICY "Filiado acessa a própria foto"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'member-photos'
  AND (storage.foldername(name))[1] = (SELECT public.current_member_id())::text
)
WITH CHECK (
  bucket_id = 'member-photos'
  AND (storage.foldername(name))[1] = (SELECT public.current_member_id())::text
);

-- Perfil automático para cada usuário novo (papel padrão MEMBER; a equipe
-- é promovida à mão para STAFF/ADMIN)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Usuários criados enquanto o trigger faltava
INSERT INTO public.profiles (id, full_name)
SELECT u.id, u.raw_user_meta_data ->> 'full_name'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);
