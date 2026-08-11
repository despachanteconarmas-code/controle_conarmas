-- Adicionar novos campos de endereço à tabela service_orders
ALTER TABLE public.service_orders 
ADD COLUMN address_street TEXT,
ADD COLUMN address_number TEXT,
ADD COLUMN address_neighborhood TEXT,
ADD COLUMN address_city TEXT,
ADD COLUMN address_complement TEXT,
ADD COLUMN customer_address_full TEXT;

-- Função para gerar customer_address_full
CREATE OR REPLACE FUNCTION public.generate_customer_address_full()
RETURNS TRIGGER AS $$
BEGIN
  -- Gerar endereço completo formatado
  NEW.customer_address_full := 
    NEW.address_street || ', ' || NEW.address_number ||
    CASE 
      WHEN NEW.address_complement IS NOT NULL AND NEW.address_complement != '' 
      THEN ' - ' || NEW.address_complement 
      ELSE '' 
    END ||
    ', ' || NEW.address_neighborhood || ' - ' || NEW.address_city;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar address_full automaticamente
CREATE TRIGGER trigger_generate_customer_address_full
  BEFORE INSERT OR UPDATE ON public.service_orders
  FOR EACH ROW
  WHEN (NEW.address_street IS NOT NULL AND NEW.address_number IS NOT NULL 
        AND NEW.address_neighborhood IS NOT NULL AND NEW.address_city IS NOT NULL)
  EXECUTE FUNCTION public.generate_customer_address_full();