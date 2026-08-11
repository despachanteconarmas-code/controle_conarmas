-- Renomear status 'EM_ANALISE' para 'AGUARDANDO_ORCAMENTO'

-- 1. Remover constraint antiga
ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_status_check;

-- 2. Atualizar registros existentes
UPDATE service_orders 
SET status = 'AGUARDANDO_ORCAMENTO' 
WHERE status = 'EM_ANALISE';

-- 3. Adicionar nova constraint com o status atualizado
ALTER TABLE service_orders ADD CONSTRAINT service_orders_status_check 
CHECK (status IN ('RECEBIDA', 'AGUARDANDO_ORCAMENTO', 'EM_MANUTENCAO', 'AGUARDANDO_PECAS', 'PRONTA', 'ENTREGUE'));