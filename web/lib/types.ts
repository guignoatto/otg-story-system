// Domain types shared between server and client.

export type CampaignObjective =
  | "vendas"
  | "reservas"
  | "engajamento"
  | "awareness"
  | "alcance_local"
  | "relacionamento";

export type OutputFormat = "stories" | "carrossel";
export type StoryType = "promocao" | "bastidor" | "prova_social" | "cardapio" | "urgencia";

export type AssetRole = "manual" | "media" | "ai" | "logo";

export type Asset = {
  id: string;
  client_id: string;
  role: AssetRole;
  file_name: string;
  mime_type: string;
  storage_path: string;
  public_url: string | null;
  size_bytes: number;
  source: "upload" | "drive" | "ai";
  notes: string | null;
  detected_colors: string[];
  detected_typography: string[];
  detected_tone: string | null;
  extracted_text_preview: string | null;
  created_at: string;
};

export type ClientProfile = {
  id: string;
  slug: string;
  name: string;
  city: string;
  neighborhood: string;
  tone: string;
  color_palette: string[];
  typography: string[];
  instagram: string;
  notes: string;
  manual_status: string;
  synthetic_manual: string;
  media_source_url: string;
  brand_manual_summary: string;
  created_at: string;
  updated_at: string;
};

// Payload to create/update a client (UI form -> API).
export type ClientInput = {
  name: string;
  slug?: string;
  city?: string;
  neighborhood?: string;
  tone?: string;
  color_palette?: string[];
  typography?: string[];
  instagram?: string;
  notes?: string;
  manual_status?: string;
  synthetic_manual?: string;
  media_source_url?: string;
  brand_manual_summary?: string;
};

export type Frame = {
  id: string;
  idx: number;
  headline: string;
  body: string;
  cta: string;
  visual_direction: string;
  layout_style: string;
  media_asset_id: string | null;
  ai_asset_id: string | null;
  refs: string[];
};

export type PackageStatus = "queued" | "processing" | "completed" | "failed";

export type StoryPackage = {
  id: string;
  client_id: string;
  status: PackageStatus;
  objective: CampaignObjective;
  story_type: StoryType;
  output_format: OutputFormat;
  frames_count: number;
  offer: string;
  cta: string;
  rationale: string;
  brand_score: number | null;
  performance_score: number | null;
  cost_brl: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  frames: Frame[];
};

export type UsageSummary = {
  client_id: string;
  total_packages: number;
  completed_packages: number;
  estimated_total_cost_brl: number;
};

// Brief used by the generation pipeline.
export type GenerationBrief = {
  client_id: string;
  restaurant_name: string;
  objective: CampaignObjective;
  story_type: StoryType;
  output_format: OutputFormat;
  frames: number;
  offer: string;
  cta: string;
  media_asset_ids?: string[];
};

export type DriveStatusResponse = {
  configured: boolean;
  mode: string;
  service_account_email?: string | null;
  setup_hint: string;
};

export type DriveMediaItem = {
  drive_file_id: string;
  name: string;
  mime_type: string;
  size_bytes?: number | null;
  modified_time?: string | null;
  thumbnail_url?: string | null;
  web_view_link?: string | null;
  folder_path: string[];
};

export type DriveCatalogResponse = {
  configured: boolean;
  mode: string;
  items: DriveMediaItem[];
};

// --- Agent pipeline types ---

export type MediaInsight = {
  asset_id: string;
  file_name: string;
  visual_description: string;
  mood: string;
  quality_score: number;
  best_for: string[];
  avoid_for: string[];
};

export type BrandContext = {
  tone_rules: string[];
  forbidden_words: string[];
  required_elements: string[];
  visual_constraints: string[];
  cta_style: string;
};
