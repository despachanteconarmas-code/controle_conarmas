-- Catálogo de itens do reparo
--
-- A descrição de cada item era digitada do zero em toda OS, mesmo para
-- os serviços de sempre. Passa a existir a categoria 'service_item' em
-- `option_lists`, com o mesmo "+" / "x" das outras listas.

ALTER TABLE public.option_lists
  DROP CONSTRAINT IF EXISTS option_lists_category_check;

ALTER TABLE public.option_lists
  ADD CONSTRAINT option_lists_category_check
  CHECK (category IN ('product', 'type', 'authority', 'service_item'));

-- Carga inicial a partir do que já foi lançado nas OS existentes, para
-- o catálogo não nascer vazio
INSERT INTO public.option_lists (category, value, label, position)
SELECT
  'service_item',
  -- Mesmo formato gerado pelo toOptionValue() do frontend.
  -- translate() em vez da extensão unaccent, para a migração não
  -- depender de nada instalado no projeto.
  left(
    trim(both '_' from
      regexp_replace(
        upper(
          translate(
            btrim(description),
            'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
            'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
          )
        ),
        '[^A-Z0-9]+', '_', 'g'
      )
    ),
    50
  ),
  btrim(description),
  row_number() OVER (ORDER BY btrim(description))
FROM (
  SELECT DISTINCT btrim(description) AS description
  FROM public.service_order_items
  WHERE btrim(description) <> ''
) t
ON CONFLICT (category, value) DO NOTHING;
