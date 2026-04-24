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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          created_at: string
          doctor: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
          reason: string | null
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          created_at?: string
          doctor: string
          email: string
          first_name: string
          id?: string
          last_name: string
          phone: string
          reason?: string | null
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          created_at?: string
          doctor?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string
          reason?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          duty_date: string | null
          id: string
          worker_id: string
        }
        Insert: {
          duty_date?: string | null
          id?: string
          worker_id: string
        }
        Update: {
          duty_date?: string | null
          id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_settings: {
        Row: {
          client_stages: Json | null
          drip_enabled: boolean | null
          greeting_enabled: boolean | null
          id: string
          pipeline_stages: Json | null
          updated_at: string | null
          whatsapp_templates: Json | null
        }
        Insert: {
          client_stages?: Json | null
          drip_enabled?: boolean | null
          greeting_enabled?: boolean | null
          id?: string
          pipeline_stages?: Json | null
          updated_at?: string | null
          whatsapp_templates?: Json | null
        }
        Update: {
          client_stages?: Json | null
          drip_enabled?: boolean | null
          greeting_enabled?: boolean | null
          id?: string
          pipeline_stages?: Json | null
          updated_at?: string | null
          whatsapp_templates?: Json | null
        }
        Relationships: []
      }
      call_transcripts: {
        Row: {
          agent_id: string | null
          automation_error: string | null
          call_duration_secs: number | null
          called_at: string | null
          conversation_id: string
          created_at: string | null
          id: string
          phone_number: string | null
          transcript_json: Json | null
          transcript_text: string | null
        }
        Insert: {
          agent_id?: string | null
          automation_error?: string | null
          call_duration_secs?: number | null
          called_at?: string | null
          conversation_id: string
          created_at?: string | null
          id?: string
          phone_number?: string | null
          transcript_json?: Json | null
          transcript_text?: string | null
        }
        Update: {
          agent_id?: string | null
          automation_error?: string | null
          call_duration_secs?: number | null
          called_at?: string | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          phone_number?: string | null
          transcript_json?: Json | null
          transcript_text?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          client_name: string
          company_name: string | null
          created_at: string
          email: string | null
          id: string
          phone_number: string | null
        }
        Insert: {
          client_name: string
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          phone_number?: string | null
        }
        Update: {
          client_name?: string
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          phone_number?: string | null
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          message: string | null
          name: string | null
          phone: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          phone?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          phone?: string | null
          status?: string | null
        }
        Relationships: []
      }
      crm_call_logs: {
        Row: {
          automation_error: string | null
          call_id: string
          created_at: string
          duration_seconds: number | null
          id: string
          intent: string | null
          lead_id: string | null
          phone_number: string | null
          recording_url: string | null
          summary: string | null
          transcript: string | null
        }
        Insert: {
          automation_error?: string | null
          call_id: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          intent?: string | null
          lead_id?: string | null
          phone_number?: string | null
          recording_url?: string | null
          summary?: string | null
          transcript?: string | null
        }
        Update: {
          automation_error?: string | null
          call_id?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          intent?: string | null
          lead_id?: string | null
          phone_number?: string | null
          recording_url?: string | null
          summary?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          assigned_worker_name: string | null
          assigned_worker_role: string | null
          created_at: string | null
          drip_step: number | null
          email: string | null
          estimated_value_monthly: number | null
          id: string
          last_greeted_at: string | null
          name: string
          phone: string | null
          pipeline_stage: string
          priority: string | null
          source: string
          status: string
          updated_at: string | null
          whatsapp_number: string | null
        }
        Insert: {
          assigned_worker_name?: string | null
          assigned_worker_role?: string | null
          created_at?: string | null
          drip_step?: number | null
          email?: string | null
          estimated_value_monthly?: number | null
          id?: string
          last_greeted_at?: string | null
          name: string
          phone?: string | null
          pipeline_stage?: string
          priority?: string | null
          source: string
          status: string
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          assigned_worker_name?: string | null
          assigned_worker_role?: string | null
          created_at?: string | null
          drip_step?: number | null
          email?: string | null
          estimated_value_monthly?: number | null
          id?: string
          last_greeted_at?: string | null
          name?: string
          phone?: string | null
          pipeline_stage?: string
          priority?: string | null
          source?: string
          status?: string
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          created_at: string
          employee_id: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          aadhaar_number: string | null
          address: string | null
          assigned_client: string | null
          created_at: string
          deleted_at: string | null
          dob: string | null
          employee_id: string
          experience: string | null
          full_name: string
          gender: string | null
          hourly_rate: number | null
          id: string
          job_title: string
          monthly_daily_rate: number | null
          password_hash: string | null
          phone: string | null
          photo_url: string | null
          preferred_payment_type: string | null
          rating: number | null
          services: string[] | null
          shift_hours: number | null
          short_term_daily_rate: number | null
          status: string
          updated_at: string
          username: string | null
        }
        Insert: {
          aadhaar_number?: string | null
          address?: string | null
          assigned_client?: string | null
          created_at?: string
          deleted_at?: string | null
          dob?: string | null
          employee_id: string
          experience?: string | null
          full_name: string
          gender?: string | null
          hourly_rate?: number | null
          id?: string
          job_title: string
          monthly_daily_rate?: number | null
          password_hash?: string | null
          phone?: string | null
          photo_url?: string | null
          preferred_payment_type?: string | null
          rating?: number | null
          services?: string[] | null
          shift_hours?: number | null
          short_term_daily_rate?: number | null
          status?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          aadhaar_number?: string | null
          address?: string | null
          assigned_client?: string | null
          created_at?: string
          deleted_at?: string | null
          dob?: string | null
          employee_id?: string
          experience?: string | null
          full_name?: string
          gender?: string | null
          hourly_rate?: number | null
          id?: string
          job_title?: string
          monthly_daily_rate?: number | null
          password_hash?: string | null
          phone?: string | null
          photo_url?: string | null
          preferred_payment_type?: string | null
          rating?: number | null
          services?: string[] | null
          shift_hours?: number | null
          short_term_daily_rate?: number | null
          status?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      id_card_links: {
        Row: {
          assignment_id: string
          created_at: string
          employee_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          token: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          employee_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          token: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          employee_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "id_card_links_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "worker_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "id_card_links_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll: {
        Row: {
          advance_amount: number | null
          client_name: string
          created_at: string
          daily_rate: number | null
          days_worked: number | null
          deposit_received: number | null
          id: string
          net_balance: number | null
          payroll_type: string | null
          period_end: string | null
          period_start: string | null
          service_month: string | null
          status: string
          updated_at: string
          worker: string
        }
        Insert: {
          advance_amount?: number | null
          client_name: string
          created_at?: string
          daily_rate?: number | null
          days_worked?: number | null
          deposit_received?: number | null
          id?: string
          net_balance?: number | null
          payroll_type?: string | null
          period_end?: string | null
          period_start?: string | null
          service_month?: string | null
          status: string
          updated_at?: string
          worker: string
        }
        Update: {
          advance_amount?: number | null
          client_name?: string
          created_at?: string
          daily_rate?: number | null
          days_worked?: number | null
          deposit_received?: number | null
          id?: string
          net_balance?: number | null
          payroll_type?: string | null
          period_end?: string | null
          period_start?: string | null
          service_month?: string | null
          status?: string
          updated_at?: string
          worker?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accesses: string[] | null
          avatar: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          accesses?: string[] | null
          avatar?: string | null
          created_at?: string | null
          email: string
          id: string
          name: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          accesses?: string[] | null
          avatar?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_logs: {
        Row: {
          created_at: string | null
          error_code: string | null
          error_message: string | null
          id: number
          payload: Json | null
          sid: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: number
          payload?: Json | null
          sid?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: number
          payload?: Json | null
          sid?: string | null
          status?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          phone: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          phone: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          phone?: string
          role?: string
        }
        Relationships: []
      }
      worker_assignments: {
        Row: {
          assigned_at: string
          assignment_status: string
          client_id: string
          deposit_paid: number | null
          employee_id: string
          id: string
          notes: string | null
        }
        Insert: {
          assigned_at?: string
          assignment_status?: string
          client_id: string
          deposit_paid?: number | null
          employee_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          assigned_at?: string
          assignment_status?: string
          client_id?: string
          deposit_paid?: number | null
          employee_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      workers_legacy: {
        Row: {
          id: string
          name: string
          whatsapp_number: string | null
        }
        Insert: {
          id?: string
          name: string
          whatsapp_number?: string | null
        }
        Update: {
          id?: string
          name?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_crm_lead_robust: {
        Args: { target_lead_id: string }
        Returns: Json
      }
      generate_card_token: { Args: never; Returns: string }
      generate_employee_id: { Args: never; Returns: string }
      get_crm_leads_with_workers: {
        Args: never
        Returns: {
          assigned_worker_name: string
          assigned_worker_role: string
          created_at: string
          full_lead_data: Json
          id: string
          name: string
          phone: string
          pipeline_stage: string
        }[]
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
