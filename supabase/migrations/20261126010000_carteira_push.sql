-- =====================================================================
-- CARTEIRA DIGITAL — AVISOS DE VENCIMENTO POR NOTIFICAÇÃO (WEB PUSH)
-- =====================================================================
-- O filiado ativa os avisos no app (PWA) e cada aparelho vira uma
-- inscrição. A Edge Function member-push roda todo dia e manda os mesmos
-- avisos do WhatsApp (30, 15, 7 dias e no dia), com registro próprio:
-- push e WhatsApp são canais independentes, um não bloqueia o outro.
-- =====================================================================

CREATE TABLE public.member_push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at  TIMESTAMPTZ,
  failures      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_member_push_subscriptions_member ON public.member_push_subscriptions (member_id);

ALTER TABLE public.member_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Leitura: a equipe vê todas (ficha do filiado); o filiado, as dele.
-- Gravação só pelas funções abaixo.
CREATE POLICY "Equipe vê inscrições de aviso" ON public.member_push_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "Filiado vê as próprias inscrições" ON public.member_push_subscriptions
  FOR SELECT TO authenticated
  USING (member_id = (SELECT public.current_member_id()));

REVOKE INSERT, UPDATE, DELETE ON public.member_push_subscriptions FROM anon, authenticated;

/** O filiado logado ativa os avisos neste aparelho (endpoint do navegador) */
CREATE OR REPLACE FUNCTION public.save_push_subscription(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member uuid := public.current_member_id();
BEGIN
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Só o filiado pode ativar avisos';
  END IF;
  IF coalesce(p_endpoint, '') !~ '^https://' OR coalesce(p_p256dh, '') = '' OR coalesce(p_auth, '') = '' THEN
    RAISE EXCEPTION 'Inscrição inválida';
  END IF;

  -- Mesmo aparelho com outro filiado logado: a inscrição passa para ele
  INSERT INTO public.member_push_subscriptions (member_id, endpoint, p256dh, auth, user_agent)
  VALUES (v_member, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  ON CONFLICT (endpoint) DO UPDATE
    SET member_id = EXCLUDED.member_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        failures = 0;
END;
$$;

/** O filiado desativa os avisos neste aparelho */
CREATE OR REPLACE FUNCTION public.delete_push_subscription(p_endpoint text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM public.member_push_subscriptions
  WHERE endpoint = p_endpoint AND member_id = public.current_member_id();
$$;

REVOKE EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_push_subscription(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription(text) TO authenticated;

-- ---------------------------------------------------------------------
-- Registro de avisos por canal
-- ---------------------------------------------------------------------

ALTER TABLE public.member_reminders_log
  ADD COLUMN channel TEXT NOT NULL DEFAULT 'whatsapp'
  CHECK (channel IN ('whatsapp', 'push'));

DO $$
DECLARE
  c text;
BEGIN
  -- A unicidade antiga não tinha o canal: troca pela nova
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'public.member_reminders_log'::regclass AND contype = 'u';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.member_reminders_log DROP CONSTRAINT %I', c);
  END IF;
END;
$$;

ALTER TABLE public.member_reminders_log
  ADD CONSTRAINT member_reminders_log_unique UNIQUE (channel, kind, item_key, expires_at, bucket);

-- Mesma regra do WhatsApp, agora com o canal. WhatsApp: quem tem telefone.
-- Push: quem tem ao menos um aparelho inscrito.
DROP FUNCTION public.claim_expiry_reminders(boolean);

CREATE FUNCTION public.claim_expiry_reminders(p_dry_run boolean DEFAULT false, p_channel text DEFAULT 'whatsapp')
RETURNS TABLE (member_id uuid, member_number integer, full_name text, phone text, items jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF p_channel NOT IN ('whatsapp', 'push') THEN
    RAISE EXCEPTION 'Canal inválido: %', p_channel;
  END IF;

  -- O INSERT do CTE "logged" roda mesmo sem ser lido no SELECT final
  RETURN QUERY
  WITH due AS (
    SELECT e.member_id, e.member_number, e.full_name, e.phone, e.kind,
           COALESCE(e.item_id::text, e.member_id::text) AS item_key,
           e.description, e.expires_at,
           (e.expires_at - v_today) AS days_left,
           public.reminder_bucket(e.expires_at - v_today) AS bucket
    FROM public.member_expirations e
    WHERE e.expires_at BETWEEN v_today AND v_today + 30
      AND CASE p_channel
            WHEN 'whatsapp' THEN e.phone IS NOT NULL
            ELSE EXISTS (SELECT 1 FROM public.member_push_subscriptions s WHERE s.member_id = e.member_id)
          END
  ),
  fresh AS (
    SELECT d.* FROM due d
    WHERE NOT EXISTS (
      SELECT 1 FROM public.member_reminders_log l
      WHERE l.channel = p_channel
        AND l.kind = d.kind AND l.item_key = d.item_key
        AND l.expires_at = d.expires_at AND l.bucket = d.bucket
    )
  ),
  logged AS (
    INSERT INTO public.member_reminders_log (member_id, channel, kind, item_key, expires_at, bucket)
    SELECT f.member_id, p_channel, f.kind, f.item_key, f.expires_at, f.bucket FROM fresh f
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

REVOKE EXECUTE ON FUNCTION public.claim_expiry_reminders(boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_expiry_reminders(boolean, text) TO service_role;
