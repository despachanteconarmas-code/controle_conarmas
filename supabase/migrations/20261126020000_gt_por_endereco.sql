-- =====================================================================
-- Guia de Tráfego (GT) passa a ser do filiado, uma por endereço do acervo
-- =====================================================================
-- Pedido do Matheus (26/11/2026): a GT não é de cada arma. O atirador tem
-- uma GT por endereço (alguns têm dois endereços, logo duas GTs), cada uma
-- com a sua validade e cobrindo o acervo de uso permitido, restrito ou os dois.
--
-- Antes: traffic_guides.firearm_id (GT dentro da arma).
-- Agora: traffic_guides.member_id + permitted/restricted, sem vínculo com arma.
-- Em produção não havia nenhuma GT quando esta migration foi escrita; mesmo
-- assim as existentes são convertidas (filiado e tipo vêm da arma).

ALTER TABLE public.traffic_guides
  ADD COLUMN member_id  UUID REFERENCES public.members(id) ON DELETE CASCADE,
  ADD COLUMN permitted  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN restricted BOOLEAN NOT NULL DEFAULT false;

UPDATE public.traffic_guides g
SET member_id  = f.member_id,
    permitted  = f.restriction IS DISTINCT FROM 'RESTRITO',
    restricted = f.restriction = 'RESTRITO'
FROM public.member_firearms f
WHERE f.id = g.firearm_id;

ALTER TABLE public.traffic_guides
  ALTER COLUMN member_id SET NOT NULL,
  ADD CONSTRAINT traffic_guides_use_check CHECK (permitted OR restricted);

ALTER TABLE public.traffic_guides RENAME COLUMN destination_address TO address;
COMMENT ON COLUMN public.traffic_guides.address IS 'Endereço do acervo que consta na GT';

-- Vencimentos: a GT aparece como "GT permitido e restrito · <endereço>"
CREATE OR REPLACE VIEW public.member_expirations
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
       CASE
         WHEN g.permitted AND g.restricted THEN 'permitido e restrito'
         WHEN g.restricted THEN 'restrito'
         ELSE 'permitido'
       END || ' · ' || g.address,
       g.expires_at, public.expiry_status(g.expires_at)
FROM public.traffic_guides g
JOIN public.members m ON m.id = g.member_id;

-- Políticas antigas olhavam a arma; agora olham o filiado
DROP POLICY "Filiado gerencia as próprias GTs" ON public.traffic_guides;
CREATE POLICY "Filiado gerencia as próprias GTs" ON public.traffic_guides
  FOR ALL TO authenticated
  USING (member_id = (SELECT public.current_member_id()))
  WITH CHECK (member_id = (SELECT public.current_member_id()));

DROP INDEX IF EXISTS public.idx_traffic_guides_firearm;
ALTER TABLE public.traffic_guides DROP COLUMN firearm_id;
CREATE INDEX idx_traffic_guides_member ON public.traffic_guides (member_id, expires_at);
