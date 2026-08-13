-- Listas de opções administráveis pelo próprio usuário
--
-- Produto, Tipo e Autoridade eram enums travados por CHECK: incluir um
-- valor novo (ESPINGARDA, FINCA PINO) exigia migração e deploy. Passam a
-- viver em `option_lists`, com "+" para adicionar e "x" para remover
-- direto nos formulários.
--
-- Status ficou de fora de propósito: ele dispara os triggers de garantia
-- e tem cores e descrições atreladas no código. Continua fixo.

CREATE TABLE public.option_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category VARCHAR(30) NOT NULL CHECK (category IN ('product', 'type', 'authority')),
  value VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  -- Remoção é lógica: a opção some do formulário, mas as OS antigas que
  -- a usam continuam exibindo o rótulo correto em vez do código cru
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (category, value)
);

CREATE INDEX idx_option_lists_category ON public.option_lists (category, position);

ALTER TABLE public.option_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all options"
ON public.option_lists FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create options"
ON public.option_lists FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update options"
ON public.option_lists FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete options"
ON public.option_lists FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trigger_option_lists_updated_at
  BEFORE UPDATE ON public.option_lists
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================================
-- Carga inicial: o que já existia, mais o FINCA PINO pedido pelo cliente
-- =====================================================================

INSERT INTO public.option_lists (category, value, label, position) VALUES
  ('product', 'PISTOLA',    'Pistola',    1),
  ('product', 'CARABINA',   'Carabina',   2),
  ('product', 'REVOLVER',   'Revólver',   3),
  ('product', 'ESPINGARDA', 'Espingarda', 4),

  ('type', 'FOGO',       'Arma de Fogo', 1),
  ('type', 'PRESSAO',    'Pressão',      2),
  ('type', 'AIRSOFT',    'Airsoft',      3),
  ('type', 'FINCA_PINO', 'Finca Pino',   4),

  ('authority', 'EXERCITO',        'Exército',        1),
  ('authority', 'POLICIA_FEDERAL', 'Polícia Federal', 2)
ON CONFLICT (category, value) DO NOTHING;

-- =====================================================================
-- Libera as colunas: a validação passa a ser a lista acima
-- =====================================================================

ALTER TABLE public.service_orders
  DROP CONSTRAINT IF EXISTS service_orders_product_check;

ALTER TABLE public.service_orders
  DROP CONSTRAINT IF EXISTS service_orders_type_check;

ALTER TABLE public.service_orders
  DROP CONSTRAINT IF EXISTS service_orders_authority_check;
