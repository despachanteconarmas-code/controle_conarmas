-- Create service_orders table
CREATE TABLE public.service_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  os_number VARCHAR(50) NOT NULL UNIQUE,
  customer_full_name VARCHAR(255) NOT NULL,
  customer_address TEXT NOT NULL,
  customer_cpf VARCHAR(11) NOT NULL, -- Store only digits
  product VARCHAR(50) NOT NULL CHECK (product IN ('PISTOLA', 'CARABINA', 'REVOLVER')),
  serial_number VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('FOGO', 'PRESSAO', 'AIRSOFT')),
  authority VARCHAR(20) CHECK (authority IN ('EXERCITO', 'POLICIA_FEDERAL')),
  entry_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  repair_value_cents INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'RECEBIDA' CHECK (status IN ('RECEBIDA', 'EM_ANALISE', 'EM_MANUTENCAO', 'AGUARDANDO_PECAS', 'PRONTA', 'ENTREGUE')),
  repair_date TIMESTAMP WITH TIME ZONE,
  delivery_date TIMESTAMP WITH TIME ZONE,
  warranty_until TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'USER',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create settings table for app configuration
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Create policies for service_orders
CREATE POLICY "Authenticated users can view all service orders" 
ON public.service_orders 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create service orders" 
ON public.service_orders 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update service orders" 
ON public.service_orders 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete service orders" 
ON public.service_orders 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Create policies for settings
CREATE POLICY "Authenticated users can view settings" 
ON public.settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage settings" 
ON public.settings 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Create function to auto-generate OS number
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
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating OS number
CREATE TRIGGER trigger_generate_os_number
  BEFORE INSERT ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_os_number();

-- Create function to auto-update warranty_until when repair_date is set
CREATE OR REPLACE FUNCTION update_warranty_date()
RETURNS TRIGGER AS $$
BEGIN
  -- If repair_date is being set and wasn't set before, calculate warranty_until
  IF NEW.repair_date IS NOT NULL AND (OLD.repair_date IS NULL OR NEW.repair_date != OLD.repair_date) THEN
    NEW.warranty_until := NEW.repair_date + INTERVAL '30 days';
  END IF;
  
  -- Auto-update repair_date when status changes to PRONTA
  IF NEW.status = 'PRONTA' AND OLD.status != 'PRONTA' AND NEW.repair_date IS NULL THEN
    NEW.repair_date := now();
    NEW.warranty_until := now() + INTERVAL '30 days';
  END IF;
  
  -- Auto-update delivery_date when status changes to ENTREGUE
  IF NEW.status = 'ENTREGUE' AND OLD.status != 'ENTREGUE' AND NEW.delivery_date IS NULL THEN
    NEW.delivery_date := now();
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for warranty date updates
CREATE TRIGGER trigger_update_warranty_date
  BEFORE UPDATE ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_warranty_date();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Create indexes for performance
CREATE INDEX idx_service_orders_customer_cpf ON service_orders(customer_cpf);
CREATE INDEX idx_service_orders_serial_number ON service_orders(serial_number);
CREATE INDEX idx_service_orders_os_number ON service_orders(os_number);
CREATE INDEX idx_service_orders_status ON service_orders(status);
CREATE INDEX idx_service_orders_entry_date ON service_orders(entry_date DESC);

-- Insert default settings
INSERT INTO public.settings (key, value) VALUES 
('logo_url', 'https://hyycaojnpgewcijjcnyj.supabase.co/storage/v1/object/sign/Conarmas/logo.jpg?token=...'),
('theme', 'system');

-- Insert some sample data for testing
INSERT INTO public.service_orders (
  customer_full_name, customer_address, customer_cpf, product, serial_number, 
  type, authority, repair_value_cents, status, notes
) VALUES 
('João Silva Santos', 'Rua das Flores, 123, Centro', '12345678901', 'PISTOLA', 'ABC123456', 'FOGO', 'EXERCITO', 15000, 'RECEBIDA', 'Limpeza e revisão geral'),
('Maria Oliveira Costa', 'Av. Brasil, 456, Jardim América', '98765432109', 'CARABINA', 'XYZ789012', 'PRESSAO', NULL, 25000, 'EM_ANALISE', 'Troca de mola principal'),
('Pedro Ferreira Lima', 'Rua do Campo, 789, Vila Nova', '11122233344', 'REVOLVER', 'DEF345678', 'AIRSOFT', NULL, 12000, 'PRONTA', 'Ajuste de gatilho'),
('Ana Carolina Souza', 'Rua das Palmeiras, 321, Centro', '55566677788', 'PISTOLA', 'GHI901234', 'FOGO', 'POLICIA_FEDERAL', 18000, 'EM_MANUTENCAO', 'Substituição de peças do mecanismo'),
('Carlos Eduardo Rocha', 'Av. Central, 654, Bairro Alto', '99988877766', 'CARABINA', 'JKL567890', 'FOGO', 'EXERCITO', 22000, 'ENTREGUE', 'Manutenção preventiva completa');

-- Update one record to have repair_date set (for warranty testing)
UPDATE public.service_orders 
SET repair_date = now() - INTERVAL '10 days',
    warranty_until = now() + INTERVAL '20 days'
WHERE product = 'REVOLVER';