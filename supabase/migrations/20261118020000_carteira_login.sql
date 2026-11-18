-- =====================================================================
-- CARTEIRA DIGITAL — FASE 3: LOGIN DO FILIADO (CPF + CÓDIGO NO WHATSAPP)
-- =====================================================================
-- Quem usa estas tabelas é só a Edge Function member-auth, com a service
-- role. RLS ligada e nenhuma policy: pela API ninguém lê nem escreve.
--
-- Fluxo:
--   1. start  : CPF -> gera código de 6 dígitos, guarda o hash aqui e manda
--               pelo WhatsApp (n8n + Uazapi)
--   2. verify : CPF + código -> confere, cria/liga o usuário do Supabase
--               Auth ao filiado e devolve a sessão
-- =====================================================================

CREATE TABLE public.member_login_codes (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id   UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  -- SHA-256 de "<member_id>:<código>". O código em si nunca é gravado.
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  used_at     TIMESTAMPTZ,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_login_codes_member ON public.member_login_codes (member_id, created_at DESC);

-- Toda tentativa (pedir código ou conferir), para limitar abuso por IP e
-- por CPF mesmo quando o CPF não existe
CREATE TABLE public.member_login_events (
  id          BIGSERIAL PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('start', 'verify')),
  cpf         VARCHAR(11),
  ip          TEXT,
  success     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_login_events_ip ON public.member_login_events (ip, created_at DESC);
CREATE INDEX idx_member_login_events_cpf ON public.member_login_events (cpf, created_at DESC);

ALTER TABLE public.member_login_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_login_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.member_login_codes FROM anon, authenticated;
REVOKE ALL ON public.member_login_events FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.member_login_events_id_seq FROM anon, authenticated;

-- Limpeza: códigos e eventos com mais de 30 dias não servem para nada.
-- Chamada pela própria função a cada login (barato com os índices acima).
CREATE OR REPLACE FUNCTION public.purge_member_login_data()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM public.member_login_codes WHERE created_at < now() - interval '30 days';
  DELETE FROM public.member_login_events WHERE created_at < now() - interval '30 days';
$$;

REVOKE EXECUTE ON FUNCTION public.purge_member_login_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_member_login_data() TO service_role;
