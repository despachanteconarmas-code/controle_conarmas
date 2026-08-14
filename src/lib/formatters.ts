// Formatação de CPF
export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length <= 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return cpf;
}

// Remove máscara do CPF
export function cleanCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

// Formatação de telefone: (37) 99975-5698 ou (37) 3212-0987
export function formatPhone(phone?: string | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

// Remove máscara do telefone
export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

// Formatação de CEP: 35500-000
export function formatZipCode(zip?: string | null): string {
  if (!zip) return '';
  const cleaned = zip.replace(/\D/g, '');
  if (cleaned.length === 8) {
    return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2');
  }
  return zip;
}

// Remove máscara do CEP
export function cleanZipCode(zip: string): string {
  return zip.replace(/\D/g, '');
}

// Formatação de valores monetários (centavos para BRL)
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(cents / 100);
}

// Converte BRL string para centavos
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, '').replace(',', '.');
  return Math.round(parseFloat(cleaned || '0') * 100);
}

// Formatação de datas para pt-BR
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR').format(d);
}

// Formatação de data e hora para pt-BR
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(d);
}

// Tradução de status
export const statusLabels = {
  RECEBIDA: 'Recebida',
  AGUARDANDO_ORCAMENTO: 'Aguardando Orçamento',
  EM_MANUTENCAO: 'Em Manutenção',
  AGUARDANDO_PECAS: 'Aguardando Peças',
  PRONTA: 'Pronta',
  ENTREGUE: 'Entregue'
} as const;

// Tradução de produtos
export const productLabels = {
  PISTOLA: 'Pistola',
  CARABINA: 'Carabina',
  REVOLVER: 'Revólver',
  ESPINGARDA: 'Espingarda'
} as const;

// Tradução de tipos
export const typeLabels = {
  FOGO: 'Arma de Fogo',
  PRESSAO: 'Pressão',
  AIRSOFT: 'Airsoft'
} as const;

// Tradução de autoridades
export const authorityLabels = {
  EXERCITO: 'Exército',
  POLICIA_FEDERAL: 'Polícia Federal'
} as const;

// Verifica se está em garantia
export function isInWarranty(warrantyUntil: Date | string | null): boolean {
  if (!warrantyUntil) return false;
  const until = typeof warrantyUntil === 'string' ? new Date(warrantyUntil) : warrantyUntil;
  return new Date() <= until;
}

// Calcula dias restantes da garantia
export function warrantyDaysLeft(warrantyUntil: Date | string | null): number {
  if (!warrantyUntil) return 0;
  const until = typeof warrantyUntil === 'string' ? new Date(warrantyUntil) : warrantyUntil;
  const now = new Date();
  const diffTime = until.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

// Contar OSs em garantia
export function countWarrantyOrders(orders: any[]): number {
  return orders.filter(order => 
    order.status === 'ENTREGUE' && 
    order.warranty_until && 
    isInWarranty(order.warranty_until)
  ).length;
}