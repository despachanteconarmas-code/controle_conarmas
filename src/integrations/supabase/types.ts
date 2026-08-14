export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      chats: {
        Row: {
          clientName: string | null
          created_at: string
          id: number
          remoteJid: string | null
        }
        Insert: {
          clientName?: string | null
          created_at: string
          id?: number
          remoteJid?: string | null
        }
        Update: {
          clientName?: string | null
          created_at?: string
          id?: number
          remoteJid?: string | null
        }
        Relationships: []
      }
      FollowUP: {
        Row: {
          clientName: string
          data: string | null
          followUp1: string | null
          followUp2: string | null
          followUp3: string | null
          horario: string | null
          id: number
          telefone: string | null
        }
        Insert: {
          clientName: string
          data?: string | null
          followUp1?: string | null
          followUp2?: string | null
          followUp3?: string | null
          horario?: string | null
          id?: number
          telefone?: string | null
        }
        Update: {
          clientName?: string
          data?: string | null
          followUp1?: string | null
          followUp2?: string | null
          followUp3?: string | null
          horario?: string | null
          id?: number
          telefone?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_order_files: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          original_name: string
          service_order_id: string
          size_bytes: number
          storage_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          original_name: string
          service_order_id: string
          size_bytes: number
          storage_key: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          original_name?: string
          service_order_id?: string
          size_bytes?: number
          storage_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_files_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_street: string | null
          address_zip_code: string | null
          cpf: string
          created_at: string
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          cpf: string
          created_at?: string
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          cpf?: string
          created_at?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      option_lists: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          position: number
          updated_at: string
          value: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          position?: number
          updated_at?: string
          value: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          position?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      service_order_items: {
        Row: {
          created_at: string
          description: string
          id: string
          position: number
          quantity: number
          service_order_id: string
          unit_value_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          position?: number
          quantity?: number
          service_order_id: string
          unit_value_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          position?: number
          quantity?: number
          service_order_id?: string
          unit_value_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_items_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_street: string | null
          address_zip_code: string | null
          authority: string | null
          brand: string | null
          caliber: string | null
          created_at: string
          customer_address: string
          customer_address_full: string | null
          customer_cpf: string
          customer_full_name: string
          customer_id: string | null
          customer_phone: string | null
          delivery_date: string | null
          entry_date: string
          id: string
          model: string | null
          notes: string | null
          os_number: string
          pdf_url: string | null
          product: string
          repair_date: string | null
          repair_value_cents: number
          serial_number: string
          status: string
          type: string
          updated_at: string
          warranty_until: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          authority?: string | null
          brand?: string | null
          caliber?: string | null
          created_at?: string
          customer_address: string
          customer_address_full?: string | null
          customer_cpf: string
          customer_full_name: string
          customer_id?: string | null
          customer_phone?: string | null
          delivery_date?: string | null
          entry_date?: string
          id?: string
          model?: string | null
          notes?: string | null
          os_number: string
          pdf_url?: string | null
          product: string
          repair_date?: string | null
          repair_value_cents?: number
          serial_number: string
          status?: string
          type: string
          updated_at?: string
          warranty_until?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          authority?: string | null
          brand?: string | null
          caliber?: string | null
          created_at?: string
          customer_address?: string
          customer_address_full?: string | null
          customer_cpf?: string
          customer_full_name?: string
          customer_id?: string | null
          customer_phone?: string | null
          delivery_date?: string | null
          entry_date?: string
          id?: string
          model?: string | null
          notes?: string | null
          os_number?: string
          pdf_url?: string | null
          product?: string
          repair_date?: string | null
          repair_value_cents?: number
          serial_number?: string
          status?: string
          type?: string
          updated_at?: string
          warranty_until?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      process_followups: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
