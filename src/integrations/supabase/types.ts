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
      admin_users: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          audio_url: string | null
          category: Database["public"]["Enums"]["lesson_category"]
          content: Json
          created_at: string
          display_order: number
          id: string
          is_published: boolean
          title_ar: string
          title_fr: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          category?: Database["public"]["Enums"]["lesson_category"]
          content?: Json
          created_at?: string
          display_order?: number
          id?: string
          is_published?: boolean
          title_ar: string
          title_fr: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          category?: Database["public"]["Enums"]["lesson_category"]
          content?: Json
          created_at?: string
          display_order?: number
          id?: string
          is_published?: boolean
          title_ar?: string
          title_fr?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          artisan_signature_url: string | null
          caf_number: string | null
          capital_social: string | null
          code_naf: string | null
          company_address: string | null
          company_name: string | null
          created_at: string
          credits_balance: number
          daily_message_count: number
          email: string | null
          foreigner_number: string | null
          full_name: string | null
          header_image_url: string | null
          header_type: string | null
          id: string
          last_message_date: string | null
          legal_footer: string | null
          legal_status: string | null
          logo_url: string | null
          numero_tva: string | null
          phone: string | null
          siret: string | null
          social_security: string | null
          stamp_url: string | null
          updated_at: string
          user_id: string
          ville_immatriculation: string | null
        }
        Insert: {
          address?: string | null
          artisan_signature_url?: string | null
          caf_number?: string | null
          capital_social?: string | null
          code_naf?: string | null
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          credits_balance?: number
          daily_message_count?: number
          email?: string | null
          foreigner_number?: string | null
          full_name?: string | null
          header_image_url?: string | null
          header_type?: string | null
          id?: string
          last_message_date?: string | null
          legal_footer?: string | null
          legal_status?: string | null
          logo_url?: string | null
          numero_tva?: string | null
          phone?: string | null
          siret?: string | null
          social_security?: string | null
          stamp_url?: string | null
          updated_at?: string
          user_id: string
          ville_immatriculation?: string | null
        }
        Update: {
          address?: string | null
          artisan_signature_url?: string | null
          caf_number?: string | null
          capital_social?: string | null
          code_naf?: string | null
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          credits_balance?: number
          daily_message_count?: number
          email?: string | null
          foreigner_number?: string | null
          full_name?: string | null
          header_image_url?: string | null
          header_type?: string | null
          id?: string
          last_message_date?: string | null
          legal_footer?: string | null
          legal_status?: string | null
          logo_url?: string | null
          numero_tva?: string | null
          phone?: string | null
          siret?: string | null
          social_security?: string | null
          stamp_url?: string | null
          updated_at?: string
          user_id?: string
          ville_immatriculation?: string | null
        }
        Relationships: []
      }
      promo_metrics: {
        Row: {
          clicks: number
          created_at: string
          id: string
          promo_id: string
          updated_at: string
          views: number
        }
        Insert: {
          clicks?: number
          created_at?: string
          id?: string
          promo_id: string
          updated_at?: string
          views?: number
        }
        Update: {
          clicks?: number
          created_at?: string
          id?: string
          promo_id?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_answer: number
          created_at: string
          display_order: number
          explanation_ar: string | null
          id: string
          is_published: boolean
          lesson_id: string | null
          options: Json
          question_ar: string
          question_fr: string
          updated_at: string
        }
        Insert: {
          correct_answer?: number
          created_at?: string
          display_order?: number
          explanation_ar?: string | null
          id?: string
          is_published?: boolean
          lesson_id?: string | null
          options?: Json
          question_ar: string
          question_fr: string
          updated_at?: string
        }
        Update: {
          correct_answer?: number
          created_at?: string
          display_order?: number
          explanation_ar?: string | null
          id?: string
          is_published?: boolean
          lesson_id?: string | null
          options?: Json
          question_ar?: string
          question_fr?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_promo_clicks: {
        Args: { p_promo_id: string }
        Returns: undefined
      }
      increment_promo_views: {
        Args: { p_promo_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      lesson_category:
        | "vie_quotidienne"
        | "vie_professionnelle"
        | "droits_devoirs"
        | "histoire_culture"
        | "valeurs_republicaines"
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
      lesson_category: [
        "vie_quotidienne",
        "vie_professionnelle",
        "droits_devoirs",
        "histoire_culture",
        "valeurs_republicaines",
      ],
    },
  },
} as const
