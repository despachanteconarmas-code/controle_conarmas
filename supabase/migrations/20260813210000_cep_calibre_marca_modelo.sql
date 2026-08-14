-- CEP com busca automática + calibre, marca e modelo do equipamento
--
-- 1) O endereço era digitado inteiro à mão. Volta a existir o CEP, que
--    preenche rua, bairro e cidade pela ViaCEP.
-- 2) Os dados do equipamento tinham só produto, tipo e número de série.
--    Entram calibre, marca e modelo.
--
-- Calibre e marca entram como listas administráveis (option_lists), do
-- mesmo jeito que Produto e Tipo: são conjuntos pequenos e muito
-- repetidos, e em texto livre "9mm", "9 mm" e "9MM" viram três coisas
-- diferentes na hora de buscar. Modelo fica texto livre, porque varia
-- demais para caber numa lista.

-- =====================================================================
-- 1. CEP
-- =====================================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address_zip_code VARCHAR(8); -- somente dígitos

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS address_zip_code VARCHAR(8);

-- =====================================================================
-- 2. DADOS DO EQUIPAMENTO
-- =====================================================================

-- caliber e brand guardam o código da option_lists (igual a product e
-- type), por isso o mesmo VARCHAR(50) de option_lists.value
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS caliber VARCHAR(50),
  ADD COLUMN IF NOT EXISTS brand VARCHAR(50),
  ADD COLUMN IF NOT EXISTS model VARCHAR(255);

-- =====================================================================
-- 3. NOVAS CATEGORIAS DE LISTA
-- =====================================================================

ALTER TABLE public.option_lists
  DROP CONSTRAINT IF EXISTS option_lists_category_check;

ALTER TABLE public.option_lists
  ADD CONSTRAINT option_lists_category_check
  CHECK (category IN (
    'product', 'type', 'authority', 'service_item', 'caliber', 'brand'
  ));

-- Carga inicial. Os códigos seguem o mesmo formato do toOptionValue() do
-- frontend, para que adicionar de novo o mesmo rótulo pela tela reative
-- a opção em vez de esbarrar no UNIQUE.
INSERT INTO public.option_lists (category, value, label, position) VALUES
  ('caliber', '22_LR',      '.22 LR',      1),
  ('caliber', '32',         '.32',         2),
  ('caliber', '38_SPL',     '.38 SPL',     3),
  ('caliber', '357_MAGNUM', '.357 Magnum', 4),
  ('caliber', '380_ACP',    '.380 ACP',    5),
  ('caliber', '9MM',        '9mm',         6),
  ('caliber', '40_S_W',     '.40 S&W',     7),
  ('caliber', '45_ACP',     '.45 ACP',     8),
  ('caliber', 'CALIBRE_12', 'Calibre 12',  9),
  ('caliber', 'CALIBRE_20', 'Calibre 20',  10),
  ('caliber', 'CALIBRE_28', 'Calibre 28',  11),
  ('caliber', '4_5MM',      '4,5mm',       12),
  ('caliber', '5_5MM',      '5,5mm',       13),
  ('caliber', '6MM',        '6mm',         14),

  ('brand', 'TAURUS',        'Taurus',        1),
  ('brand', 'CBC',           'CBC',           2),
  ('brand', 'IMBEL',         'Imbel',         3),
  ('brand', 'ROSSI',         'Rossi',         4),
  ('brand', 'BOITO',         'Boito',         5),
  ('brand', 'BERETTA',       'Beretta',       6),
  ('brand', 'GLOCK',         'Glock',         7),
  ('brand', 'SMITH_WESSON',  'Smith & Wesson', 8),
  ('brand', 'COLT',          'Colt',          9),
  ('brand', 'GAMO',          'Gamo',          10)
ON CONFLICT (category, value) DO NOTHING;
