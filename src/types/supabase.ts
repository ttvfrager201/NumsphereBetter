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
          user_id?: string | null
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          plan_id: string
          status: string | null
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          plan_id: string
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          plan_id?: string
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_account_lockout: {
        Args: { user_email: string; is_failed_attempt?: boolean }
        Returns: Json
      }
      check_email_rate_limit: {
        Args: { user_email: string }
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
