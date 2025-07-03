export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account_lockouts: {
        Row: {
          created_at: string | null
          email: string
          failed_attempts: number | null
          first_failed_at: string | null
          id: string
          last_failed_at: string | null
          locked_until: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          failed_attempts?: number | null
          first_failed_at?: string | null
          id?: string
          last_failed_at?: string | null
          locked_until?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          failed_attempts?: number | null
          first_failed_at?: string | null
          id?: string
          last_failed_at?: string | null
          locked_until?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string | null
          description: string | null
          frontend_url: string | null
          id: string
          is_active: boolean | null
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          frontend_url?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          frontend_url?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      call_flows: {
        Row: {
          created_at: string | null
          flow_config: Json
          flow_name: string
          id: string
          is_active: boolean | null
          twilio_flow_sid: string | null
          twilio_number_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          flow_config?: Json
          flow_name: string
          id?: string
          is_active?: boolean | null
          twilio_flow_sid?: string | null
          twilio_number_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          flow_config?: Json
          flow_name?: string
          id?: string
          is_active?: boolean | null
          twilio_flow_sid?: string | null
          twilio_number_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_flows_twilio_number_id_fkey"
            columns: ["twilio_number_id"]
            isOneToOne: false
            referencedRelation: "twilio_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          call_duration: number | null
          call_minutes: number | null
          call_sid: string
          call_status: string | null
          created_at: string | null
          direction: string
          ended_at: string | null
          flow_id: string | null
          from_number: string
          id: string
          metadata: Json | null
          recording_url: string | null
          started_at: string | null
          to_number: string
          transcription: string | null
          twilio_number_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          call_duration?: number | null
          call_minutes?: number | null
          call_sid: string
          call_status?: string | null
          created_at?: string | null
          direction: string
          ended_at?: string | null
          flow_id?: string | null
          from_number: string
          id?: string
          metadata?: Json | null
          recording_url?: string | null
          started_at?: string | null
          to_number: string
          transcription?: string | null
          twilio_number_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          call_duration?: number | null
          call_minutes?: number | null
          call_sid?: string
          call_status?: string | null
          created_at?: string | null
          direction?: string
          ended_at?: string | null
          flow_id?: string | null
          from_number?: string
          id?: string
          metadata?: Json | null
          recording_url?: string | null
          started_at?: string | null
          to_number?: string
          transcription?: string | null
          twilio_number_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "call_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_twilio_number_id_fkey"
            columns: ["twilio_number_id"]
            isOneToOne: false
            referencedRelation: "twilio_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_rate_limits: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          email: string
          first_attempt_at: string | null
          id: string
          last_attempt_at: string | null
          updated_at: string | null
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          email: string
          first_attempt_at?: string | null
          id?: string
          last_attempt_at?: string | null
          updated_at?: string | null
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          email?: string
          first_attempt_at?: string | null
          id?: string
          last_attempt_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      failed_login_attempts: {
        Row: {
          attempt_count: number | null
          blocked_until: string | null
          created_at: string | null
          email: string
          first_attempt_at: string | null
          id: string
          ip_address: unknown
          last_attempt_at: string | null
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          email: string
          first_attempt_at?: string | null
          id?: string
          ip_address: unknown
          last_attempt_at?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          email?: string
          first_attempt_at?: string | null
          id?: string
          ip_address?: unknown
          last_attempt_at?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      number_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          phone_number: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          phone_number: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          phone_number?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_security_log: {
        Row: {
          action_taken: string | null
          created_at: string | null
          event_type: string
          id: string
          ip_address: unknown | null
          risk_score: number | null
          security_fingerprint: string | null
          session_id: string | null
          suspicious_indicators: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_taken?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          risk_score?: number | null
          security_fingerprint?: string | null
          session_id?: string | null
          suspicious_indicators?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_taken?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          risk_score?: number | null
          security_fingerprint?: string | null
          session_id?: string | null
          suspicious_indicators?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          created_at: string | null
          event_details: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
          severity: string | null
          source: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          severity?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          severity?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscription_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          new_plan_id: string | null
          new_status: string | null
          old_plan_id: string | null
          old_status: string | null
          stripe_event_id: string | null
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_plan_id?: string | null
          new_status?: string | null
          old_plan_id?: string | null
          old_status?: string | null
          stripe_event_id?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_plan_id?: string | null
          new_status?: string | null
          old_plan_id?: string | null
          old_status?: string | null
          stripe_event_id?: string | null
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      twilio_numbers: {
        Row: {
          created_at: string | null
          friendly_name: string | null
          id: string
          minutes_allocated: number | null
          minutes_used: number | null
          phone_number: string
          plan_id: string
          status: string | null
          twilio_sid: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          friendly_name?: string | null
          id?: string
          minutes_allocated?: number | null
          minutes_used?: number | null
          phone_number: string
          plan_id: string
          status?: string | null
          twilio_sid: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          friendly_name?: string | null
          id?: string
          minutes_allocated?: number | null
          minutes_used?: number | null
          phone_number?: string
          plan_id?: string
          status?: string | null
          twilio_sid?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          created_at: string | null
          device_fingerprint: string
          device_name: string | null
          expires_at: string | null
          id: string
          is_trusted: boolean | null
          last_login: string | null
          last_security_check: string | null
          risk_factors: Json | null
          security_score: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_fingerprint: string
          device_name?: string | null
          expires_at?: string | null
          id?: string
          is_trusted?: boolean | null
          last_login?: string | null
          last_security_check?: string | null
          risk_factors?: Json | null
          security_score?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_fingerprint?: string
          device_name?: string | null
          expires_at?: string | null
          id?: string
          is_trusted?: boolean | null
          last_login?: string | null
          last_security_check?: string | null
          risk_factors?: Json | null
          security_score?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          last_payment_date: string | null
          last_updated_by: string | null
          last_verification_attempt: string | null
          payment_verified_at: string | null
          plan_id: string
          security_fingerprint: string | null
          status: string | null
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string | null
          user_id: string | null
          verification_attempts: number | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_payment_date?: string | null
          last_updated_by?: string | null
          last_verification_attempt?: string | null
          payment_verified_at?: string | null
          plan_id: string
          security_fingerprint?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_attempts?: number | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_payment_date?: string | null
          last_updated_by?: string | null
          last_verification_attempt?: string | null
          payment_verified_at?: string | null
          plan_id?: string
          security_fingerprint?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_attempts?: number | null
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          has_completed_payment: boolean | null
          id: string
          image: string | null
          last_otp_verification: string | null
          name: string | null
          requires_otp_verification: boolean | null
          token_identifier: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          has_completed_payment?: boolean | null
          id: string
          image?: string | null
          last_otp_verification?: string | null
          name?: string | null
          requires_otp_verification?: boolean | null
          token_identifier: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          has_completed_payment?: boolean | null
          id?: string
          image?: string | null
          last_otp_verification?: string | null
          name?: string | null
          requires_otp_verification?: boolean | null
          token_identifier?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      webhook_events_log: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          processing_time_ms: number | null
          source: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          processing_time_ms?: number | null
          source?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processing_time_ms?: number | null
          source?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_cleanup_subscriptions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      check_account_lockout: {
        Args: { user_email: string; is_failed_attempt?: boolean }
        Returns: Json
      }
      check_email_rate_limit: {
        Args: { user_email: string }
        Returns: Json
      }
      check_failed_login_attempts: {
        Args: {
          p_email: string
          p_ip_address: unknown
          p_user_agent?: string
          p_max_attempts?: number
          p_lockout_duration_minutes?: number
        }
        Returns: Json
      }
      cleanup_expired_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      clear_failed_login_attempts: {
        Args: { p_email: string; p_ip_address: unknown }
        Returns: undefined
      }
      detect_payment_anomalies: {
        Args: { p_user_id: string; p_session_id?: string }
        Returns: Json
      }
      get_call_analytics: {
        Args: { p_user_id: string; p_start_date?: string; p_end_date?: string }
        Returns: {
          total_calls: number
          total_minutes: number
          inbound_calls: number
          outbound_calls: number
          average_duration: number
          calls_by_day: Json
        }[]
      }
      log_payment_security_event: {
        Args: {
          p_user_id: string
          p_session_id: string
          p_event_type: string
          p_security_fingerprint?: string
          p_ip_address?: unknown
          p_user_agent?: string
          p_suspicious_indicators?: Json
          p_risk_score?: number
          p_action_taken?: string
        }
        Returns: string
      }
      log_security_event: {
        Args: {
          p_user_id: string
          p_event_type: string
          p_event_details?: Json
          p_ip_address?: unknown
          p_user_agent?: string
          p_severity?: string
          p_source?: string
        }
        Returns: string
      }
      track_subscription_change: {
        Args: {
          p_user_id: string
          p_subscription_id: string
          p_old_status: string
          p_new_status: string
          p_old_plan_id?: string
          p_new_plan_id?: string
          p_change_reason?: string
          p_changed_by?: string
          p_stripe_event_id?: string
          p_metadata?: Json
        }
        Returns: string
      }
      validate_payment_session: {
        Args: {
          p_user_id: string
          p_session_id: string
          p_security_fingerprint?: string
        }
        Returns: Json
      }
      validate_subscription_integrity: {
        Args: { p_user_id: string; p_stripe_subscription_id?: string }
        Returns: Json
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
