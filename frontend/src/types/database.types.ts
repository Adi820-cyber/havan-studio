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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      comments: {
        Row: {
          author_id: string
          author_name: string
          avatar_emoji: string
          created_at: string
          event_id: string
          id: string
          message: string
        }
        Insert: {
          author_id: string
          author_name?: string
          avatar_emoji?: string
          created_at?: string
          event_id: string
          id?: string
          message: string
        }
        Update: {
          author_id?: string
          author_name?: string
          avatar_emoji?: string
          created_at?: string
          event_id?: string
          id?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          byob_note: string | null
          created_at: string
          customization: Json
          description: string | null
          door_code: string | null
          ends_at: string | null
          hide_until_rsvp: boolean
          host_id: string
          host_name: string
          id: string
          slug: string
          starts_at: string
          subtitle: string | null
          theme: Json
          timezone: string
          title: string
          updated_at: string
          venue_address: string | null
          venue_name: string
          vibe_tag: string | null
        }
        Insert: {
          byob_note?: string | null
          created_at?: string
          customization?: Json
          description?: string | null
          door_code?: string | null
          ends_at?: string | null
          hide_until_rsvp?: boolean
          host_id: string
          host_name?: string
          id?: string
          slug: string
          starts_at: string
          subtitle?: string | null
          theme?: Json
          timezone?: string
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string
          vibe_tag?: string | null
        }
        Update: {
          byob_note?: string | null
          created_at?: string
          customization?: Json
          description?: string | null
          door_code?: string | null
          ends_at?: string | null
          hide_until_rsvp?: boolean
          host_id?: string
          host_name?: string
          id?: string
          slug?: string
          starts_at?: string
          subtitle?: string | null
          theme?: Json
          timezone?: string
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string
          vibe_tag?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_emoji: string
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_emoji?: string
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_emoji?: string
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rsvps: {
        Row: {
          contact: string | null
          created_at: string
          dietary_notes: string | null
          event_id: string
          guest_id: string
          guest_name: string
          id: string
          plus_ones: number
          status: string
          updated_at: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          dietary_notes?: string | null
          event_id: string
          guest_id: string
          guest_name?: string
          id?: string
          plus_ones?: number
          status?: string
          updated_at?: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          dietary_notes?: string | null
          event_id?: string
          guest_id?: string
          guest_name?: string
          id?: string
          plus_ones?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_event_slug: { Args: { p_title: string }; Returns: string }
      get_event_comments: {
        Args: { p_limit?: number; p_slug: string }
        Returns: Json
      }
      get_invite: { Args: { p_slug: string }; Returns: Json }
      get_my_invites: { Args: never; Returns: Json }
      has_rsvp_for_event: { Args: { p_event_id: string }; Returns: boolean }
      is_event_host: { Args: { p_event_id: string }; Returns: boolean }
      post_comment: {
        Args: {
          p_author_name?: string
          p_avatar?: string
          p_message: string
          p_slug: string
        }
        Returns: Json
      }
      submit_rsvp: {
        Args: {
          p_contact?: string
          p_dietary_notes?: string
          p_guest_name: string
          p_note?: string
          p_plus_ones?: number
          p_slug: string
          p_status?: string
        }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
