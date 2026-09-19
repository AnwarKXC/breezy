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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounting_ledger_entries: {
        Row: {
          account_category: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          id: string
          income_amount: number
          invoice_id: string | null
          metadata: Json | null
          outcome_amount: number
          reversal_of_transaction_id: string | null
          source_id: string | null
          source_type: string
          transaction_date: string
          transaction_number: string
          type: string
        }
        Insert: {
          account_category?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          id?: string
          income_amount?: number
          invoice_id?: string | null
          metadata?: Json | null
          outcome_amount?: number
          reversal_of_transaction_id?: string | null
          source_id?: string | null
          source_type: string
          transaction_date?: string
          transaction_number: string
          type: string
        }
        Update: {
          account_category?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          id?: string
          income_amount?: number
          invoice_id?: string | null
          metadata?: Json | null
          outcome_amount?: number
          reversal_of_transaction_id?: string | null
          source_id?: string | null
          source_type?: string
          transaction_date?: string
          transaction_number?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_ledger_entries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_ledger_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_ledger_entries_reversal_of_transaction_id_fkey"
            columns: ["reversal_of_transaction_id"]
            isOneToOne: false
            referencedRelation: "accounting_ledger_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["log_action"]
          actor: Json
          created_at: string
          description: string
          external_firebase_id: string | null
          id: string
          metadata: Json | null
          module: Database["public"]["Enums"]["log_module"]
          target: Json | null
        }
        Insert: {
          action: Database["public"]["Enums"]["log_action"]
          actor: Json
          created_at?: string
          description: string
          external_firebase_id?: string | null
          id?: string
          metadata?: Json | null
          module: Database["public"]["Enums"]["log_module"]
          target?: Json | null
        }
        Update: {
          action?: Database["public"]["Enums"]["log_action"]
          actor?: Json
          created_at?: string
          description?: string
          external_firebase_id?: string | null
          id?: string
          metadata?: Json | null
          module?: Database["public"]["Enums"]["log_module"]
          target?: Json | null
        }
        Relationships: []
      }
      audit_logs_archive: {
        Row: {
          action: Database["public"]["Enums"]["log_action"]
          actor: Json
          archived_at: string
          created_at: string
          description: string
          external_firebase_id: string | null
          id: string
          metadata: Json | null
          module: Database["public"]["Enums"]["log_module"]
          target: Json | null
        }
        Insert: {
          action: Database["public"]["Enums"]["log_action"]
          actor: Json
          archived_at?: string
          created_at: string
          description: string
          external_firebase_id?: string | null
          id: string
          metadata?: Json | null
          module: Database["public"]["Enums"]["log_module"]
          target?: Json | null
        }
        Update: {
          action?: Database["public"]["Enums"]["log_action"]
          actor?: Json
          archived_at?: string
          created_at?: string
          description?: string
          external_firebase_id?: string | null
          id?: string
          metadata?: Json | null
          module?: Database["public"]["Enums"]["log_module"]
          target?: Json | null
        }
        Relationships: []
      }
      company_price_overrides: {
        Row: {
          contact_id: string
          created_at: string
          currency: string
          deleted_at: string | null
          id: string
          occupancy_code: Database["public"]["Enums"]["occupancy_code"]
          price: number
          room_category: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          occupancy_code: Database["public"]["Enums"]["occupancy_code"]
          price: number
          room_category: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          occupancy_code?: Database["public"]["Enums"]["occupancy_code"]
          price?: number
          room_category?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_price_overrides_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          id_passport: string | null
          logo: string | null
          name: string
          phone: string | null
          responsible_person: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          id_passport?: string | null
          logo?: string | null
          name: string
          phone?: string | null
          responsible_person?: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          id_passport?: string | null
          logo?: string | null
          name?: string
          phone?: string | null
          responsible_person?: string | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          name_ar: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          name_ar?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          name_ar?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category_id: string
          cost_center: string | null
          created_at: string | null
          created_by: string | null
          date: string
          deleted_at: string | null
          description: string
          id: string
          payment_method: string | null
          receipt_url: string | null
          status: string
          tax_amount: number
          total_amount: number
          updated_at: string | null
          vendor: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category_id: string
          cost_center?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          description: string
          id?: string
          payment_method?: string | null
          receipt_url?: string | null
          status?: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string
          cost_center?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          description?: string
          id?: string
          payment_method?: string | null
          receipt_url?: string | null
          status?: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          country: string | null
          created_at: string
          deleted_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          last_visit: string | null
          passport_number: string | null
          phone: string | null
          status: Database["public"]["Enums"]["guest_status"]
          total_bookings: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          last_visit?: string | null
          passport_number?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["guest_status"]
          total_bookings?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          last_visit?: string | null
          passport_number?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["guest_status"]
          total_bookings?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: []
      }
      invoice_events: {
        Row: {
          actor_id: string | null
          amount_changed: number | null
          created_at: string
          event_type: string
          id: string
          invoice_id: string
          metadata: Json | null
          new_status: string | null
          old_status: string | null
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          amount_changed?: number | null
          created_at?: string
          event_type: string
          id?: string
          invoice_id: string
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          amount_changed?: number | null
          created_at?: string
          event_type?: string
          id?: string
          invoice_id?: string
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          discount_amount: number
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          tax_amount: number
          total_price: number
          type: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          discount_amount?: number
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          tax_amount?: number
          total_price?: number
          type: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          discount_amount?: number
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          tax_amount?: number
          total_price?: number
          type?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          billing_address: string | null
          company_name: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          discount: number
          discount_reason: string | null
          due_date: string
          guest_name: string | null
          id: string
          internal_notes: string | null
          invoice_number: string
          issue_date: string
          issued_at: string | null
          issued_by: string | null
          notes: string | null
          paid_amount: number
          paid_at: string | null
          payment_method: string | null
          public_notes: string | null
          refunded_amount: number
          remaining_balance: number
          reservation_id: string | null
          room_id: string | null
          room_number: string | null
          service_charge: number
          status: string
          stay_check_in: string | null
          stay_check_out: string | null
          subtotal: number
          tax_amount: number
          updated_at: string
          updated_by: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          billing_address?: string | null
          company_name?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          discount?: number
          discount_reason?: string | null
          due_date: string
          guest_name?: string | null
          id?: string
          internal_notes?: string | null
          invoice_number: string
          issue_date?: string
          issued_at?: string | null
          issued_by?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_method?: string | null
          public_notes?: string | null
          refunded_amount?: number
          remaining_balance?: number
          reservation_id?: string | null
          room_id?: string | null
          room_number?: string | null
          service_charge?: number
          status?: string
          stay_check_in?: string | null
          stay_check_out?: string | null
          subtotal?: number
          tax_amount?: number
          updated_at?: string
          updated_by?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          billing_address?: string | null
          company_name?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          discount?: number
          discount_reason?: string | null
          due_date?: string
          guest_name?: string | null
          id?: string
          internal_notes?: string | null
          invoice_number?: string
          issue_date?: string
          issued_at?: string | null
          issued_by?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_method?: string | null
          public_notes?: string | null
          refunded_amount?: number
          remaining_balance?: number
          reservation_id?: string | null
          room_id?: string | null
          room_number?: string | null
          service_charge?: number
          status?: string
          stay_check_in?: string | null
          stay_check_out?: string | null
          subtotal?: number
          tax_amount?: number
          updated_at?: string
          updated_by?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          idempotency_key: string | null
          invoice_id: string
          payment_number: string | null
          received_by: string | null
          refunded_amount: number
          transaction_date: string
          type: Database["public"]["Enums"]["payment_type"]
          updated_at: string | null
          void_reason: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id: string
          payment_number?: string | null
          received_by?: string | null
          refunded_amount?: number
          transaction_date?: string
          type: Database["public"]["Enums"]["payment_type"]
          updated_at?: string | null
          void_reason?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string
          payment_number?: string | null
          received_by?: string | null
          refunded_amount?: number
          transaction_date?: string
          type?: Database["public"]["Enums"]["payment_type"]
          updated_at?: string | null
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      price_override_audit_log: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          needs_review: boolean
          new_rate: number
          night_date: string
          old_rate: number
          permission_level: string
          reason: string
          reservation_id: string
          room_id: string
          threshold_checked: boolean
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          needs_review?: boolean
          new_rate: number
          night_date: string
          old_rate: number
          permission_level: string
          reason: string
          reservation_id: string
          room_id: string
          threshold_checked?: boolean
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          needs_review?: boolean
          new_rate?: number
          night_date?: string
          old_rate?: number
          permission_level?: string
          reason?: string
          reservation_id?: string
          room_id?: string
          threshold_checked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "price_override_audit_log_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_override_audit_log_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string
          external_firebase_id: string | null
          id: string
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email: string
          external_firebase_id?: string | null
          id: string
          name: string
          phone?: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string
          external_firebase_id?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      rate_change_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      reservation_company_info: {
        Row: {
          billing_address: string | null
          company_id: string
          company_name: string
          company_pays: string
          company_price_override_applied: boolean
          company_rate_plan_id: string | null
          contact_person_email: string | null
          contact_person_name: string | null
          contact_person_phone: string | null
          created_at: string
          credit_approved: boolean
          credit_limit: number | null
          id: string
          payment_terms: string
          reservation_id: string
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          company_id: string
          company_name: string
          company_pays?: string
          company_price_override_applied?: boolean
          company_rate_plan_id?: string | null
          contact_person_email?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          created_at?: string
          credit_approved?: boolean
          credit_limit?: number | null
          id?: string
          payment_terms?: string
          reservation_id: string
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          company_id?: string
          company_name?: string
          company_pays?: string
          company_price_override_applied?: boolean
          company_rate_plan_id?: string | null
          contact_person_email?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          created_at?: string
          credit_approved?: boolean
          credit_limit?: number | null
          id?: string
          payment_terms?: string
          reservation_id?: string
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_company_info_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_company_info_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_guests: {
        Row: {
          assigned_room_id: string | null
          contact_id: string | null
          created_at: string
          deleted_at: string | null
          document_number: string | null
          document_type: string | null
          email: string | null
          full_name: string
          guest_id: string | null
          id: string
          is_primary: boolean
          is_vip: boolean
          nationality: string | null
          phone: string | null
          reservation_id: string
          reservation_room_id: string | null
          role: Database["public"]["Enums"]["reservation_guest_role"]
          updated_at: string
        }
        Insert: {
          assigned_room_id?: string | null
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          full_name: string
          guest_id?: string | null
          id?: string
          is_primary?: boolean
          is_vip?: boolean
          nationality?: string | null
          phone?: string | null
          reservation_id: string
          reservation_room_id?: string | null
          role?: Database["public"]["Enums"]["reservation_guest_role"]
          updated_at?: string
        }
        Update: {
          assigned_room_id?: string | null
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          full_name?: string
          guest_id?: string | null
          id?: string
          is_primary?: boolean
          is_vip?: boolean
          nationality?: string | null
          phone?: string | null
          reservation_id?: string
          reservation_room_id?: string | null
          role?: Database["public"]["Enums"]["reservation_guest_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_guests_assigned_room_id_fkey"
            columns: ["assigned_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_guests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_guests_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_guests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_guests_reservation_room_id_fkey"
            columns: ["reservation_room_id"]
            isOneToOne: false
            referencedRelation: "reservation_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_holds: {
        Row: {
          check_in_date: string
          check_out_date: string
          created_at: string
          expires_at: string
          held_by_user_id: string
          id: string
          reservation_id: string | null
          room_id: string
          status: string
          updated_at: string
        }
        Insert: {
          check_in_date: string
          check_out_date: string
          created_at?: string
          expires_at: string
          held_by_user_id: string
          id?: string
          reservation_id?: string | null
          room_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          check_in_date?: string
          check_out_date?: string
          created_at?: string
          expires_at?: string
          held_by_user_id?: string
          id?: string
          reservation_id?: string | null
          room_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_holds_held_by_user_id_fkey"
            columns: ["held_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_holds_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_holds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          message: string
          reservation_id: string
          type: string
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          message: string
          reservation_id: string
          type?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          message?: string
          reservation_id?: string
          type?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_notes_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_pricing_items: {
        Row: {
          applied_rate: number
          base_rate: number
          created_at: string
          currency: string
          discount_amount: number
          discount_type: string | null
          discount_value: number | null
          id: string
          manual_override_by: string | null
          manual_override_reason: string | null
          nights: number
          price_date: string | null
          price_source: Database["public"]["Enums"]["price_source"]
          pricing_level: string
          quantity: number
          rate_per_night_at_booking: number | null
          reservation_id: string
          reservation_room_id: string | null
          room_id: string | null
          room_type_id: string | null
          service_amount: number
          source_ref: string | null
          source_type: string | null
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          applied_rate?: number
          base_rate?: number
          created_at?: string
          currency?: string
          discount_amount?: number
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          manual_override_by?: string | null
          manual_override_reason?: string | null
          nights?: number
          price_date?: string | null
          price_source: Database["public"]["Enums"]["price_source"]
          pricing_level?: string
          quantity?: number
          rate_per_night_at_booking?: number | null
          reservation_id: string
          reservation_room_id?: string | null
          room_id?: string | null
          room_type_id?: string | null
          service_amount?: number
          source_ref?: string | null
          source_type?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          applied_rate?: number
          base_rate?: number
          created_at?: string
          currency?: string
          discount_amount?: number
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          manual_override_by?: string | null
          manual_override_reason?: string | null
          nights?: number
          price_date?: string | null
          price_source?: Database["public"]["Enums"]["price_source"]
          pricing_level?: string
          quantity?: number
          rate_per_night_at_booking?: number | null
          reservation_id?: string
          reservation_room_id?: string | null
          room_id?: string | null
          room_type_id?: string | null
          service_amount?: number
          source_ref?: string | null
          source_type?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_pricing_items_manual_override_by_fkey"
            columns: ["manual_override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_pricing_items_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_pricing_items_reservation_room_id_fkey"
            columns: ["reservation_room_id"]
            isOneToOne: false
            referencedRelation: "reservation_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_rooms: {
        Row: {
          adults: number
          assigned_guest_id: string | null
          check_in_date: string
          check_out_date: string
          children: number
          created_at: string
          deleted_at: string | null
          discount_amount: number
          housekeeping_requirement: string
          id: string
          infants: number
          nights: number
          occupancy_code: Database["public"]["Enums"]["occupancy_code"] | null
          price_source: Database["public"]["Enums"]["price_source"]
          rate_per_night: number
          reservation_id: string
          room_id: string
          room_type_id: string
          status: Database["public"]["Enums"]["reservation_room_status"]
          stay_segment_type: string
          subtotal_amount: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          adults?: number
          assigned_guest_id?: string | null
          check_in_date: string
          check_out_date: string
          children?: number
          created_at?: string
          deleted_at?: string | null
          discount_amount?: number
          housekeeping_requirement?: string
          id?: string
          infants?: number
          nights: number
          occupancy_code?: Database["public"]["Enums"]["occupancy_code"] | null
          price_source?: Database["public"]["Enums"]["price_source"]
          rate_per_night?: number
          reservation_id: string
          room_id: string
          room_type_id: string
          status?: Database["public"]["Enums"]["reservation_room_status"]
          stay_segment_type?: string
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          adults?: number
          assigned_guest_id?: string | null
          check_in_date?: string
          check_out_date?: string
          children?: number
          created_at?: string
          deleted_at?: string | null
          discount_amount?: number
          housekeeping_requirement?: string
          id?: string
          infants?: number
          nights?: number
          occupancy_code?: Database["public"]["Enums"]["occupancy_code"] | null
          price_source?: Database["public"]["Enums"]["price_source"]
          rate_per_night?: number
          reservation_id?: string
          room_id?: string
          room_type_id?: string
          status?: Database["public"]["Enums"]["reservation_room_status"]
          stay_segment_type?: string
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_rooms_assigned_guest_id_fkey"
            columns: ["assigned_guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_rooms_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_rooms_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_status_history: {
        Row: {
          changed_at: string
          changed_by: string
          from_status: string | null
          id: string
          reason: string | null
          reservation_id: string
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          from_status?: string | null
          id?: string
          reason?: string | null
          reservation_id: string
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          reservation_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_status_history_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          adults: number
          balance_amount: number
          billing_party: Database["public"]["Enums"]["billing_party"]
          billing_type: Database["public"]["Enums"]["billing_type"]
          booker_email: string | null
          booker_name: string | null
          booker_phone: string | null
          booking_type: Database["public"]["Enums"]["reservation_booking_type"]
          cancelled_at: string | null
          check_in_date: string
          check_in_time: string | null
          check_out_date: string
          check_out_time: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          children: number
          company_id: string | null
          created_at: string
          created_by: string
          currency: string
          deleted_at: string | null
          discount_amount: number
          guarantee_type: string
          id: string
          infants: number
          internal_notes: string | null
          nights: number
          paid_amount: number
          primary_guest_id: string | null
          reservation_number: string
          room_count: number
          service_amount: number
          source: Database["public"]["Enums"]["reservation_source"]
          special_requests: string | null
          split_percentage: number | null
          status: Database["public"]["Enums"]["reservation_status"]
          subtotal_amount: number
          tax_amount: number
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adults?: number
          balance_amount?: number
          billing_party?: Database["public"]["Enums"]["billing_party"]
          billing_type?: Database["public"]["Enums"]["billing_type"]
          booker_email?: string | null
          booker_name?: string | null
          booker_phone?: string | null
          booking_type: Database["public"]["Enums"]["reservation_booking_type"]
          cancelled_at?: string | null
          check_in_date: string
          check_in_time?: string | null
          check_out_date: string
          check_out_time?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          children?: number
          company_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          deleted_at?: string | null
          discount_amount?: number
          guarantee_type?: string
          id?: string
          infants?: number
          internal_notes?: string | null
          nights: number
          paid_amount?: number
          primary_guest_id?: string | null
          reservation_number?: string
          room_count?: number
          service_amount?: number
          source?: Database["public"]["Enums"]["reservation_source"]
          special_requests?: string | null
          split_percentage?: number | null
          status?: Database["public"]["Enums"]["reservation_status"]
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adults?: number
          balance_amount?: number
          billing_party?: Database["public"]["Enums"]["billing_party"]
          billing_type?: Database["public"]["Enums"]["billing_type"]
          booker_email?: string | null
          booker_name?: string | null
          booker_phone?: string | null
          booking_type?: Database["public"]["Enums"]["reservation_booking_type"]
          cancelled_at?: string | null
          check_in_date?: string
          check_in_time?: string | null
          check_out_date?: string
          check_out_time?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          children?: number
          company_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          deleted_at?: string | null
          discount_amount?: number
          guarantee_type?: string
          id?: string
          infants?: number
          internal_notes?: string | null
          nights?: number
          paid_amount?: number
          primary_guest_id?: string | null
          reservation_number?: string
          room_count?: number
          service_amount?: number
          source?: Database["public"]["Enums"]["reservation_source"]
          special_requests?: string | null
          split_percentage?: number | null
          status?: Database["public"]["Enums"]["reservation_status"]
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_primary_guest_id_fkey"
            columns: ["primary_guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_specific_rates: {
        Row: {
          created_at: string
          created_by: string
          end_date: string
          id: string
          override_rate: number
          reason: string | null
          room_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          override_rate: number
          reason?: string | null
          room_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          override_rate?: number
          reason?: string | null
          room_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_specific_rates_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_status_history: {
        Row: {
          changed_at: string
          changed_by: string
          from_status: string | null
          id: string
          metadata: Json
          reason: string | null
          reservation_id: string | null
          room_id: string
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          from_status?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          reservation_id?: string | null
          room_id: string
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          reservation_id?: string | null
          room_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_status_history_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_status_history_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_type_pricing: {
        Row: {
          created_at: string
          currency: string
          deleted_at: string | null
          effective_from: string | null
          effective_until: string | null
          id: string
          price: number
          price_double: number | null
          price_single: number | null
          price_triple: number | null
          room_type_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          deleted_at?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          price: number
          price_double?: number | null
          price_single?: number | null
          price_triple?: number | null
          room_type_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          deleted_at?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          price?: number
          price_double?: number | null
          price_single?: number | null
          price_triple?: number | null
          room_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_type_pricing_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          amenities: Json
          base_price: number
          created_at: string
          default_capacity: number
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          amenities?: Json
          base_price: number
          created_at?: string
          default_capacity: number
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          amenities?: Json
          base_price?: number
          created_at?: string
          default_capacity?: number
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          amenities: Json
          capacity: number
          created_at: string
          deleted_at: string | null
          floor: number
          id: string
          number: string
          price: number
          room_type_id: string
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
        }
        Insert: {
          amenities?: Json
          capacity: number
          created_at?: string
          deleted_at?: string | null
          floor: number
          id?: string
          number: string
          price: number
          room_type_id: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Update: {
          amenities?: Json
          capacity?: number
          created_at?: string
          deleted_at?: string | null
          floor?: number
          id?: string
          number?: string
          price?: number
          room_type_id?: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      seasonal_rates: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          end_date: string
          id: string
          name: string
          override_rate: number
          room_type_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          end_date: string
          id?: string
          name: string
          override_rate: number
          room_type_id: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          end_date?: string
          id?: string
          name?: string
          override_rate?: number
          room_type_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasonal_rates_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_clean_dirty_rooms: {
        Args: never
        Returns: {
          new_status: string
          old_status: string
          room_id: string
        }[]
      }
      can_write_reservations: { Args: never; Returns: boolean }
      create_reservation_hold: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_hold_duration_minutes?: number
          p_reservation_id?: string
          p_room_id: string
        }
        Returns: Json
      }
      create_reservation_with_rooms: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_contact_id?: string
          p_created_by?: string
          p_guest_id?: string
          p_guest_name?: string
          p_room_type_counts: Json
        }
        Returns: Json
      }
      flag_overrides_for_review: {
        Args: { p_reservation_id: string }
        Returns: undefined
      }
      generate_reservation_number: { Args: never; Returns: string }
      get_room_availability: {
        Args: {
          p_capacity?: number
          p_check_in: string
          p_check_out: string
          p_contact_id?: string
          p_exclude_reservation_id?: string
          p_room_type_id?: string
        }
        Returns: {
          amenities: Json
          base_price: number
          capacity: number
          currency: string
          effective_price: number
          floor: number
          price_double: number
          price_single: number
          price_source: string
          price_triple: number
          reason: string
          room_id: string
          room_number: string
          room_type_id: string
          room_type_name: string
          status: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "accountant" | "front_desk"
      billing_party: "guest" | "company" | "split" | "complimentary"
      billing_type:
        | "guest_pays"
        | "company_room_only"
        | "company_all_charges"
        | "split"
      booking_status:
        | "pending"
        | "booked"
        | "confirmed"
        | "checked-in"
        | "checked-out"
        | "cancelled"
      contact_type: "company" | "individual"
      guest_status: "active" | "inactive" | "vip" | "blacklist"
      log_action:
        | "accounting_created"
        | "accounting_deleted"
        | "accounting_updated"
        | "contact_created"
        | "contact_deleted"
        | "contact_updated"
        | "login"
        | "logout"
        | "reservation_created"
        | "reservation_deleted"
        | "reservation_updated"
        | "user_created"
        | "user_deleted"
        | "user_updated"
        | "user_viewed"
      log_module: "accounting" | "auth" | "contacts" | "reservations" | "users"
      occupancy_code: "S" | "D" | "T"
      payment_type:
        | "instapay" | "vodafone_cash" | "cash" | "bank_transfer" | "visa" | "card" | "online" | "ota" | "company_credit" | "other"
      price_source:
        | "default_room_type_rate"
        | "room_specific_rate"
        | "company_override"
        | "seasonal_rate"
        | "manual_override"
      reservation_booking_type:
        | "individual"
        | "company"
        | "group"
        | "travel_agent"
        | "internal"
      reservation_guest_role:
        | "primary_guest"
        | "additional_guest"
        | "company_guest"
        | "child"
      reservation_payment_method:
        | "cash"
        | "card"
        | "bank_transfer"
        | "company_credit"
        | "voucher"
        | "other"
      reservation_payment_type:
        | "deposit"
        | "partial_payment"
        | "full_payment"
        | "refund"
        | "company_invoice"
        | "guarantee_only"
      reservation_room_status:
        | "selected"
        | "held"
        | "reserved"
        | "occupied"
        | "checked_out"
        | "cancelled"
        | "released"
      reservation_source:
        | "walk_in"
        | "phone"
        | "website"
        | "whatsapp"
        | "email"
        | "company"
        | "travel_agent"
        | "ota"
        | "manual"
      reservation_status:
        | "draft"
        | "held"
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "cancelled"
        | "no_show"
        | "expired"
      room_status:
        | "available"
        | "occupied"
        | "maintenance"
        | "cleaning"
        | "dirty"
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
    Enums: {
      app_role: ["admin", "accountant", "front_desk"],
      billing_party: ["guest", "company", "split", "complimentary"],
      billing_type: [
        "guest_pays",
        "company_room_only",
        "company_all_charges",
        "split",
      ],
      booking_status: [
        "pending",
        "booked",
        "confirmed",
        "checked-in",
        "checked-out",
        "cancelled",
      ],
      contact_type: ["company", "individual"],
      guest_status: ["active", "inactive", "vip", "blacklist"],
      log_action: [
        "accounting_created",
        "accounting_deleted",
        "accounting_updated",
        "contact_created",
        "contact_deleted",
        "contact_updated",
        "login",
        "logout",
        "reservation_created",
        "reservation_deleted",
        "reservation_updated",
        "user_created",
        "user_deleted",
        "user_updated",
        "user_viewed",
      ],
      log_module: ["accounting", "auth", "contacts", "reservations", "users"],
      occupancy_code: ["S", "D", "T"],
      payment_type: ["instapay", "vodafone_cash", "cash", "bank_transfer", "visa", "card", "online", "ota", "company_credit", "other"],
      price_source: [
        "default_room_type_rate",
        "room_specific_rate",
        "company_override",
        "seasonal_rate",
        "manual_override",
      ],
      reservation_booking_type: [
        "individual",
        "company",
        "group",
        "travel_agent",
        "internal",
      ],
      reservation_guest_role: [
        "primary_guest",
        "additional_guest",
        "company_guest",
        "child",
      ],
      reservation_payment_method: [
        "cash",
        "card",
        "bank_transfer",
        "company_credit",
        "voucher",
        "other",
      ],
      reservation_payment_type: [
        "deposit",
        "partial_payment",
        "full_payment",
        "refund",
        "company_invoice",
        "guarantee_only",
      ],
      reservation_room_status: [
        "selected",
        "held",
        "reserved",
        "occupied",
        "checked_out",
        "cancelled",
        "released",
      ],
      reservation_source: [
        "walk_in",
        "phone",
        "website",
        "whatsapp",
        "email",
        "company",
        "travel_agent",
        "ota",
        "manual",
      ],
      reservation_status: [
        "draft",
        "held",
        "confirmed",
        "checked_in",
        "checked_out",
        "cancelled",
        "no_show",
        "expired",
      ],
      room_status: [
        "available",
        "occupied",
        "maintenance",
        "cleaning",
        "dirty",
      ],
    },
  },
} as const

