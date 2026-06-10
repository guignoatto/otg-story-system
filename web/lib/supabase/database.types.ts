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
      assets: {
        Row: {
          client_id: string
          created_at: string
          detected_colors: Json
          detected_tone: string | null
          detected_typography: Json
          extracted_text_preview: string | null
          file_name: string
          id: string
          mime_type: string
          notes: string | null
          public_url: string | null
          role: string
          size_bytes: number | null
          source: string
          storage_path: string
        }
        Insert: {
          client_id: string
          created_at?: string
          detected_colors?: Json
          detected_tone?: string | null
          detected_typography?: Json
          extracted_text_preview?: string | null
          file_name: string
          id?: string
          mime_type?: string
          notes?: string | null
          public_url?: string | null
          role: string
          size_bytes?: number | null
          source?: string
          storage_path: string
        }
        Update: {
          client_id?: string
          created_at?: string
          detected_colors?: Json
          detected_tone?: string | null
          detected_typography?: Json
          extracted_text_preview?: string | null
          file_name?: string
          id?: string
          mime_type?: string
          notes?: string | null
          public_url?: string | null
          role?: string
          size_bytes?: number | null
          source?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          brand_manual_summary: string | null
          city: string | null
          color_palette: string[]
          created_at: string
          id: string
          instagram: string | null
          manual_status: string | null
          media_source_url: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          slug: string
          synthetic_manual: string | null
          tone: string | null
          typography: string[]
          updated_at: string
        }
        Insert: {
          brand_manual_summary?: string | null
          city?: string | null
          color_palette?: string[]
          created_at?: string
          id?: string
          instagram?: string | null
          manual_status?: string | null
          media_source_url?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          slug: string
          synthetic_manual?: string | null
          tone?: string | null
          typography?: string[]
          updated_at?: string
        }
        Update: {
          brand_manual_summary?: string | null
          city?: string | null
          color_palette?: string[]
          created_at?: string
          id?: string
          instagram?: string | null
          manual_status?: string | null
          media_source_url?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          slug?: string
          synthetic_manual?: string | null
          tone?: string | null
          typography?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      frames: {
        Row: {
          ai_asset_id: string | null
          body: string | null
          created_at: string
          cta: string | null
          headline: string | null
          id: string
          idx: number
          layout_style: string | null
          media_asset_id: string | null
          package_id: string
          refs: Json
          visual_direction: string | null
        }
        Insert: {
          ai_asset_id?: string | null
          body?: string | null
          created_at?: string
          cta?: string | null
          headline?: string | null
          id?: string
          idx: number
          layout_style?: string | null
          media_asset_id?: string | null
          package_id: string
          refs?: Json
          visual_direction?: string | null
        }
        Update: {
          ai_asset_id?: string | null
          body?: string | null
          created_at?: string
          cta?: string | null
          headline?: string | null
          id?: string
          idx?: number
          layout_style?: string | null
          media_asset_id?: string | null
          package_id?: string
          refs?: Json
          visual_direction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frames_ai_asset_id_fkey"
            columns: ["ai_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frames_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frames_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          brand_score: number | null
          brief: Json
          client_id: string
          cost_brl: number
          created_at: string
          cta: string | null
          error_message: string | null
          frames_count: number
          id: string
          objective: string
          offer: string | null
          output_format: string
          performance_score: number | null
          rationale: string | null
          status: string
          story_type: string
          updated_at: string
        }
        Insert: {
          brand_score?: number | null
          brief?: Json
          client_id: string
          cost_brl?: number
          created_at?: string
          cta?: string | null
          error_message?: string | null
          frames_count?: number
          id?: string
          objective: string
          offer?: string | null
          output_format?: string
          performance_score?: number | null
          rationale?: string | null
          status?: string
          story_type: string
          updated_at?: string
        }
        Update: {
          brand_score?: number | null
          brief?: Json
          client_id?: string
          cost_brl?: number
          created_at?: string
          cta?: string | null
          error_message?: string | null
          frames_count?: number
          id?: string
          objective?: string
          offer?: string | null
          output_format?: string
          performance_score?: number | null
          rationale?: string | null
          status?: string
          story_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
