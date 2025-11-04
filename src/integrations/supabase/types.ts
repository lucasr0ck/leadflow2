export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action_type: string
          entity_type: string | null
          entity_id: string | null
          old_value: Json | null
          new_value: Json | null
          user_agent: string | null
          ip_address: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action_type: string
          entity_type?: string | null
          entity_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          user_agent?: string | null
          ip_address?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action_type?: string
          entity_type?: string | null
          entity_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          user_agent?: string | null
          ip_address?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          created_at: string
          greeting_message: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          team_id: string
        }
        Insert: {
          created_at?: string
          greeting_message?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          team_id: string
        }
        Update: {
          created_at?: string
          greeting_message?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      clicks: {
        Row: {
          campaign_id: string
          created_at: string
          id: number
          seller_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: never
          seller_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: never
          seller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clicks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clicks_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_contacts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          phone_number: string
          seller_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          phone_number?: string
          seller_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          phone_number?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_contacts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          created_at: string
          id: string
          name: string
          team_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          team_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          team_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "sellers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          team_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          team_name: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          team_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_all_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          success: boolean
          message: string
        }[]
      }
      create_campaign_distribution: {
        Args: { campaign_id_param: string; seller_repetitions: Json }
        Returns: {
          success: boolean
          total_links_created: number
          message: string
        }[]
      }
      delete_campaign_and_children: {
        Args: { campaign_id_to_delete: string }
        Returns: {
          success: boolean
          deleted_clicks_count: number
          deleted_links_count: number
          message: string
        }[]
      }
      delete_contact_and_links: {
        Args: { contact_id_to_delete: string }
        Returns: {
          success: boolean
          deleted_links_count: number
          message: string
        }[]
      }
      delete_seller_and_children: {
        Args: { seller_id_to_delete: string }
        Returns: {
          success: boolean
          deleted_contacts_count: number
          deleted_links_count: number
          message: string
        }[]
      }
      get_next_campaign_link: {
        Args: { campaign_slug: string }
        Returns: {
          link_id: string
          whatsapp_url: string
          campaign_id: string
        }[]
      }
      get_campaign_analytics: {
        Args: { 
          team_id_param: string
          start_date: string
          end_date: string
        }
        Returns: {
          campaign_id: string
          campaign_name: string
          campaign_slug: string
          total_clicks: number
        }[]
      }
      get_seller_analytics: {
        Args: { 
          team_id_param: string
          start_date: string
          end_date: string
        }
        Returns: {
          seller_id: string
          seller_name: string
          total_clicks: number
          contacts_count: number
        }[]
      }
      get_daily_clicks: {
        Args: { 
          team_id_param: string
          start_date: string
          end_date: string
        }
        Returns: {
          click_date: string
          total_clicks: number
        }[]
      }
      get_total_clicks: {
        Args: { 
          team_id_param: string
          start_date: string
          end_date: string
        }
        Returns: number
      }
      get_analytics_comparison: {
        Args: { 
          team_id_param: string
          start_date: string
          end_date: string
        }
        Returns: {
          current_period_clicks: number
          previous_period_clicks: number
          growth_percentage: number
        }[]
      }
      get_seller_performance: {
        Args: { 
          team_id_param: string
          start_date: string
          end_date: string
        }
        Returns: {
          seller_id: string
          seller_name: string
          seller_weight: number
          total_clicks: number
          efficiency_score: number
          contacts_count: number
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
