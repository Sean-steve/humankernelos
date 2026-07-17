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
      body_sessions: {
        Row: {
          duration_min: number
          id: string
          intensity: number
          kind: string
          note: string | null
          occurred_at: string
          user_id: string
        }
        Insert: {
          duration_min?: number
          id?: string
          intensity?: number
          kind: string
          note?: string | null
          occurred_at?: string
          user_id: string
        }
        Update: {
          duration_min?: number
          id?: string
          intensity?: number
          kind?: string
          note?: string | null
          occurred_at?: string
          user_id?: string
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          created_at: string
          directive: string | null
          energy: number
          focus: number
          id: string
          mood: number
          note: string | null
          recovery: number
          sleep_hours: number
          stress: number
          user_id: string
        }
        Insert: {
          created_at?: string
          directive?: string | null
          energy: number
          focus: number
          id?: string
          mood: number
          note?: string | null
          recovery: number
          sleep_hours: number
          stress: number
          user_id: string
        }
        Update: {
          created_at?: string
          directive?: string | null
          energy?: number
          focus?: number
          id?: string
          mood?: number
          note?: string | null
          recovery?: number
          sleep_hours?: number
          stress?: number
          user_id?: string
        }
        Relationships: []
      }
      engine_signals: {
        Row: {
          confidence: number | null
          engine: string
          id: string
          metadata: Json
          occurred_at: string
          reliability: number | null
          signal_key: string
          trend: string | null
          user_id: string
          value_num: number | null
          value_text: string | null
        }
        Insert: {
          confidence?: number | null
          engine: string
          id?: string
          metadata?: Json
          occurred_at?: string
          reliability?: number | null
          signal_key: string
          trend?: string | null
          user_id: string
          value_num?: number | null
          value_text?: string | null
        }
        Update: {
          confidence?: number | null
          engine?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          reliability?: number | null
          signal_key?: string
          trend?: string | null
          user_id?: string
          value_num?: number | null
          value_text?: string | null
        }
        Relationships: []
      }
      engines: {
        Row: {
          capabilities: Json
          data_owned: Json
          dependencies: Json
          engine_id: string
          events_consumed: Json
          events_published: Json
          id: string
          installed_at: string
          name: string
          owner: string | null
          permissions: Json
          published_signals: Json
          purpose: string | null
          required_signals: Json
          status: string
          updated_at: string
          user_id: string
          version: string
        }
        Insert: {
          capabilities?: Json
          data_owned?: Json
          dependencies?: Json
          engine_id: string
          events_consumed?: Json
          events_published?: Json
          id?: string
          installed_at?: string
          name: string
          owner?: string | null
          permissions?: Json
          published_signals?: Json
          purpose?: string | null
          required_signals?: Json
          status?: string
          updated_at?: string
          user_id: string
          version?: string
        }
        Update: {
          capabilities?: Json
          data_owned?: Json
          dependencies?: Json
          engine_id?: string
          events_consumed?: Json
          events_published?: Json
          id?: string
          installed_at?: string
          name?: string
          owner?: string | null
          permissions?: Json
          published_signals?: Json
          purpose?: string | null
          required_signals?: Json
          status?: string
          updated_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      hos_events: {
        Row: {
          id: string
          occurred_at: string
          payload: Json
          source_engine: string
          type: string
          user_id: string
        }
        Insert: {
          id?: string
          occurred_at?: string
          payload?: Json
          source_engine: string
          type: string
          user_id: string
        }
        Update: {
          id?: string
          occurred_at?: string
          payload?: Json
          source_engine?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_logs: {
        Row: {
          id: string
          kcal: number
          meal: string
          note: string | null
          occurred_at: string
          protein_g: number
          user_id: string
          water_ml: number
        }
        Insert: {
          id?: string
          kcal?: number
          meal: string
          note?: string | null
          occurred_at?: string
          protein_g?: number
          user_id: string
          water_ml?: number
        }
        Update: {
          id?: string
          kcal?: number
          meal?: string
          note?: string | null
          occurred_at?: string
          protein_g?: number
          user_id?: string
          water_ml?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          becoming: string
          created_at: string
          id: string
          identity_statements: Json
          name: string
          primary_standard: string
          updated_at: string
        }
        Insert: {
          becoming?: string
          created_at?: string
          id: string
          identity_statements?: Json
          name?: string
          primary_standard?: string
          updated_at?: string
        }
        Update: {
          becoming?: string
          created_at?: string
          id?: string
          identity_statements?: Json
          name?: string
          primary_standard?: string
          updated_at?: string
        }
        Relationships: []
      }
      reflections: {
        Row: {
          created_at: string
          entry: string
          id: string
          prompt: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry: string
          id?: string
          prompt: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry?: string
          id?: string
          prompt?: string
          user_id?: string
        }
        Relationships: []
      }
      routine_completions: {
        Row: {
          completed_at: string
          id: string
          routine_key: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          routine_key: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          routine_key?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
