-- Cadastro de clientes + itens somáveis na OS
--
-- Contexto:
--   1) Os dados do cliente eram gravados soltos dentro de cada OS.
--      Quando o mesmo cliente voltava, tudo era digitado de novo.
--      Passa a existir a tabela `customers`, e a OS referencia o cliente.
--   2) Não existia telefone em lugar nenhum (previsto no docs/prd.md,
--      História 1.2, nunca implementado).
--   3) O valor do reparo era um número único digitado à mão. Passa a
--      existir `service_order_items`, e o total é somado por trigger.
--
-- Compatibilidade: `service_orders` mantém as colunas de cliente e o
-- `repair_value_cents`. OS antigas seguem funcionando sem alteração.
-- O valor só passa a ser calculado quando a OS tiver itens lançados.

-- =====================================================================
-- 1. TABELA DE CLIENTES
-- =====================================================================

CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  cpf VARCHAR(11) NOT NULL UNIQUE, -- somente dígitos, igual a service_orders
  phone VARCHAR(11), -- somente dígitos: DDD + número
  address_street TEXT,
  address_number TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_complement TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Busca por nome na tela de clientes
CREATE INDEX idx_customers_full_name ON public.customers (full_name);
CREATE INDEX idx_customers_cpf ON public.customers (cpf);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all customers"
ON public.customers FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create customers"
ON public.customers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update customers"
ON public.customers FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete customers"
ON public.customers FOR DELETE USING (auth.uid() IS NOT NULL);

-- =====================================================================
-- 2. LIGAÇÃO DA OS COM O CLIENTE + TELEFONE
-- =====================================================================

ALTER TABLE public.service_orders
  ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN customer_phone VARCHAR(11);

CREATE INDEX idx_service_orders_customer_id ON public.service_orders (customer_id);

-- =====================================================================
-- 3. BACKFILL: cria clientes a partir das OS já existentes
-- =====================================================================

-- Um cliente por CPF, usando os dados da OS mais recente daquele CPF
INSERT INTO public.customers (
  full_name, cpf, address_street, address_number,
  address_neighborhood, address_city, address_complement
)
SELECT DISTINCT ON (customer_cpf)
  customer_full_name,
  customer_cpf,
  address_street,
  address_number,
  address_neighborhood,
  address_city,
  address_complement
FROM public.service_orders
WHERE customer_cpf IS NOT NULL AND customer_cpf <> ''
ORDER BY customer_cpf, entry_date DESC
ON CONFLICT (cpf) DO NOTHING;

-- Aponta cada OS para o cliente correspondente
UPDATE public.service_orders so
SET customer_id = c.id
FROM public.customers c
WHERE c.cpf = so.customer_cpf
  AND so.customer_id IS NULL;

-- =====================================================================
-- 4. ITENS DA OS
-- =====================================================================

CREATE TABLE public.service_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_value_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_value_cents >= 0),
  position INTEGER NOT NULL DEFAULT 0, -- ordem de exibição na OS
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_order_items_order
  ON public.service_order_items (service_order_id, position);

ALTER TABLE public.service_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all service order items"
ON public.service_order_items FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create service order items"
ON public.service_order_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update service order items"
ON public.service_order_items FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete service order items"
ON public.service_order_items FOR DELETE USING (auth.uid() IS NOT NULL);

-- =====================================================================
-- 5. TOTAL AUTOMÁTICO
-- =====================================================================

-- Recalcula service_orders.repair_value_cents como a soma dos itens.
-- Só roda quando os itens mudam: OS sem itens preserva o valor digitado
-- à mão, que é o caso de todas as ordens anteriores a esta migração.
CREATE OR REPLACE FUNCTION public.recalculate_service_order_total()
RETURNS TRIGGER AS $$
DECLARE
  target_order_id UUID;
BEGIN
  target_order_id := COALESCE(NEW.service_order_id, OLD.service_order_id);

  UPDATE public.service_orders
  SET repair_value_cents = (
        SELECT COALESCE(SUM(quantity * unit_value_cents), 0)
        FROM public.service_order_items
        WHERE service_order_id = target_order_id
      ),
      updated_at = now()
  WHERE id = target_order_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_recalculate_total_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.service_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_service_order_total();

-- =====================================================================
-- 6. updated_at automático nas tabelas novas
-- =====================================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trigger_service_order_items_updated_at
  BEFORE UPDATE ON public.service_order_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
