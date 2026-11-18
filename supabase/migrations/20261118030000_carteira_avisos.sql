-- =====================================================================
-- CARTEIRA DIGITAL — AVISOS DE VENCIMENTO PELO WHATSAPP
-- =====================================================================
-- Filiação, CR, CRAF e GT vencendo em 30, 15 e 7 dias e no dia.
-- Quem chama é a Edge Function member-reminders (service role), acionada
-- todo dia pelo n8n. Cada item é avisado uma vez por faixa: se o n8n
-- falhar num dia, o aviso sai no dia seguinte, sem repetir.
-- =====================================================================

CREATE TABLE public.member_reminders_log (
  id          BIGSERIAL PRIMARY KEY,
  member_id   UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,          -- FILIACAO | CR | CRAF | GT
  item_key    TEXT NOT NULL,          -- id da arma/GT, ou do filiado
  expires_at  DATE NOT NULL,          -- renovou = data nova = avisa de novo
  bucket      INTEGER NOT NULL,       -- 30 | 15 | 7 | 0
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, item_key, expires_at, bucket)
);

CREATE INDEX idx_member_reminders_log_member ON public.member_reminders_log (member_id, sent_at DESC);

ALTER TABLE public.member_reminders_log ENABLE ROW LEVEL SECURITY;

-- A equipe pode consultar o que foi avisado; ninguém grava pela API
CREATE POLICY "Equipe vê os avisos enviados" ON public.member_reminders_log
  FOR SELECT TO authenticated
  USING (public.is_staff());

REVOKE INSERT, UPDATE, DELETE ON public.member_reminders_log FROM anon, authenticated;

-- Faixa do aviso: 0 (hoje), 7, 15 ou 30 dias
CREATE OR REPLACE FUNCTION public.reminder_bucket(days_left integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN days_left = 0 THEN 0
    WHEN days_left BETWEEN 1 AND 7 THEN 7
    WHEN days_left BETWEEN 8 AND 15 THEN 15
    WHEN days_left BETWEEN 16 AND 30 THEN 30
  END;
$$;

/**
 * Separa os avisos do dia, um registro por filiado com todos os itens
 * dele, e (fora do modo de teste) marca como enviados.
 */
CREATE OR REPLACE FUNCTION public.claim_expiry_reminders(p_dry_run boolean DEFAULT false)
RETURNS TABLE (member_id uuid, member_number integer, full_name text, phone text, items jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  -- O INSERT do CTE "logged" roda mesmo sem ser lido no SELECT final
  RETURN QUERY
  WITH due AS (
    SELECT e.member_id, e.member_number, e.full_name, e.phone, e.kind,
           COALESCE(e.item_id::text, e.member_id::text) AS item_key,
           e.description, e.expires_at,
           (e.expires_at - v_today) AS days_left,
           public.reminder_bucket(e.expires_at - v_today) AS bucket
    FROM public.member_expirations e
    WHERE e.phone IS NOT NULL
      AND e.expires_at BETWEEN v_today AND v_today + 30
  ),
  fresh AS (
    SELECT d.* FROM due d
    WHERE NOT EXISTS (
      SELECT 1 FROM public.member_reminders_log l
      WHERE l.kind = d.kind AND l.item_key = d.item_key
        AND l.expires_at = d.expires_at AND l.bucket = d.bucket
    )
  ),
  logged AS (
    INSERT INTO public.member_reminders_log (member_id, kind, item_key, expires_at, bucket)
    SELECT f.member_id, f.kind, f.item_key, f.expires_at, f.bucket FROM fresh f
    WHERE NOT p_dry_run
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT f.member_id, f.member_number, f.full_name::text, f.phone::text,
         jsonb_agg(jsonb_build_object(
           'kind', f.kind,
           'description', f.description,
           'expires_at', f.expires_at,
           'days_left', f.days_left
         ) ORDER BY f.expires_at, f.kind)
  FROM fresh f
  GROUP BY f.member_id, f.member_number, f.full_name, f.phone
  ORDER BY f.member_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_expiry_reminders(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_expiry_reminders(boolean) TO service_role;
