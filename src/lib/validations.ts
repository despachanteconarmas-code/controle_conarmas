import { z } from "zod";

// Validador de CPF brasileiro
export function validateCPF(cpf: string): boolean {
  // Remove caracteres não numéricos
  const cleanCPF = cpf.replace(/\D/g, '');
  
  // Verifica se tem 11 dígitos
  if (cleanCPF.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  
  // Validação dos dígitos verificadores
  const digits = cleanCPF.split('').map(Number);
  
  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }
  let firstDigit = 11 - (sum % 11);
  if (firstDigit >= 10) firstDigit = 0;
  
  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * (11 - i);
  }
  let secondDigit = 11 - (sum % 11);
  if (secondDigit >= 10) secondDigit = 0;
  
  return digits[9] === firstDigit && digits[10] === secondDigit;
}

// Schema para criação de OS (alinhado com tipos do Supabase)
export const createServiceOrderSchema = z.object({
  customer_full_name: z.string().min(1, "Nome completo é obrigatório").max(255, "Nome muito longo"),
  address_street: z.string().min(1, "Rua é obrigatória"),
  address_number: z.string()
    .min(1, "Número é obrigatório")
    .refine((num) => /^\d+[A-Za-z]?$|^s\/n$/.test(num), "Formato inválido (ex: '120', '120A', 's/n')"),
  address_neighborhood: z.string().min(1, "Bairro é obrigatório"),
  address_city: z.string().min(1, "Cidade é obrigatória"),
  address_complement: z.string().optional().nullable(),
  customer_cpf: z.string()
    .min(1, "CPF é obrigatório")
    .refine((cpf) => validateCPF(cpf), "CPF inválido"),
  product: z.enum(['PISTOLA', 'CARABINA', 'REVOLVER'], {
    message: "Produto é obrigatório"
  }),
  serial_number: z.string().min(1, "Número de série é obrigatório").max(100, "Número de série muito longo"),
  type: z.enum(['FOGO', 'PRESSAO', 'AIRSOFT'], {
    message: "Tipo é obrigatório"
  }),
  authority: z.enum(['EXERCITO', 'POLICIA_FEDERAL']).optional().nullable(),
  entry_date: z.date({
    message: "Data de entrada é obrigatória"
  }),
  repair_value_cents: z.number().min(0, "Valor deve ser positivo"),
  notes: z.string().optional().nullable(),
}).refine((data) => {
  // Se tipo for FOGO, autoridade é obrigatória
  if (data.type === 'FOGO' && !data.authority) {
    return false;
  }
  return true;
}, {
  message: "Autoridade é obrigatória para armas de fogo",
  path: ["authority"]
});

// Schema para atualização de OS
export const updateServiceOrderSchema = z.object({
  customer_full_name: z.string().min(1, "Nome completo é obrigatório").max(255, "Nome muito longo").optional(),
  address_street: z.string().min(1, "Rua é obrigatória").optional(),
  address_number: z.string()
    .min(1, "Número é obrigatório")
    .refine((num) => /^\d+[A-Za-z]?$|^s\/n$/.test(num), "Formato inválido (ex: '120', '120A', 's/n')")
    .optional(),
  address_neighborhood: z.string().min(1, "Bairro é obrigatório").optional(),
  address_city: z.string().min(1, "Cidade é obrigatória").optional(),
  address_complement: z.string().optional().nullable(),
  customer_cpf: z.string()
    .min(1, "CPF é obrigatório")
    .refine((cpf) => validateCPF(cpf), "CPF inválido")
    .optional(),
  product: z.enum(['PISTOLA', 'CARABINA', 'REVOLVER']).optional(),
  serial_number: z.string().min(1, "Número de série é obrigatório").max(100, "Número de série muito longo").optional(),
  type: z.enum(['FOGO', 'PRESSAO', 'AIRSOFT']).optional(),
  authority: z.enum(['EXERCITO', 'POLICIA_FEDERAL']).optional().nullable(),
  repair_value_cents: z.number().min(0, "Valor deve ser positivo").optional(),
  status: z.enum(['RECEBIDA', 'AGUARDANDO_ORCAMENTO', 'EM_MANUTENCAO', 'AGUARDANDO_PECAS', 'PRONTA', 'ENTREGUE']).optional(),
  notes: z.string().optional().nullable(),
}).refine((data) => {
  // Se tipo for FOGO, autoridade é obrigatória
  if (data.type === 'FOGO' && !data.authority) {
    return false;
  }
  return true;
}, {
  message: "Autoridade é obrigatória para armas de fogo",
  path: ["authority"]
});

// Schema para login
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

// Schema para cadastro
export const signupSchema = z.object({
  full_name: z.string().min(1, "Nome completo é obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"]
});

// Schema para configurações
export const settingsSchema = z.object({
  logo_url: z.string().url("URL inválida").optional(),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
});

export type CreateServiceOrderData = z.infer<typeof createServiceOrderSchema>;
export type UpdateServiceOrderData = z.infer<typeof updateServiceOrderSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type SignupData = z.infer<typeof signupSchema>;
export type SettingsData = z.infer<typeof settingsSchema>;