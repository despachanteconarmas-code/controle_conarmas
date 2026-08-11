-- Fix function search paths for security
CREATE OR REPLACE FUNCTION generate_os_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year TEXT;
  next_sequence INTEGER;
  new_os_number TEXT;
BEGIN
  -- Get current year
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Get next sequence number for this year
  SELECT COALESCE(MAX(
    CASE 
      WHEN os_number ~ ('^OS-' || current_year || '-[0-9]{6}$')
      THEN (RIGHT(os_number, 6))::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO next_sequence
  FROM service_orders;
  
  -- Format the OS number
  new_os_number := 'OS-' || current_year || '-' || LPAD(next_sequence::TEXT, 6, '0');
  
  NEW.os_number := new_os_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;