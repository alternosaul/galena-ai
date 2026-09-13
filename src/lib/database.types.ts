export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          default_detector_id: string | null;
          id: boolean;
          input_format: string;
          model_api_url: string | null;
          retries: number;
          timeout_seconds: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          default_detector_id?: string | null;
          id?: boolean;
          input_format?: string;
          model_api_url?: string | null;
          retries?: number;
          timeout_seconds?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          default_detector_id?: string | null;
          id?: boolean;
          input_format?: string;
          model_api_url?: string | null;
          retries?: number;
          timeout_seconds?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "app_settings_default_detector_id_fkey";
            columns: ["default_detector_id"];
            isOneToOne: false;
            referencedRelation: "detectors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      detections: {
        Row: {
          api_detection_id: string | null;
          audio_bytes: number | null;
          audio_path: string | null;
          audio_sha256: string | null;
          call_id: string;
          channels: number | null;
          confidence: number | null;
          created_at: string;
          detector_id: string;
          duration_sec: number | null;
          error_message: string | null;
          file_name: string | null;
          http_status: number | null;
          id: string;
          input_type: Database["public"]["Enums"]["detection_input_type"];
          is_synthetic: boolean | null;
          latency_ms: number | null;
          processing_seconds: number | null;
          request_metadata: Json;
          response_json: Json | null;
          sample_rate: number | null;
          source: string | null;
          status: Database["public"]["Enums"]["detection_status"];
          threshold: number | null;
          user_id: string | null;
        };
        Insert: {
          api_detection_id?: string | null;
          audio_bytes?: number | null;
          audio_path?: string | null;
          audio_sha256?: string | null;
          call_id: string;
          channels?: number | null;
          confidence?: number | null;
          created_at?: string;
          detector_id: string;
          duration_sec?: number | null;
          error_message?: string | null;
          file_name?: string | null;
          http_status?: number | null;
          id?: string;
          input_type: Database["public"]["Enums"]["detection_input_type"];
          is_synthetic?: boolean | null;
          latency_ms?: number | null;
          processing_seconds?: number | null;
          request_metadata?: Json;
          response_json?: Json | null;
          sample_rate?: number | null;
          source?: string | null;
          status?: Database["public"]["Enums"]["detection_status"];
          threshold?: number | null;
          user_id?: string | null;
        };
        Update: {
          api_detection_id?: string | null;
          audio_bytes?: number | null;
          audio_path?: string | null;
          audio_sha256?: string | null;
          call_id?: string;
          channels?: number | null;
          confidence?: number | null;
          created_at?: string;
          detector_id?: string;
          duration_sec?: number | null;
          error_message?: string | null;
          file_name?: string | null;
          http_status?: number | null;
          id?: string;
          input_type?: Database["public"]["Enums"]["detection_input_type"];
          is_synthetic?: boolean | null;
          latency_ms?: number | null;
          processing_seconds?: number | null;
          request_metadata?: Json;
          response_json?: Json | null;
          sample_rate?: number | null;
          source?: string | null;
          status?: Database["public"]["Enums"]["detection_status"];
          threshold?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "detections_detector_id_fkey";
            columns: ["detector_id"];
            isOneToOne: false;
            referencedRelation: "detectors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "detections_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      detector_evaluations: {
        Row: {
          accuracy: number | null;
          auc: number | null;
          balanced_accuracy: number | null;
          brier: number | null;
          created_at: string;
          dataset: string;
          detector_id: string;
          evaluated_at: string;
          f1: number | null;
          false_negatives: number | null;
          false_positives: number | null;
          id: string;
          latency_p50_ms: number | null;
          latency_p95_ms: number | null;
          log_loss: number | null;
          notes: string | null;
          precision: number | null;
          r2: number | null;
          recall: number | null;
          report: Json;
          sample_count: number;
          split: Database["public"]["Enums"]["evaluation_split"];
          threshold: number;
          true_negatives: number | null;
          true_positives: number | null;
        };
        Insert: {
          accuracy?: number | null;
          auc?: number | null;
          balanced_accuracy?: number | null;
          brier?: number | null;
          created_at?: string;
          dataset: string;
          detector_id: string;
          evaluated_at?: string;
          f1?: number | null;
          false_negatives?: number | null;
          false_positives?: number | null;
          id?: string;
          latency_p50_ms?: number | null;
          latency_p95_ms?: number | null;
          log_loss?: number | null;
          notes?: string | null;
          precision?: number | null;
          r2?: number | null;
          recall?: number | null;
          report?: Json;
          sample_count: number;
          split: Database["public"]["Enums"]["evaluation_split"];
          threshold: number;
          true_negatives?: number | null;
          true_positives?: number | null;
        };
        Update: {
          accuracy?: number | null;
          auc?: number | null;
          balanced_accuracy?: number | null;
          brier?: number | null;
          created_at?: string;
          dataset?: string;
          detector_id?: string;
          evaluated_at?: string;
          f1?: number | null;
          false_negatives?: number | null;
          false_positives?: number | null;
          id?: string;
          latency_p50_ms?: number | null;
          latency_p95_ms?: number | null;
          log_loss?: number | null;
          notes?: string | null;
          precision?: number | null;
          r2?: number | null;
          recall?: number | null;
          report?: Json;
          sample_count?: number;
          split?: Database["public"]["Enums"]["evaluation_split"];
          threshold?: number;
          true_negatives?: number | null;
          true_positives?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "detector_evaluations_detector_id_fkey";
            columns: ["detector_id"];
            isOneToOne: false;
            referencedRelation: "detectors";
            referencedColumns: ["id"];
          },
        ];
      };
      detectors: {
        Row: {
          algorithm_en: string | null;
          algorithm_es: string | null;
          api_model_name: string;
          channels: number;
          created_at: string;
          description_en: string;
          description_es: string;
          display_rank: number | null;
          experimental: boolean;
          family: string;
          feature_set: string | null;
          features_en: string | null;
          features_es: string | null;
          id: string;
          is_default: boolean;
          name: string;
          sample_rate: number;
          sort_order: number;
          status: Database["public"]["Enums"]["detector_status"];
          stereo_only: boolean;
          threshold: number;
          trained_on_en: string | null;
          trained_on_es: string | null;
          updated_at: string;
          version: string;
        };
        Insert: {
          algorithm_en?: string | null;
          algorithm_es?: string | null;
          api_model_name: string;
          channels?: number;
          created_at?: string;
          description_en?: string;
          description_es?: string;
          display_rank?: number | null;
          experimental?: boolean;
          family: string;
          feature_set?: string | null;
          features_en?: string | null;
          features_es?: string | null;
          id: string;
          is_default?: boolean;
          name: string;
          sample_rate?: number;
          sort_order?: number;
          status?: Database["public"]["Enums"]["detector_status"];
          stereo_only?: boolean;
          threshold: number;
          trained_on_en?: string | null;
          trained_on_es?: string | null;
          updated_at?: string;
          version?: string;
        };
        Update: {
          algorithm_en?: string | null;
          algorithm_es?: string | null;
          api_model_name?: string;
          channels?: number;
          created_at?: string;
          description_en?: string;
          description_es?: string;
          display_rank?: number | null;
          experimental?: boolean;
          family?: string;
          feature_set?: string | null;
          features_en?: string | null;
          features_es?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          sample_rate?: number;
          sort_order?: number;
          status?: Database["public"]["Enums"]["detector_status"];
          stereo_only?: boolean;
          threshold?: number;
          trained_on_en?: string | null;
          trained_on_es?: string | null;
          updated_at?: string;
          version?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          password_updated_at: string | null;
          provider: Database["public"]["Enums"]["auth_provider"];
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name?: string;
          id: string;
          password_updated_at?: string | null;
          provider?: Database["public"]["Enums"]["auth_provider"];
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          password_updated_at?: string | null;
          provider?: Database["public"]["Enums"]["auth_provider"];
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          ai_alerts: boolean;
          auto_save_history: boolean;
          default_detector_id: string | null;
          email_notifications: boolean;
          language: Database["public"]["Enums"]["language_preference"];
          theme: Database["public"]["Enums"]["theme_preference"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_alerts?: boolean;
          auto_save_history?: boolean;
          default_detector_id?: string | null;
          email_notifications?: boolean;
          language?: Database["public"]["Enums"]["language_preference"];
          theme?: Database["public"]["Enums"]["theme_preference"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_alerts?: boolean;
          auto_save_history?: boolean;
          default_detector_id?: string | null;
          email_notifications?: boolean;
          language?: Database["public"]["Enums"]["language_preference"];
          theme?: Database["public"]["Enums"]["theme_preference"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_preferences_default_detector_id_fkey";
            columns: ["default_detector_id"];
            isOneToOne: false;
            referencedRelation: "detectors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      detector_latest_metrics: {
        Row: {
          accuracy: number | null;
          auc: number | null;
          balanced_accuracy: number | null;
          brier: number | null;
          created_at: string | null;
          dataset: string | null;
          detector_id: string | null;
          evaluated_at: string | null;
          f1: number | null;
          false_negatives: number | null;
          false_positives: number | null;
          id: string | null;
          latency_p50_ms: number | null;
          latency_p95_ms: number | null;
          log_loss: number | null;
          notes: string | null;
          precision: number | null;
          r2: number | null;
          recall: number | null;
          report: Json | null;
          sample_count: number | null;
          split: Database["public"]["Enums"]["evaluation_split"] | null;
          threshold: number | null;
          true_negatives: number | null;
          true_positives: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "detector_evaluations_detector_id_fkey";
            columns: ["detector_id"];
            isOneToOne: false;
            referencedRelation: "detectors";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      app_role: "admin" | "analyst" | "viewer";
      auth_provider: "email" | "google" | "github";
      detection_input_type: "json" | "audio_upload" | "api";
      detection_status: "completed" | "failed";
      detector_status: "active" | "beta" | "deprecated";
      evaluation_split: "train" | "val" | "test" | "alternate";
      language_preference: "es" | "en";
      theme_preference: "light" | "dark" | "system";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "analyst", "viewer"],
      auth_provider: ["email", "google", "github"],
      detection_input_type: ["json", "audio_upload", "api"],
      detection_status: ["completed", "failed"],
      detector_status: ["active", "beta", "deprecated"],
      evaluation_split: ["train", "val", "test", "alternate"],
      language_preference: ["es", "en"],
      theme_preference: ["light", "dark", "system"],
    },
  },
} as const;
