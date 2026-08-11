// Types específicos para nossa aplicação baseados no schema do banco
export interface ServiceOrder {
  id: string;
  os_number: string;
  customer_full_name: string;
  customer_address: string;
  customer_cpf: string;
  product: 'PISTOLA' | 'CARABINA' | 'REVOLVER';
  serial_number: string;
  type: 'FOGO' | 'PRESSAO' | 'AIRSOFT';
  authority?: 'EXERCITO' | 'POLICIA_FEDERAL' | null;
  entry_date: string;
  repair_value_cents: number;
  status: 'RECEBIDA' | 'AGUARDANDO_ORCAMENTO' | 'EM_MANUTENCAO' | 'AGUARDANDO_PECAS' | 'PRONTA' | 'ENTREGUE';
  repair_date?: string | null;
  delivery_date?: string | null;
  warranty_until?: string | null;
  notes?: string | null;
  pdf_url?: string | null;
// Novos campos de endereço
  address_street?: string | null;
  address_number?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_complement?: string | null;
  customer_address_full?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceOrderFile {
  id: string;
  service_order_id: string;
  storage_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  file_url_signed?: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name?: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: string;
  key: string;
  value?: string | null;
  created_at: string;
  updated_at: string;
}

// Status com cores para UI
export interface StatusConfig {
  label: string;
  color: 'gray' | 'blue' | 'yellow' | 'orange' | 'green' | 'red';
  description: string;
}

export const statusConfig: Record<ServiceOrder['status'], StatusConfig> = {
  RECEBIDA: {
    label: 'Recebida',
    color: 'gray',
    description: 'OS foi registrada e aguarda análise'
  },
  AGUARDANDO_ORCAMENTO: {
    label: 'Aguardando Orçamento',
    color: 'yellow',
    description: 'Equipamento está sendo avaliado'
  },
  EM_MANUTENCAO: {
    label: 'Em Manutenção',
    color: 'orange',
    description: 'Manutenção em andamento'
  },
  AGUARDANDO_PECAS: {
    label: 'Aguardando Peças',
    color: 'yellow',
    description: 'Aguardando chegada de peças para reparo'
  },
  PRONTA: {
    label: 'Pronta',
    color: 'green',
    description: 'Manutenção concluída, aguardando retirada'
  },
  ENTREGUE: {
    label: 'Entregue',
    color: 'green',
    description: 'Equipamento entregue ao cliente'
  }
};

// Filtros disponíveis
export interface ServiceOrderFilters {
  search?: string;
  cpf?: string;
  serial_number?: string;
  status?: ServiceOrder['status'];
  product?: ServiceOrder['product'];
  type?: ServiceOrder['type'];
  warranty_status?: 'in_warranty' | 'out_of_warranty' | 'all';
  city?: string;
}