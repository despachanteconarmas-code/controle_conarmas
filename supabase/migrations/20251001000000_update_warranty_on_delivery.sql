-- Atualizar função de garantia para iniciar quando o status for ENTREGUE
-- A garantia agora começa a contar a partir da data de entrega, não do reparo

CREATE OR REPLACE FUNCTION update_warranty_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-update repair_date when status changes to PRONTA
  IF NEW.status = 'PRONTA' AND (OLD.status IS NULL OR OLD.status != 'PRONTA') AND NEW.repair_date IS NULL THEN
    NEW.repair_date := now();
  END IF;
  
  -- Auto-update delivery_date and warranty_until when status changes to ENTREGUE
  -- A garantia começa quando o equipamento é entregue ao cliente
  IF NEW.status = 'ENTREGUE' AND (OLD.status IS NULL OR OLD.status != 'ENTREGUE') THEN
    -- Define a data de entrega se ainda não foi definida
    IF NEW.delivery_date IS NULL THEN
      NEW.delivery_date := now();
    END IF;
    
    -- Calcula a garantia (90 dias a partir da entrega)
    -- A garantia só é válida se o repair_date estiver definido (ou seja, foi consertado)
    IF NEW.repair_date IS NOT NULL THEN
      NEW.warranty_until := COALESCE(NEW.delivery_date, now()) + INTERVAL '90 days';
    END IF;
  END IF;
  
  -- If repair_date is being manually set and wasn't set before, não calculamos warranty ainda
  -- Pois ela será calculada quando status = ENTREGUE
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Comentário explicativo sobre a lógica de garantia
COMMENT ON FUNCTION update_warranty_date() IS 
'Atualiza automaticamente as datas de reparo, entrega e garantia.
- repair_date: definida quando status = PRONTA
- delivery_date: definida quando status = ENTREGUE  
- warranty_until: calculada quando status = ENTREGUE (delivery_date + 90 dias)
A garantia só é válida se o equipamento foi reparado (repair_date não nulo)';

