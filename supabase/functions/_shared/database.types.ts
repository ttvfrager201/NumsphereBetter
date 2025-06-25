export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      user_subscriptions: {
        Row: {
          created_at: string | null;
          id: string;
          plan_id: string;
          status: string | null;
          stripe_checkout_session_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          plan_id: string;
          status?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          plan_id?: string;
          status?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          has_completed_payment: boolean | null;
          id: string;
          image: string | null;
          name: string | null;
          token_identifier: string;
          updated_at: string | null;
          user_id: string | null;
          requires_otp_verification: boolean | null;
          last_otp_verification: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          has_completed_payment?: boolean | null;
          id: string;
          image?: string | null;
          name?: string | null;
          token_identifier: string;
          updated_at?: string | null;
          user_id?: string | null;
          requires_otp_verification?: boolean | null;
          last_otp_verification?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          has_completed_payment?: boolean | null;
          id?: string;
          image?: string | null;
          name?: string | null;
          token_identifier?: string;
          updated_at?: string | null;
          user_id?: string | null;
          requires_otp_verification?: boolean | null;
          last_otp_verification?: string | null;
        };
        Relationships: [];
      };
      twilio_numbers: {
        Row: {
          id: string;
          user_id: string | null;
          phone_number: string;
          twilio_sid: string;
          friendly_name: string | null;
          minutes_allocated: number | null;
          minutes_used: number | null;
          plan_id: string;
          status: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          phone_number: string;
          twilio_sid: string;
          friendly_name?: string | null;
          minutes_allocated?: number | null;
          minutes_used?: number | null;
          plan_id: string;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          phone_number?: string;
          twilio_sid?: string;
          friendly_name?: string | null;
          minutes_allocated?: number | null;
          minutes_used?: number | null;
          plan_id?: string;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      user_devices: {
        Row: {
          id: string;
          user_id: string | null;
          device_fingerprint: string;
          device_name: string | null;
          is_trusted: boolean | null;
          last_login: string | null;
          created_at: string | null;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          device_fingerprint: string;
          device_name?: string | null;
          is_trusted?: boolean | null;
          last_login?: string | null;
          created_at?: string | null;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          device_fingerprint?: string;
          device_name?: string | null;
          is_trusted?: boolean | null;
          last_login?: string | null;
          created_at?: string | null;
          expires_at?: string | null;
        };
        Relationships: [];
      };
      call_flows: {
        Row: {
          id: string;
          user_id: string | null;
          twilio_number_id: string | null;
          flow_name: string;
          flow_config: Json;
          twilio_flow_sid: string | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          twilio_number_id?: string | null;
          flow_name: string;
          flow_config?: Json;
          twilio_flow_sid?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          twilio_number_id?: string | null;
          flow_name?: string;
          flow_config?: Json;
          twilio_flow_sid?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;
