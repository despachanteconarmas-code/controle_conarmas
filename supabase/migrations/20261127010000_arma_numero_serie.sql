-- Nº de série gravado na arma (pedido do Matheus, 27/11/2026).
-- Diferente do nº do SIGMA, que já existe em sigma_number.
ALTER TABLE public.member_firearms ADD COLUMN serial_number VARCHAR(50);
COMMENT ON COLUMN public.member_firearms.serial_number IS 'Número de série gravado na arma';
