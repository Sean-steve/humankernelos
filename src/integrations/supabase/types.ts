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
      api_idempotency_keys: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          key: string
          response: Json
          status: number
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          key: string
          response?: Json
          status?: number
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          key?: string
          response?: Json
          status?: number
          user_id?: string
        }
        Relationships: []
      }
      api_request_log: {
        Row: {
          created_at: string
          duration_ms: number
          id: string
          method: string
          path: string
          request_id: string
          status: number
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          id?: string
          method: string
          path: string
          request_id?: string
          status: number
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number
          id?: string
          method?: string
          path?: string
          request_id?: string
          status?: number
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          detail: Json
          id: string
          resource: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          detail?: Json
          id?: string
          resource: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: Json
          id?: string
          resource?: string
          user_id?: string
        }
        Relationships: []
      }
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
      capability_invocations: {
        Row: {
          capability: string
          consumer_engine_id: string
          correlation_id: string | null
          created_at: string
          duration_ms: number
          error: string | null
          id: string
          provider_engine_id: string
          status: string
          user_id: string
        }
        Insert: {
          capability: string
          consumer_engine_id: string
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number
          error?: string | null
          id?: string
          provider_engine_id: string
          status: string
          user_id: string
        }
        Update: {
          capability?: string
          consumer_engine_id?: string
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number
          error?: string | null
          id?: string
          provider_engine_id?: string
          status?: string
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
      connector_credentials: {
        Row: {
          created_at: string
          id: string
          label: string
          provider: string
          secret_ref: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          provider: string
          secret_ref: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          provider?: string
          secret_ref?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      connectors: {
        Row: {
          auth_type: string
          created_at: string
          health: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          name: string
          provider: string
          status: string
          supported_operations: Json
          updated_at: string
          user_id: string
          version: string
        }
        Insert: {
          auth_type?: string
          created_at?: string
          health?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          name: string
          provider: string
          status?: string
          supported_operations?: Json
          updated_at?: string
          user_id: string
          version?: string
        }
        Update: {
          auth_type?: string
          created_at?: string
          health?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
          provider?: string
          status?: string
          supported_operations?: Json
          updated_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      engine_capabilities: {
        Row: {
          capability: string
          created_at: string
          id: string
          input_schema: Json
          output_schema: Json
          provider_engine_id: string
          required_permission: string | null
          status: string
          updated_at: string
          user_id: string
          version: string
        }
        Insert: {
          capability: string
          created_at?: string
          id?: string
          input_schema?: Json
          output_schema?: Json
          provider_engine_id: string
          required_permission?: string | null
          status?: string
          updated_at?: string
          user_id: string
          version?: string
        }
        Update: {
          capability?: string
          created_at?: string
          id?: string
          input_schema?: Json
          output_schema?: Json
          provider_engine_id?: string
          required_permission?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      engine_config: {
        Row: {
          created_at: string
          engine_id: string
          id: string
          is_secret_ref: boolean
          key: string
          updated_at: string
          user_id: string
          value: string | null
        }
        Insert: {
          created_at?: string
          engine_id: string
          id?: string
          is_secret_ref?: boolean
          key: string
          updated_at?: string
          user_id: string
          value?: string | null
        }
        Update: {
          created_at?: string
          engine_id?: string
          id?: string
          is_secret_ref?: boolean
          key?: string
          updated_at?: string
          user_id?: string
          value?: string | null
        }
        Relationships: []
      }
      engine_health_events: {
        Row: {
          created_at: string
          engine_id: string
          health: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          engine_id: string
          health: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          engine_id?: string
          health?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      engine_logs: {
        Row: {
          context: Json
          correlation_id: string | null
          created_at: string
          engine_id: string
          id: string
          level: string
          message: string
          user_id: string
        }
        Insert: {
          context?: Json
          correlation_id?: string | null
          created_at?: string
          engine_id: string
          id?: string
          level?: string
          message: string
          user_id: string
        }
        Update: {
          context?: Json
          correlation_id?: string | null
          created_at?: string
          engine_id?: string
          id?: string
          level?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      engine_permissions: {
        Row: {
          created_at: string
          engine_id: string
          granted: boolean
          id: string
          reason: string | null
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          engine_id: string
          granted?: boolean
          id?: string
          reason?: string | null
          scope: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          engine_id?: string
          granted?: boolean
          id?: string
          reason?: string | null
          scope?: string
          updated_at?: string
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
      engine_storage: {
        Row: {
          created_at: string
          engine_id: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          engine_id: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value?: Json
        }
        Update: {
          created_at?: string
          engine_id?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      engine_subscriptions: {
        Row: {
          created_at: string
          enabled: boolean
          engine_id: string
          event_type: string
          handler: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          engine_id: string
          event_type: string
          handler: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          engine_id?: string
          event_type?: string
          handler?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      engines: {
        Row: {
          capabilities: Json
          data_owned: Json
          dependencies: Json
          engine_id: string
          error_count: number
          events_consumed: Json
          events_published: Json
          health: string
          id: string
          installed_at: string
          last_error: string | null
          last_event_at: string | null
          last_heartbeat_at: string | null
          lifecycle_state: string
          name: string
          owner: string | null
          permissions: Json
          platform_version: string
          published_signals: Json
          purpose: string | null
          required_signals: Json
          sdk_version: string
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
          error_count?: number
          events_consumed?: Json
          events_published?: Json
          health?: string
          id?: string
          installed_at?: string
          last_error?: string | null
          last_event_at?: string | null
          last_heartbeat_at?: string | null
          lifecycle_state?: string
          name: string
          owner?: string | null
          permissions?: Json
          platform_version?: string
          published_signals?: Json
          purpose?: string | null
          required_signals?: Json
          sdk_version?: string
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
          error_count?: number
          events_consumed?: Json
          events_published?: Json
          health?: string
          id?: string
          installed_at?: string
          last_error?: string | null
          last_event_at?: string | null
          last_heartbeat_at?: string | null
          lifecycle_state?: string
          name?: string
          owner?: string | null
          permissions?: Json
          platform_version?: string
          published_signals?: Json
          purpose?: string | null
          required_signals?: Json
          sdk_version?: string
          status?: string
          updated_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      event_schemas: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          event_type: string
          id: string
          payload_schema: Json
          schema_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          payload_schema?: Json
          schema_version?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          payload_schema?: Json
          schema_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hos_event_deliveries: {
        Row: {
          attempts: number
          correlation_id: string | null
          created_at: string
          dead_letter: boolean
          engine_id: string
          event_id: string
          handler: string
          id: string
          last_error: string | null
          next_attempt_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          dead_letter?: boolean
          engine_id: string
          event_id: string
          handler: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          dead_letter?: boolean
          engine_id?: string
          event_id?: string
          handler?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hos_event_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hos_events"
            referencedColumns: ["id"]
          },
        ]
      }
      hos_events: {
        Row: {
          correlation_id: string
          id: string
          idempotency_key: string | null
          occurred_at: string
          payload: Json
          schema_version: number
          source_engine: string
          type: string
          user_id: string
        }
        Insert: {
          correlation_id?: string
          id?: string
          idempotency_key?: string | null
          occurred_at?: string
          payload?: Json
          schema_version?: number
          source_engine: string
          type: string
          user_id: string
        }
        Update: {
          correlation_id?: string
          id?: string
          idempotency_key?: string | null
          occurred_at?: string
          payload?: Json
          schema_version?: number
          source_engine?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      human_states: {
        Row: {
          as_of: string
          behavioral: Json
          cognitive: Json
          composite: number | null
          emotional: Json
          id: string
          lifestyle: Json
          operational: Json
          physical: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          as_of: string
          behavioral?: Json
          cognitive?: Json
          composite?: number | null
          emotional?: Json
          id?: string
          lifestyle?: Json
          operational?: Json
          physical?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          as_of?: string
          behavioral?: Json
          cognitive?: Json
          composite?: number | null
          emotional?: Json
          id?: string
          lifestyle?: Json
          operational?: Json
          physical?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      integration_sync_runs: {
        Row: {
          direction: string
          error: string | null
          finished_at: string | null
          id: string
          provider: string
          records: number
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          direction?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          provider: string
          records?: number
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          direction?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          provider?: string
          records?: number
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      learned_patterns: {
        Row: {
          active: boolean
          axis: string | null
          confidence: number | null
          created_at: string
          description: string
          evidence_count: number
          id: string
          label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          axis?: string | null
          confidence?: number | null
          created_at?: string
          description?: string
          evidence_count?: number
          id?: string
          label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          axis?: string | null
          confidence?: number | null
          created_at?: string
          description?: string
          evidence_count?: number
          id?: string
          label?: string
          updated_at?: string
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
      orchestrator_runs: {
        Row: {
          conflicts: Json
          created_at: string
          fused_axes: Json
          generated_at: string
          id: string
          priorities: Json
          signal_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          conflicts?: Json
          created_at?: string
          fused_axes?: Json
          generated_at?: string
          id?: string
          priorities?: Json
          signal_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          conflicts?: Json
          created_at?: string
          fused_axes?: Json
          generated_at?: string
          id?: string
          priorities?: Json
          signal_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      policies: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          priority: number
          then_action: Json
          updated_at: string
          user_id: string
          when_condition: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          priority?: number
          then_action?: Json
          updated_at?: string
          user_id: string
          when_condition?: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          priority?: number
          then_action?: Json
          updated_at?: string
          user_id?: string
          when_condition?: Json
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
      recommendation_outcomes: {
        Row: {
          created_at: string
          effect: Json
          executed: string
          friction: string | null
          id: string
          measured_at: string
          note: string | null
          recommendation_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          effect?: Json
          executed?: string
          friction?: string | null
          id?: string
          measured_at?: string
          note?: string | null
          recommendation_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          effect?: Json
          executed?: string
          friction?: string | null
          id?: string
          measured_at?: string
          note?: string | null
          recommendation_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_outcomes_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          alternatives: Json
          assumptions: Json
          body: string
          confidence: number | null
          created_at: string
          decided_at: string | null
          evidence: Json
          id: string
          priority: number | null
          risks: Json
          state_alignment: number | null
          status: string
          sustainability: Json
          title: string
          type: string
          urgency: number | null
          user_id: string
        }
        Insert: {
          alternatives?: Json
          assumptions?: Json
          body: string
          confidence?: number | null
          created_at?: string
          decided_at?: string | null
          evidence?: Json
          id?: string
          priority?: number | null
          risks?: Json
          state_alignment?: number | null
          status?: string
          sustainability?: Json
          title: string
          type?: string
          urgency?: number | null
          user_id: string
        }
        Update: {
          alternatives?: Json
          assumptions?: Json
          body?: string
          confidence?: number | null
          created_at?: string
          decided_at?: string | null
          evidence?: Json
          id?: string
          priority?: number | null
          risks?: Json
          state_alignment?: number | null
          status?: string
          sustainability?: Json
          title?: string
          type?: string
          urgency?: number | null
          user_id?: string
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
      signal_conflicts: {
        Row: {
          axis: string
          competing: Json
          created_at: string
          id: string
          reason: string
          resolution: string
          run_id: string | null
          severity: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          axis: string
          competing?: Json
          created_at?: string
          id?: string
          reason?: string
          resolution?: string
          run_id?: string | null
          severity?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          axis?: string
          competing?: Json
          created_at?: string
          id?: string
          reason?: string
          resolution?: string
          run_id?: string | null
          severity?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_conflicts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "orchestrator_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          created_at: string
          error: string | null
          external_id: string | null
          id: string
          payload: Json
          provider: string
          signature_valid: boolean
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          payload?: Json
          provider: string
          signature_valid?: boolean
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          payload?: Json
          provider?: string
          signature_valid?: boolean
          status?: string
          user_id?: string | null
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
