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
      announcements: {
        Row: {
          author_id: string | null
          body: string
          category: Database["public"]["Enums"]["announcement_category"]
          created_at: string
          id: string
          is_published: boolean
          title: string
        }
        Insert: {
          author_id?: string | null
          body: string
          category?: Database["public"]["Enums"]["announcement_category"]
          created_at?: string
          id?: string
          is_published?: boolean
          title: string
        }
        Update: {
          author_id?: string | null
          body?: string
          category?: Database["public"]["Enums"]["announcement_category"]
          created_at?: string
          id?: string
          is_published?: boolean
          title?: string
        }
        Relationships: []
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
      billing_attachments: {
        Row: {
          created_at: string
          customer_id: string
          document_id: string
          file_size: number
          id: string
          kind: Database["public"]["Enums"]["payment_kind"]
          mime_type: string
          original_name: string
          status: Database["public"]["Enums"]["legal_doc_status"]
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          document_id: string
          file_size: number
          id?: string
          kind: Database["public"]["Enums"]["payment_kind"]
          mime_type: string
          original_name: string
          status?: Database["public"]["Enums"]["legal_doc_status"]
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          document_id?: string
          file_size?: number
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          mime_type?: string
          original_name?: string
          status?: Database["public"]["Enums"]["legal_doc_status"]
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_attachments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "billing_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_doc_counters: {
        Row: {
          customer_type: Database["public"]["Enums"]["customer_type"]
          doc_month: number
          doc_type: Database["public"]["Enums"]["billing_doc_type"]
          doc_year: number
          last_seq: number
        }
        Insert: {
          customer_type: Database["public"]["Enums"]["customer_type"]
          doc_month: number
          doc_type: Database["public"]["Enums"]["billing_doc_type"]
          doc_year: number
          last_seq?: number
        }
        Update: {
          customer_type?: Database["public"]["Enums"]["customer_type"]
          doc_month?: number
          doc_type?: Database["public"]["Enums"]["billing_doc_type"]
          doc_year?: number
          last_seq?: number
        }
        Relationships: []
      }
      billing_documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          doc_number: string | null
          doc_type: Database["public"]["Enums"]["billing_doc_type"]
          dpp: number
          due_date: string | null
          id: string
          issue_date: string
          lifecycle_stage: string | null
          notes: string | null
          paid_at: string | null
          revision_note: string | null
          stamp_duty: number
          status: Database["public"]["Enums"]["billing_doc_status"]
          subtotal: number
          total: number
          vat: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          doc_number?: string | null
          doc_type: Database["public"]["Enums"]["billing_doc_type"]
          dpp?: number
          due_date?: string | null
          id?: string
          issue_date?: string
          lifecycle_stage?: string | null
          notes?: string | null
          paid_at?: string | null
          revision_note?: string | null
          stamp_duty?: number
          status?: Database["public"]["Enums"]["billing_doc_status"]
          subtotal?: number
          total?: number
          vat?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          doc_number?: string | null
          doc_type?: Database["public"]["Enums"]["billing_doc_type"]
          dpp?: number
          due_date?: string | null
          id?: string
          issue_date?: string
          lifecycle_stage?: string | null
          notes?: string | null
          paid_at?: string | null
          revision_note?: string | null
          stamp_duty?: number
          status?: Database["public"]["Enums"]["billing_doc_status"]
          subtotal?: number
          total?: number
          vat?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_items: {
        Row: {
          amount: number
          description: string
          document_id: string
          id: string
          quantity: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          amount?: number
          description: string
          document_id: string
          id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          description?: string
          document_id?: string
          id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "billing_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          display_name: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          display_name: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          display_name?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          contract_type: string
          created_at: string
          customer_id: string
          end_date: string | null
          file_path: string
          id: string
          mime_type: string
          start_date: string | null
          title: string
          uploaded_by: string
        }
        Insert: {
          contract_type?: string
          created_at?: string
          customer_id: string
          end_date?: string | null
          file_path: string
          id?: string
          mime_type: string
          start_date?: string | null
          title: string
          uploaded_by: string
        }
        Update: {
          contract_type?: string
          created_at?: string
          customer_id?: string
          end_date?: string | null
          file_path?: string
          id?: string
          mime_type?: string
          start_date?: string | null
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_customer_id_fkey"
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
      customer_prices: {
        Row: {
          customer_id: string
          id: string
          product_id: string
          setup_fee: number
          unit_price: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          customer_id: string
          id?: string
          product_id: string
          setup_fee?: number
          unit_price: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          customer_id?: string
          id?: string
          product_id?: string
          setup_fee?: number
          unit_price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_prices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          akta_path: string | null
          archived_at: string | null
          archived_by: string | null
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
          archived_at?: string | null
          archived_by?: string | null
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
          archived_at?: string | null
          archived_by?: string | null
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
      monitor_assignments: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          monitor_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          monitor_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          monitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitor_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitor_assignments_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "network_monitors"
            referencedColumns: ["id"]
          },
        ]
      }
      monitor_heartbeats: {
        Row: {
          checked_at: string
          id: number
          latency_ms: number | null
          message: string | null
          monitor_id: string
          status: Database["public"]["Enums"]["monitor_status"]
        }
        Insert: {
          checked_at?: string
          id?: never
          latency_ms?: number | null
          message?: string | null
          monitor_id: string
          status: Database["public"]["Enums"]["monitor_status"]
        }
        Update: {
          checked_at?: string
          id?: never
          latency_ms?: number | null
          message?: string | null
          monitor_id?: string
          status?: Database["public"]["Enums"]["monitor_status"]
        }
        Relationships: [
          {
            foreignKeyName: "monitor_heartbeats_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "network_monitors"
            referencedColumns: ["id"]
          },
        ]
      }
      network_monitors: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          kuma_monitor_id: number | null
          last_checked_at: string | null
          last_latency_ms: number | null
          location: string | null
          name: string
          status: Database["public"]["Enums"]["monitor_status"]
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kuma_monitor_id?: number | null
          last_checked_at?: string | null
          last_latency_ms?: number | null
          location?: string | null
          name: string
          status?: Database["public"]["Enums"]["monitor_status"]
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kuma_monitor_id?: number | null
          last_checked_at?: string | null
          last_latency_ms?: number | null
          location?: string | null
          name?: string
          status?: Database["public"]["Enums"]["monitor_status"]
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pre_orders: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          created_at: string
          created_by: string
          customer_id: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          quotation_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          quotation_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          quotation_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "billing_documents"
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
      ticket_counters: {
        Row: {
          last_seq: number
          yr: number
        }
        Insert: {
          last_seq?: number
          yr: number
        }
        Update: {
          last_seq?: number
          yr?: number
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_staff: boolean
          ticket_id: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          is_staff?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          attachment_path: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          created_at: string
          created_by: string | null
          customer_id: string
          description: string | null
          details: Json
          epass_code: string | null
          id: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_no: string | null
          updated_at: string
        }
        Insert: {
          attachment_path?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          created_by?: string | null
          customer_id: string
          description?: string | null
          details?: Json
          epass_code?: string | null
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_no?: string | null
          updated_at?: string
        }
        Update: {
          attachment_path?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          created_by?: string | null
          customer_id?: string
          description?: string | null
          details?: Json
          epass_code?: string | null
          id?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          ticket_no?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
      account_enabled: { Args: { _user_id: string }; Returns: boolean }
      can_view_monitor: { Args: { _monitor_id: string }; Returns: boolean }
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
      announcement_category:
        | "MAINTENANCE"
        | "NETWORK_UPGRADE"
        | "INCIDENT"
        | "GENERAL"
      app_role: "superuser" | "admin" | "operator" | "client"
      bank_account_type: "CORPORATE" | "PERSONAL"
      billing_cycle: "MONTHLY" | "QUARTERLY" | "ANNUALLY"
      billing_doc_status:
        | "PENDING_APPROVAL"
        | "APPROVED"
        | "REJECTED"
        | "SENT"
        | "PAID"
        | "CANCELLED"
      billing_doc_type: "QUO" | "INV" | "PO" | "FMO" | "REC"
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
      monitor_status: "UP" | "DOWN" | "DEGRADED" | "MAINTENANCE" | "PENDING"
      payment_kind:
        | "PROOF_OF_TRANSFER"
        | "PPH23_CERTIFICATE"
        | "SIGNED_DOCUMENT"
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
      ticket_category:
        | "GENERAL"
        | "TECHNICAL"
        | "VISIT_DC"
        | "GOODS_IN"
        | "GOODS_OUT"
        | "REACTIVATION"
        | "BILLING"
      ticket_status: "OPEN" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "CLOSED"
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
      announcement_category: [
        "MAINTENANCE",
        "NETWORK_UPGRADE",
        "INCIDENT",
        "GENERAL",
      ],
      app_role: ["superuser", "admin", "operator", "client"],
      bank_account_type: ["CORPORATE", "PERSONAL"],
      billing_cycle: ["MONTHLY", "QUARTERLY", "ANNUALLY"],
      billing_doc_status: [
        "PENDING_APPROVAL",
        "APPROVED",
        "REJECTED",
        "SENT",
        "PAID",
        "CANCELLED",
      ],
      billing_doc_type: ["QUO", "INV", "PO", "FMO", "REC"],
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
      monitor_status: ["UP", "DOWN", "DEGRADED", "MAINTENANCE", "PENDING"],
      payment_kind: [
        "PROOF_OF_TRANSFER",
        "PPH23_CERTIFICATE",
        "SIGNED_DOCUMENT",
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
      ticket_category: [
        "GENERAL",
        "TECHNICAL",
        "VISIT_DC",
        "GOODS_IN",
        "GOODS_OUT",
        "REACTIVATION",
        "BILLING",
      ],
      ticket_status: ["OPEN", "IN_PROGRESS", "APPROVED", "REJECTED", "CLOSED"],
    },
  },
} as const
