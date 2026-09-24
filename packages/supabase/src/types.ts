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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      chain_blocklist: {
        Row: {
          created_at: string
          name: string
          wikidata: string | null
        }
        Insert: {
          created_at?: string
          name: string
          wikidata?: string | null
        }
        Update: {
          created_at?: string
          name?: string
          wikidata?: string | null
        }
        Relationships: []
      }
      cities: {
        Row: {
          country: string
          created_at: string
          id: string
          name: string
          region: string
          slug: string
          status: string
        }
        Insert: {
          country: string
          created_at?: string
          id?: string
          name: string
          region: string
          slug: string
          status?: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          name?: string
          region?: string
          slug?: string
          status?: string
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          log_id: string
          parent_comment_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          log_id: string
          parent_comment_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          log_id?: string
          parent_comment_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      list_items: {
        Row: {
          id: string
          list_id: string
          note: string | null
          position: number
          shop_id: string
        }
        Insert: {
          id?: string
          list_id: string
          note?: string | null
          position: number
          shop_id: string
        }
        Update: {
          id?: string
          list_id?: string
          note?: string | null
          position?: number
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      list_saves: {
        Row: {
          created_at: string
          list_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          list_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_saves_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          body: string | null
          city_id: string | null
          cover_photo_alt: string | null
          created_at: string
          curator_id: string | null
          description: string | null
          id: string
          save_count: number
          slug: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          city_id?: string | null
          cover_photo_alt?: string | null
          created_at?: string
          curator_id?: string | null
          description?: string | null
          id?: string
          save_count?: number
          slug: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          city_id?: string | null
          cover_photo_alt?: string | null
          created_at?: string
          curator_id?: string | null
          description?: string | null
          id?: string
          save_count?: number
          slug?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lists_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      log_likes: {
        Row: {
          created_at: string
          log_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          log_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          log_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_likes_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          created_at: string
          drink: string | null
          id: string
          note: string | null
          rating: number
          shop_id: string
          user_id: string
          visited_at: string
        }
        Insert: {
          created_at?: string
          drink?: string | null
          id?: string
          note?: string | null
          rating: number
          shop_id: string
          user_id: string
          visited_at?: string
        }
        Update: {
          created_at?: string
          drink?: string | null
          id?: string
          note?: string | null
          rating?: number
          shop_id?: string
          user_id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          is_admin: boolean
          onboarded_at: string | null
          status: string
          taste_picks: string[]
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_admin?: boolean
          onboarded_at?: string | null
          status?: string
          taste_picks?: string[]
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
          onboarded_at?: string | null
          status?: string
          taste_picks?: string[]
          username?: string
        }
        Relationships: []
      }
      admin_actions: {
        Row: {
          id: string
          actor_id: string
          target_user_id: string
          action: string
          created_at: string
        }
        Insert: {
          id?: string
          actor_id: string
          target_user_id: string
          action: string
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string
          target_user_id?: string
          action?: string
          created_at?: string
        }
        Relationships: []
      }
      shop_saves: {
        Row: {
          created_at: string
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_saves_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          city_id: string | null
          created_at: string
          external_id: string | null
          hours: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          neighborhood: string | null
          phone: string | null
          promotion_status: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city_id?: string | null
          created_at?: string
          external_id?: string | null
          hours?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          neighborhood?: string | null
          phone?: string | null
          promotion_status?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city_id?: string | null
          created_at?: string
          external_id?: string | null
          hours?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          neighborhood?: string | null
          phone?: string | null
          promotion_status?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shops_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_curations: {
        Row: {
          created_at: string
          editorial_rating: number | null
          order_note: string | null
          price_tier: string
          shop_id: string
          tag: string | null
          writeup: string | null
        }
        Insert: {
          created_at?: string
          editorial_rating?: number | null
          order_note?: string | null
          price_tier?: string
          shop_id: string
          tag?: string | null
          writeup?: string | null
        }
        Update: {
          created_at?: string
          editorial_rating?: number | null
          order_note?: string | null
          price_tier?: string
          shop_id?: string
          tag?: string | null
          writeup?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_curations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      shop_ratings: {
        Row: {
          id: string
          name: string
          lat: number | null
          lng: number | null
          city_id: string | null
          neighborhood: string | null
          is_snob_approved: boolean
          tag: string | null
          price_tier: string | null
          rating: number | null
          log_count: number
        }
        Relationships: []
      }
      admin_user_directory: {
        Row: {
          id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          is_admin: boolean
          status: string
          created_at: string
          log_count: number
          follower_count: number
        }
        Relationships: []
      }
    }
    Functions: {
      log_shop_visit: {
        Args: {
          p_external_id: string
          p_name: string
          p_lat: number
          p_lng: number
          p_rating: number
          p_note?: string
          p_visited_at?: string
          p_drink?: string
          p_address?: string
          p_website?: string
          p_phone?: string
          p_hours?: string
        }
        Returns: { shop_id: string; log_id: string }[]
      }
      admin_set_user_status: {
        Args: {
          p_target_user_id: string
          p_status: string
        }
        Returns: undefined
      }
      admin_set_user_admin: {
        Args: {
          p_target_user_id: string
          p_is_admin: boolean
        }
        Returns: undefined
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
