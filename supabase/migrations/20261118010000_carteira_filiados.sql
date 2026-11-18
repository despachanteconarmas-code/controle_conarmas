-- =====================================================================
-- CARTEIRA DIGITAL — FASE 1: FILIADOS, ARMAS E GUIAS DE TRÁFEGO
-- =====================================================================
-- Escopo: carteira-digital/ESCOPO.md (v2). Filiado é um cadastro próprio,
-- separado de customers (clientes de OS).
--
-- Quem acessa o quê:
--   equipe (is_staff)  -> tudo
--   filiado logado     -> só os próprios dados. Pode cadastrar e editar
--                         armas, GTs, validade do CR e a foto. Não mexe em
--                         nº de filiação, vencimento, nome nem CPF.
--   público            -> nada (a página do QR passa por Edge Function)
--
-- Situação (ATIVA / VENCE EM X DIAS / VENCIDA) é sempre calculada a partir
-- da data, nunca digitada. Ver public.expiry_status().
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. LISTA "TIPO DE ARMA" (mesmo mecanismo de calibre e marca da OS)
-- ---------------------------------------------------------------------

ALTER TABLE public.option_lists
  DROP CONSTRAINT IF EXISTS option_lists_category_check;

ALTER TABLE public.option_lists
  ADD CONSTRAINT option_lists_category_check
  CHECK (category IN (
    'product', 'type', 'authority', 'service_item', 'caliber', 'brand',
    'firearm_type'
  ));

INSERT INTO public.option_lists (category, value, label, position) VALUES
  ('firearm_type', 'PISTOLA',    'Pistola',    1),
  ('firearm_type', 'REVOLVER',   'Revólver',   2),
  ('firearm_type', 'CARABINA',   'Carabina',   3),
  ('firearm_type', 'ESPINGARDA', 'Espingarda', 4),
  ('firearm_type', 'FUZIL',      'Fuzil',      5),
  ('firearm_type', 'RIFLE',      'Rifle',      6)
ON CONFLICT (category, value) DO NOTHING;


-- ---------------------------------------------------------------------
-- 2. SITUAÇÃO DE UMA DATA DE VENCIMENTO (regra da seção 4.2)
-- ---------------------------------------------------------------------
--   VENCIDA    vencimento < hoje
--   VENCENDO   hoje <= vencimento < hoje + 30 dias
--   ATIVA      vencimento >= hoje + 30 dias
--   SEM_DATA   validade não informada

CREATE OR REPLACE FUNCTION public.expiry_status(expires_at date)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN expires_at IS NULL THEN 'SEM_DATA'
    WHEN expires_at < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'VENCIDA'
    WHEN expires_at < (now() AT TIME ZONE 'America/Sao_Paulo')::date + 30 THEN 'VENCENDO'
    ELSE 'ATIVA'
  END;
$$;


-- ---------------------------------------------------------------------
-- 3. TABELAS
-- ---------------------------------------------------------------------

