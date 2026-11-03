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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_notes: {
        Row: {
          author_email: string | null
          author_id: string | null
          created_at: string
          customer_id: string
          id: string
          note: string
        }
        Insert: {
          author_email?: string | null
          author_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          note: string
        }
        Update: {
          author_email?: string | null
          author_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          account_type: Database["public"]["Enums"]["bank_account_type"]
          bank_name: string
          created_at: string
          customer_id: string
          id: string
          is_primary: boolean
        }
        Insert: {
          account_name: string
          account_number: string
          account_type: Database["public"]["Enums"]["bank_account_type"]
          bank_name: string
          created_at?: string
          customer_id: string
          id?: string
          is_primary?: boolean
        }
        Update: {
          account_name?: string
          account_number?: string
          account_type?: Database["public"]["Enums"]["bank_account_type"]
          bank_name?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_code_counters: {
        Row: {
          code_type: Database["public"]["Enums"]["customer_type"]
          code_year: number
          last_seq: number
        }
        Insert: {
          code_type: Database["public"]["Enums"]["customer_type"]
          code_year: number
          last_seq?: number
        }
        Update: {
          code_type?: Database["public"]["Enums"]["customer_type"]
          code_year?: number
          last_seq?: number
        }
        Relationships: []
      }
      customer_contacts: {
        Row: {
          contact_type: Database["public"]["Enums"]["contact_type"]
          created_at: string
          customer_id: string
          email: string
          id: string
          name: string
          phone: string | null
          position: string | null
        }
        Insert: {
          contact_type: Database["public"]["Enums"]["contact_type"]
          created_at?: string
          customer_id: string
          email: string
          id?: string
          name: string
          phone?: string | null
          position?: string | null
        }
        Update: {
          contact_type?: Database["public"]["Enums"]["contact_type"]
          created_at?: string
          customer_id?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          akta_path: string | null
          company_name: string | null
          created_at: string
          customer_code: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          director_ktp_number: string | null
          director_name: string | null
          full_name: string | null
          id: string
          kemenkumham_sk: string | null
          ktp_number: string | null
          nib_number: string | null
          npwp_number: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
          verified_email: string
        }
        Insert: {
          akta_path?: string | null
          company_name?: string | null
          created_at?: string
          customer_code: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          director_ktp_number?: string | null
          director_name?: string | null
          full_name?: string | null
          id?: string
          kemenkumham_sk?: string | null
          ktp_number?: string | null
          nib_number?: string | null
          npwp_number?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
          verified_email: string
        }
        Update: {
          akta_path?: string | null
          company_name?: string | null
          created_at?: string
          customer_code?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          director_ktp_number?: string | null
          director_name?: string | null
          full_name?: string | null
          id?: string
          kemenkumham_sk?: string | null
          ktp_number?: string | null
          nib_number?: string | null
          npwp_number?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_email?: string
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          created_at: string
          customer_id: string
          doc_type: Database["public"]["Enums"]["legal_doc_type"]
          file_size: number
          id: string
          mime_type: string
          original_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["legal_doc_status"]
          storage_path: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          doc_type: Database["public"]["Enums"]["legal_doc_type"]
          file_size: number
          id?: string
          mime_type: string
          original_name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["legal_doc_status"]
          storage_path: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          doc_type?: Database["public"]["Enums"]["legal_doc_type"]
          file_size?: number
          id?: string
          mime_type?: string
          original_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["legal_doc_status"]
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          setup_fee: number
          unit_price: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["product_category"]
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          setup_fee?: number
          unit_price?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          setup_fee?: number
          unit_price?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_services: {
        Row: {
          activated_at: string | null
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          created_at: string
          customer_id: string
          id: string
          product_id: string | null
          service_code: string
          service_name: string
          setup_fee: number
          status: Database["public"]["Enums"]["service_status"]
          suspended_at: string | null
          terminated_at: string | null
          unit_price: number
        }
        Insert: {
          activated_at?: string | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          customer_id: string
          id?: string
          product_id?: string | null
          service_code: string
          service_name: string
          setup_fee?: number
          status?: Database["public"]["Enums"]["service_status"]
          suspended_at?: string | null
          terminated_at?: string | null
          unit_price?: number
        }
        Update: {
          activated_at?: string | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          customer_id?: string
          id?: string
          product_id?: string | null
          service_code?: string
          service_name?: string
          setup_fee?: number
          status?: Database["public"]["Enums"]["service_status"]
          suspended_at?: string | null
          terminated_at?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_services_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_services_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      owns_customer: { Args: { _customer_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "superuser" | "admin" | "operator" | "client"
      bank_account_type: "CORPORATE" | "PERSONAL"
      billing_cycle: "MONTHLY" | "QUARTERLY" | "ANNUALLY"
      contact_type: "BILLING" | "TECHNICAL"
      customer_status:
        | "PENDING_VERIFICATION"
        | "VERIFIED"
        | "REJECTED"
        | "SUSPENDED"
      customer_type: "ENT" | "IND"
      legal_doc_status: "PENDING" | "VERIFIED" | "REJECTED"
      legal_doc_type:
        | "NPWP"
        | "NIB"
        | "SK_KEMENKUMHAM"
        | "AKTA"
        | "KTP_DIRECTOR"
        | "KTP"
        | "PROOF_OF_TRANSFER"
        | "PPH23_CERTIFICATE"
        | "AUTHORIZATION_LETTER"
        | "OTHER"
      product_category:
        | "COLOCATION"
        | "DEDICATED_INTERNET"
        | "CLOUD_SERVER"
        | "OTHER"
      service_status:
        | "PENDING_ACTIVATION"
        | "ACTIVE"
        | "SUSPENDED"
        | "TERMINATED"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["superuser", "admin", "operator", "client"],
      bank_account_type: ["CORPORATE", "PERSONAL"],
      billing_cycle: ["MONTHLY", "QUARTERLY", "ANNUALLY"],
      contact_type: ["BILLING", "TECHNICAL"],
      customer_status: [
        "PENDING_VERIFICATION",
        "VERIFIED",
        "REJECTED",
        "SUSPENDED",
      ],
      customer_type: ["ENT", "IND"],
      legal_doc_status: ["PENDING", "VERIFIED", "REJECTED"],
      legal_doc_type: [
        "NPWP",
        "NIB",
        "SK_KEMENKUMHAM",
        "AKTA",
        "KTP_DIRECTOR",
        "KTP",
        "PROOF_OF_TRANSFER",
        "PPH23_CERTIFICATE",
        "AUTHORIZATION_LETTER",
        "OTHER",
      ],
      product_category: [
        "COLOCATION",
        "DEDICATED_INTERNET",
        "CLOUD_SERVER",
        "OTHER",
      ],
      service_status: [
        "PENDING_ACTIVATION",
        "ACTIVE",
        "SUSPENDED",
        "TERMINATED",
      ],
    },
  },
} as const
