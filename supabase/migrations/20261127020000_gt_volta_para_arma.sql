-- =====================================================================
-- GT volta a ser de cada arma (uma por endereço, por arma)
-- =====================================================================
-- Correção do Matheus (27/11/2026): cada arma tem a sua GT, e quem tem dois
-- endereços tem duas GTs para aquela arma. Ex.: pistola G2C com 2 endereços
-- = 2 GTs; revólver = mais 2 GTs.
--
-- traffic_guides ganha firearm_id de novo. member_id continua (RLS e pasta
-- dos arquivos) e passa a ser copiado da arma por trigger, então não há como
-- ligar a GT à arma de outro filiado. O uso (permitido/restrito) volta a ser
-- só o da arma.
--
-- GTs já cadastradas: as de filiados com uma arma só são ligadas a ela. As
-- demais ficam sem arma (firearm_id NULL) e o painel pede para escolher.

ALTER TABLE public.traffic_guides
  ADD COLUMN firearm_id UUID REFERENCES public.member_firearms(id) ON DELETE CASCADE;

UPDATE public.traffic_guides g
SET firearm_id = f.id
FROM public.member_firearms f
WHERE f.member_id = g.member_id
  AND (SELECT count(*) FROM public.member_firearms x WHERE x.member_id = g.member_id) = 1;

CREATE INDEX idx_traffic_guides_firearm ON public.traffic_guides (firearm_id);

-- O filiado da GT é sempre o dono da arma. Roda com os direitos de quem
-- salva: se a arma for de outro filiado, a RLS esconde a linha, member_id
-- fica nulo e o NOT NULL recusa.
CREATE OR REPLACE FUNCTION public.traffic_guide_member_from_firearm()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.firearm_id IS NOT NULL THEN
    SELECT f.member_id INTO NEW.member_id
    FROM public.member_firearms f
    WHERE f.id = NEW.firearm_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_traffic_guides_member
  BEFORE INSERT OR UPDATE ON public.traffic_guides
  FOR EACH ROW EXECUTE FUNCTION public.traffic_guide_member_from_firearm();

-- Vencimentos: "GT Pistola G2C → <endereço>"
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
       CASE WHEN f.id IS NULL THEN 'arma não informada → ' || g.address
            ELSE concat_ws(' ', public.option_label('firearm_type', f.type), f.model, '→', g.address)
       END,
       g.expires_at, public.expiry_status(g.expires_at)
FROM public.traffic_guides g
JOIN public.members m ON m.id = g.member_id
LEFT JOIN public.member_firearms f ON f.id = g.firearm_id;

ALTER TABLE public.traffic_guides
  DROP CONSTRAINT traffic_guides_use_check,
  DROP COLUMN permitted,
  DROP COLUMN restricted;