CREATE TABLE public.members (
  id                    UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Nº de filiação = nº do cliente no sistema antigo. Nunca muda.
  member_number         INTEGER NOT NULL UNIQUE CHECK (member_number > 0),
  full_name             VARCHAR(255) NOT NULL,
  cpf                   VARCHAR(11) NOT NULL UNIQUE CHECK (cpf ~ '^[0-9]{11}$'),
  phone                 VARCHAR(11) CHECK (phone ~ '^[0-9]{10,11}$'), -- WhatsApp, usado no login
  email                 VARCHAR(255),
  cr_number             VARCHAR(30),
  cr_expires_at         DATE,
  -- Dia e mês fixos para sempre; a renovação só muda o ano
  membership_expires_at DATE NOT NULL,
  photo_path            TEXT, -- bucket privado member-photos
  auth_user_id          UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Código do QR público. Aleatório (122 bits) e regenerável.
  verify_token          VARCHAR(32) NOT NULL UNIQUE
                        DEFAULT replace(gen_random_uuid()::text, '-', ''),
  legacy_id             TEXT, -- id no sistema antigo (importação)
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_members_full_name ON public.members (full_name);
CREATE INDEX idx_members_membership_expires_at ON public.members (membership_expires_at);

CREATE TABLE public.membership_renewals (
  id                  UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id           UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  paid_at             DATE NOT NULL,
  years               INTEGER NOT NULL CHECK (years BETWEEN 1 AND 10),
  previous_expires_at DATE NOT NULL,
  new_expires_at      DATE NOT NULL,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_membership_renewals_member ON public.membership_renewals (member_id, created_at DESC);

CREATE TABLE public.member_firearms (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id        UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  type             VARCHAR(50),  -- option_lists 'firearm_type'
  brand            VARCHAR(50),  -- option_lists 'brand', igual à OS
  model            VARCHAR(255),
  sigma_number     VARCHAR(50),
  caliber          VARCHAR(50),  -- option_lists 'caliber', igual à OS
  restriction      VARCHAR(10) CHECK (restriction IN ('PERMITIDO', 'RESTRITO')),
  sigma_expires_at DATE,         -- validade do CRAF
  position         INTEGER NOT NULL DEFAULT 0, -- ordem (PS 1, PS 2...)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_member_firearms_member ON public.member_firearms (member_id, position);

CREATE TABLE public.traffic_guides (
  id                  UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  firearm_id          UUID NOT NULL REFERENCES public.member_firearms(id) ON DELETE CASCADE,
  destination_address TEXT NOT NULL,
  guide_number        VARCHAR(50),
  issued_at           DATE,
  -- Padrão: emissão + 6 meses (preenchido pelo trigger se vier vazio)
  expires_at          DATE NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_traffic_guides_firearm ON public.traffic_guides (firearm_id);

-- Configurações da carteirinha (linha única, id = 1)
CREATE TABLE public.card_settings (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  club_name   TEXT NOT NULL DEFAULT 'Clube de Tiro Conarmas',
  club_cr     TEXT NOT NULL DEFAULT '396.674',
  address     TEXT,
  whatsapp    TEXT,
  instagram   TEXT,
  website     TEXT,
  email       TEXT,
  legal_text  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Endereço fica em branco até o Matheus confirmar 175 ou 179 (pendência 4)
INSERT INTO public.card_settings (id, legal_text) VALUES (
  1,
  'Esta carteira comprova a filiação ao clube e não dispensa o porte do CR, '
  || 'do CRAF, da Guia de Tráfego e de documento de identidade durante o '
  || 'transporte do acervo.'
);


-- ---------------------------------------------------------------------
-- 4. TRIGGERS
-- ---------------------------------------------------------------------

-- updated_at + updated_by (quem alterou: equipe ou o próprio filiado)
CREATE OR REPLACE FUNCTION public.touch_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_members_touch
  BEFORE INSERT OR UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_by();

CREATE TRIGGER trigger_member_firearms_touch
  BEFORE INSERT OR UPDATE ON public.member_firearms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_by();

CREATE TRIGGER trigger_traffic_guides_touch
  BEFORE INSERT OR UPDATE ON public.traffic_guides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_by();

CREATE TRIGGER trigger_card_settings_touch
  BEFORE INSERT OR UPDATE ON public.card_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_by();

-- Nº de filiação automático para filiado novo: maior + 1
CREATE OR REPLACE FUNCTION public.assign_member_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.member_number IS NULL THEN
    -- Serializa cadastros simultâneos para não gerar o mesmo número
    PERFORM pg_advisory_xact_lock(hashtext('members.member_number'));
    SELECT COALESCE(MAX(member_number), 0) + 1 INTO NEW.member_number
    FROM public.members;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_members_number
  BEFORE INSERT ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.assign_member_number();

-- GT: validade padrão = emissão + 6 meses
CREATE OR REPLACE FUNCTION public.default_guide_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.expires_at IS NULL AND NEW.issued_at IS NOT NULL THEN
    NEW.expires_at := (NEW.issued_at + interval '6 months')::date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_traffic_guides_default_expiry
  BEFORE INSERT OR UPDATE ON public.traffic_guides
  FOR EACH ROW EXECUTE FUNCTION public.default_guide_expiry();

-- O filiado só altera, no próprio cadastro, a validade do CR e a foto.
-- Nº, vencimento da filiação, nome, CPF etc. são da Conarmas.
CREATE OR REPLACE FUNCTION public.protect_member_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT public.is_staff() THEN
    IF TG_OP = 'INSERT' OR TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Sem permissão para esta operação';
    END IF;
    IF (NEW.member_number, NEW.full_name, NEW.cpf, NEW.phone, NEW.email,
        NEW.cr_number, NEW.membership_expires_at, NEW.auth_user_id,
        NEW.verify_token, NEW.legacy_id, NEW.notes)
       IS DISTINCT FROM
       (OLD.member_number, OLD.full_name, OLD.cpf, OLD.phone, OLD.email,
        OLD.cr_number, OLD.membership_expires_at, OLD.auth_user_id,
        OLD.verify_token, OLD.legacy_id, OLD.notes) THEN
      RAISE EXCEPTION 'O filiado só pode alterar a validade do CR e a foto';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_members_protect
  BEFORE INSERT OR UPDATE OR DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.protect_member_columns();

-- O filiado não move arma nem GT para o cadastro de outra pessoa
CREATE OR REPLACE FUNCTION public.protect_firearm_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.member_id IS DISTINCT FROM OLD.member_id
     AND current_user IN ('anon', 'authenticated') AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'Sem permissão para transferir a arma';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_member_firearms_protect
  BEFORE UPDATE ON public.member_firearms
  FOR EACH ROW EXECUTE FUNCTION public.protect_firearm_owner();


-- ---------------------------------------------------------------------
-- 5. RENOVAÇÃO (regra da seção 4.1)
-- ---------------------------------------------------------------------
-- novo vencimento = vencimento atual + N anos, independente da data do
-- pagamento. Ex.: vence 30/03/2026, paga 15/05/2026 -> 30/03/2027.

CREATE OR REPLACE FUNCTION public.renew_membership(
  p_member_id UUID,
  p_paid_at   DATE,
  p_years     INTEGER DEFAULT 1
)
RETURNS public.membership_renewals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_previous DATE;
  v_new      DATE;
  v_renewal  public.membership_renewals;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Apenas a equipe pode renovar filiações';
  END IF;
  IF p_years IS NULL OR p_years NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Quantidade de anos inválida';
  END IF;

  SELECT membership_expires_at INTO v_previous
  FROM public.members WHERE id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Filiado não encontrado';
  END IF;

  v_new := (v_previous + make_interval(years => p_years))::date;

  UPDATE public.members
  SET membership_expires_at = v_new
  WHERE id = p_member_id;

  INSERT INTO public.membership_renewals
    (member_id, paid_at, years, previous_expires_at, new_expires_at, created_by)
  VALUES
    (p_member_id, p_paid_at, p_years, v_previous, v_new, auth.uid())
  RETURNING * INTO v_renewal;

  RETURN v_renewal;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.renew_membership(UUID, DATE, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_membership(UUID, DATE, INTEGER) TO authenticated;

-- Novo código de QR (carteirinha perdida): o QR antigo para de funcionar
CREATE OR REPLACE FUNCTION public.regenerate_verify_token(p_member_id UUID)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text := replace(gen_random_uuid()::text, '-', '');
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Apenas a equipe pode gerar um novo QR';
  END IF;
  UPDATE public.members SET verify_token = v_token WHERE id = p_member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Filiado não encontrado';
  END IF;
  RETURN v_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.regenerate_verify_token(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_verify_token(UUID) TO authenticated;


-- ---------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------

-- id do filiado logado (NULL para equipe e demais contas)
CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.members WHERE auth_user_id = (SELECT auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.current_member_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_member_id() TO authenticated, service_role;

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_firearms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_settings ENABLE ROW LEVEL SECURITY;

-- members
CREATE POLICY "Equipe tem acesso total" ON public.members
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Filiado vê o próprio cadastro" ON public.members
  FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));
CREATE POLICY "Filiado atualiza o próprio cadastro" ON public.members
  FOR UPDATE TO authenticated
  USING (auth_user_id = (SELECT auth.uid()))
  WITH CHECK (auth_user_id = (SELECT auth.uid()));

-- membership_renewals: lançadas só pela renew_membership()
CREATE POLICY "Equipe vê as renovações" ON public.membership_renewals
  FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "Equipe corrige renovações" ON public.membership_renewals
  FOR DELETE TO authenticated
  USING (public.is_staff());
CREATE POLICY "Filiado vê as próprias renovações" ON public.membership_renewals
  FOR SELECT TO authenticated
  USING (member_id = (SELECT public.current_member_id()));

-- member_firearms
CREATE POLICY "Equipe tem acesso total" ON public.member_firearms
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Filiado gerencia as próprias armas" ON public.member_firearms
  FOR ALL TO authenticated
  USING (member_id = (SELECT public.current_member_id()))
  WITH CHECK (member_id = (SELECT public.current_member_id()));

-- traffic_guides
CREATE POLICY "Equipe tem acesso total" ON public.traffic_guides
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Filiado gerencia as próprias GTs" ON public.traffic_guides
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.member_firearms f
    WHERE f.id = firearm_id AND f.member_id = (SELECT public.current_member_id())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.member_firearms f
    WHERE f.id = firearm_id AND f.member_id = (SELECT public.current_member_id())
  ));

-- card_settings: todo logado lê (o app do filiado monta a carteirinha)
CREATE POLICY "Logados leem as configurações da carteirinha" ON public.card_settings
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Equipe altera as configurações da carteirinha" ON public.card_settings
  FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());


-- ---------------------------------------------------------------------
-- 7. VIEWS (security_invoker: respeitam a RLS de quem consulta)
-- ---------------------------------------------------------------------

-- Lista de filiados com a situação já calculada
CREATE VIEW public.member_overview
WITH (security_invoker = true) AS
SELECT
  m.*,
  public.expiry_status(m.membership_expires_at) AS membership_status,
  public.expiry_status(m.cr_expires_at)         AS cr_status,
  (SELECT count(*) FROM public.member_firearms f WHERE f.member_id = m.id)::int
                                                AS firearm_count
FROM public.members m;

-- Rótulo de uma opção ("PISTOLA" -> "Pistola"); devolve o código se não achar
CREATE OR REPLACE FUNCTION public.option_label(p_category text, p_value text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT label FROM public.option_lists WHERE category = p_category AND value = p_value),
    p_value
  );
$$;

-- Tudo que vence, um item por linha: filiação, CR, CRAF de cada arma e
-- cada GT. Base do painel de vencimentos e dos avisos da fase 2.
CREATE VIEW public.member_expirations
WITH (security_invoker = true) AS
SELECT m.id AS member_id, m.member_number, m.full_name, m.phone,
       'FILIACAO'::text AS kind, NULL::uuid AS item_id,
       'Filiação'::text AS description,
       m.membership_expires_at AS expires_at,
       public.expiry_status(m.membership_expires_at) AS status
FROM public.members m
UNION ALL
SELECT m.id, m.member_number, m.full_name, m.phone,
       'CR', NULL::uuid,
       'CR ' || COALESCE(m.cr_number, ''),
       m.cr_expires_at, public.expiry_status(m.cr_expires_at)
FROM public.members m
WHERE m.cr_expires_at IS NOT NULL
UNION ALL
SELECT m.id, m.member_number, m.full_name, m.phone,
       'CRAF', f.id,
       concat_ws(' ',
         public.option_label('firearm_type', f.type),
         public.option_label('brand', f.brand),
         f.model,
         '· SIGMA ' || f.sigma_number),
       f.sigma_expires_at, public.expiry_status(f.sigma_expires_at)
FROM public.member_firearms f
JOIN public.members m ON m.id = f.member_id
WHERE f.sigma_expires_at IS NOT NULL
UNION ALL
SELECT m.id, m.member_number, m.full_name, m.phone,
       'GT', g.id,
       concat_ws(' ',
         public.option_label('firearm_type', f.type),
         f.model,
         '→', g.destination_address),
       g.expires_at, public.expiry_status(g.expires_at)
FROM public.traffic_guides g
JOIN public.member_firearms f ON f.id = g.firearm_id
JOIN public.members m ON m.id = f.member_id;

-- O app do filiado mostra tipo, marca e calibre pelo nome, então essas três
-- listas (não sigilosas) ficam legíveis para qualquer conta logada
CREATE POLICY "Logados leem as listas de armas" ON public.option_lists
  FOR SELECT TO authenticated
  USING (category IN ('firearm_type', 'brand', 'caliber'));


-- ---------------------------------------------------------------------
-- 8. FOTOS (bucket privado, pasta por filiado: <member_id>/arquivo)
-- ---------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('member-photos', 'member-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Equipe acessa fotos de filiados"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'member-photos' AND public.is_staff())
WITH CHECK (bucket_id = 'member-photos' AND public.is_staff());

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
