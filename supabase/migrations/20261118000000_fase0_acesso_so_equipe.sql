-- =====================================================================
-- FASE 0 DA CARTEIRA DIGITAL: SÓ A EQUIPE ACESSA OS DADOS DE OS
-- =====================================================================
-- Até aqui toda policy era "auth.uid() IS NOT NULL": qualquer conta
-- logada lia e alterava toda a base de OS. Os filiados vão logar neste
-- mesmo Supabase (app da carteira), então o acesso passa a depender de
-- public.is_staff(), que olha profiles.role.
--
--   STAFF / ADMIN -> equipe da Conarmas, acesso total ao app de OS
--   MEMBER        -> qualquer outra conta (filiados, cadastros soltos)
--
-- Para dar acesso a alguém novo da equipe, no SQL editor:
--   UPDATE public.profiles SET role = 'STAFF' WHERE id = '<uuid do usuário>';
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PAPÉIS
-- ---------------------------------------------------------------------

-- Toda conta criada daqui em diante nasce sem acesso à OS
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'MEMBER';

-- Contas antigas sem linha em profiles (criadas antes do trigger, por
-- exemplo) ganham uma, para não perderem o acesso
INSERT INTO public.profiles (id, full_name, role)
SELECT u.id, u.raw_user_meta_data ->> 'full_name', 'USER'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- Até hoje só existia o app de OS, então quem já tinha conta com e-mail
-- confirmado é da equipe. Contas nunca confirmadas não entravam no
-- sistema e viram MEMBER. ADMIN, se existir, fica como está.
UPDATE public.profiles p
SET role = CASE
             WHEN EXISTS (
               SELECT 1 FROM auth.users u
               WHERE u.id = p.id AND u.email_confirmed_at IS NOT NULL
             ) THEN 'STAFF'
             ELSE 'MEMBER'
           END
WHERE p.role IS NULL OR p.role NOT IN ('STAFF', 'ADMIN');

ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('STAFF', 'ADMIN', 'MEMBER'));


-- ---------------------------------------------------------------------
-- 2. is_staff()
-- ---------------------------------------------------------------------
-- SECURITY DEFINER para ler profiles sem cair na própria RLS de profiles
-- (que também usa esta função).

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('STAFF', 'ADMIN')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;


-- ---------------------------------------------------------------------
-- 3. NINGUÉM SE PROMOVE SOZINHO
-- ---------------------------------------------------------------------
-- O usuário pode editar o próprio profile (nome), mas o papel só muda
-- pelo SQL editor, por migration ou pela service role. Chamadas da API
-- com a chave anon ou com o login do usuário rodam como os papéis
-- "anon"/"authenticated" e são barradas aqui.

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' AND NEW.role IS DISTINCT FROM 'MEMBER' THEN
      RAISE EXCEPTION 'Sem permissão para definir o papel do usuário';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Sem permissão para alterar o papel do usuário';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_profile_role ON public.profiles;
CREATE TRIGGER trigger_protect_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();


-- ---------------------------------------------------------------------
-- 4. POLICIES DAS TABELAS DA OS
-- ---------------------------------------------------------------------
-- Remove todas as policies atuais (inclusive as que tenham sido criadas
-- pelo painel e não estejam nas migrations) e cria uma só, para a equipe.

DO $$
DECLARE
  tabela text;
  pol record;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'service_orders',
    'service_order_items',
    'service_order_files',
    'customers',
    'settings',
    'option_lists'
  ]
  LOOP
    IF to_regclass('public.' || tabela) IS NULL THEN
      RAISE NOTICE 'Tabela public.% não existe, pulando', tabela;
      CONTINUE;
    END IF;

    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tabela
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, tabela);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabela);
    EXECUTE format(
      'CREATE POLICY "Equipe tem acesso total" ON public.%I
         FOR ALL TO authenticated
         USING (public.is_staff())
         WITH CHECK (public.is_staff())',
      tabela
    );
  END LOOP;
END;
$$;


-- ---------------------------------------------------------------------
-- 5. PROFILES
-- ---------------------------------------------------------------------
-- Cada um vê e edita o próprio (o papel está protegido pelo trigger),
-- a equipe vê todos. Ninguém cria nem apaga pela API: a linha nasce
-- pelo trigger handle_new_user.

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', pol.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "Usuário vê o próprio perfil e a equipe vê todos"
ON public.profiles FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) OR public.is_staff());

CREATE POLICY "Usuário edita o próprio perfil"
ON public.profiles FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));


-- ---------------------------------------------------------------------
-- 6. STORAGE: ANEXOS DE OS
-- ---------------------------------------------------------------------

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (coalesce(qual, '') LIKE '%os-attachments%'
           OR coalesce(with_check, '') LIKE '%os-attachments%')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "Equipe acessa anexos de OS"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'os-attachments' AND public.is_staff())
WITH CHECK (bucket_id = 'os-attachments' AND public.is_staff());


-- ---------------------------------------------------------------------
-- 7. TABELAS FORA DAS MIGRATIONS
-- ---------------------------------------------------------------------
-- O banco tem tabelas criadas direto pelo painel (ex.: "FollowUP").
-- Qualquer policy que ainda libere "qualquer usuário logado" passa a
-- exigir equipe, mantendo o tipo de operação. Tabelas do public sem RLS
-- só geram aviso no log, para não quebrar integrações que dependem delas.

DO $$
DECLARE
  pol record;
  tab record;
  clausulas text;
BEGIN
  FOR pol IN
    SELECT tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (replace(coalesce(qual, ''), ' ', '') ILIKE '%auth.uid()ISNOTNULL%'
           OR replace(coalesce(with_check, ''), ' ', '') ILIKE '%auth.uid()ISNOTNULL%')
  LOOP
    clausulas := CASE pol.cmd
      WHEN 'INSERT' THEN 'WITH CHECK (public.is_staff())'
      WHEN 'SELECT' THEN 'USING (public.is_staff())'
      WHEN 'DELETE' THEN 'USING (public.is_staff())'
      ELSE 'USING (public.is_staff()) WITH CHECK (public.is_staff())'
    END;

    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR %s TO authenticated %s',
      pol.policyname, pol.tablename, pol.cmd, clausulas
    );
    RAISE NOTICE 'Policy "%" em public.% agora exige equipe', pol.policyname, pol.tablename;
  END LOOP;

  FOR tab IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    RAISE NOTICE 'ATENÇÃO: public.% está sem RLS', tab.relname;
  END LOOP;
END;
$$;
