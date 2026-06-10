export type CampaignObjective =
  | "vendas"
  | "reservas"
  | "engajamento"
  | "awareness"
  | "alcance_local"
  | "relacionamento";

export type OutputFormat = "stories" | "carrossel";
export type StoryType = "promocao" | "bastidor" | "prova_social" | "cardapio" | "urgencia";

export type UploadedAsset = {
  asset_id: string;
  file_name: string;
  file_type: string;
  role: string;
  url?: string | null;
  notes?: string | null;
  extracted_text_preview?: string | null;
  detected_colors: string[];
  detected_typography: string[];
  detected_tone?: string | null;
};

export type BrandManual = {
  brand_name: string;
  tone_of_voice: string;
  color_palette: string[];
  typography: string[];
  forbidden_elements: string[];
  neighborhood?: string | null;
  city: string;
  manual_asset?: UploadedAsset | null;
  manual_summary?: string | null;
};

export type StoryCampaignInput = {
  restaurant_name: string;
  objective: CampaignObjective;
  offer: string;
  cta: string;
  story_type: StoryType;
  output_format: OutputFormat;
  frames: number;
  locale?: string;
  manual: BrandManual;
  media_assets: UploadedAsset[];
  media_source_url?: string | null;
};

export type CreateGenerationRequest = {
  client_id: string;
  campaign: StoryCampaignInput;
};

export type StoryFrame = {
  index: number;
  headline: string;
  body: string;
  cta: string;
  visual_direction: string;
  layout_style: string;
  media_asset_id?: string | null;
  media_file_name?: string | null;
  references: string[];
};

export type StoryPack = {
  restaurant_name: string;
  objective: CampaignObjective;
  story_type: StoryType;
  brand_score: number;
  performance_score: number;
  rationale: string;
  frames: StoryFrame[];
};

export type AgentTrace = {
  name: string;
  input_summary: string;
  output_summary: string;
};

export type GenerationResponse = {
  pack: StoryPack;
  trace: AgentTrace[];
};

export type GenerationJob = {
  job_id: string;
  client_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  created_at: string;
  updated_at: string;
  result?: GenerationResponse | null;
  error_message?: string | null;
  estimated_cost_brl: number;
};

export type GenerationJobList = {
  items: GenerationJob[];
};

export type UsageSummary = {
  client_id: string;
  total_jobs: number;
  completed_jobs: number;
  estimated_total_cost_brl: number;
};

export type AssetUploadResponse = {
  items: UploadedAsset[];
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

export type AiImageRequest = {
  client_id: string;
  source_image_url: string;
  headline: string;
  body: string;
  cta: string;
  visual_direction: string;
  layout_style: string;
  output_format: string;
  quality: string;
  restaurant_name: string;
  color_palette: string[];
  operational_notes: string[];
};

export type AiImageResponse = {
  image_url: string;
  file_name: string;
};

export type ClientProfile = {
  id: string;
  name: string;
  city: string;
  neighborhood: string;
  tone: string;
  color_palette: string;
  typography: string;
  media_source_url: string;
  notes: string;
  instagram: string;
  manual_status: string;
  synthetic_manual: string;
};

export type CampaignFormState = {
  restaurantName: string;
  clientId: string;
  objective: CampaignObjective;
  outputFormat: OutputFormat;
  storyType: StoryType;
  frames: number;
  offer: string;
  cta: string;
  clientNotes: string;
  city: string;
  neighborhood: string;
  toneOfVoice: string;
  colorPalette: string;
  typography: string;
  mediaSourceUrl: string;
};

export type AiImageState = {
  url: string;
  fileName: string;
};
