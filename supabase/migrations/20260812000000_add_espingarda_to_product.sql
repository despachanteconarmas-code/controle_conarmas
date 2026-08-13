-- Adiciona ESPINGARDA à lista de produtos aceitos.
--
-- O CHECK original (migração 20250926000023) só permitia PISTOLA,
-- CARABINA e REVOLVER. Sem alterar a constraint, o banco rejeita a
-- inserção mesmo com o valor disponível no formulário.

ALTER TABLE public.service_orders
  DROP CONSTRAINT IF EXISTS service_orders_product_check;

ALTER TABLE public.service_orders
  ADD CONSTRAINT service_orders_product_check
  CHECK (product IN ('PISTOLA', 'CARABINA', 'REVOLVER', 'ESPINGARDA'));
