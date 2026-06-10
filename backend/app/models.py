from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class StoryType(str, Enum):
    promocao = "promocao"
    bastidor = "bastidor"
    prova_social = "prova_social"
    cardapio = "cardapio"
    urgencia = "urgencia"


class CampaignObjective(str, Enum):
    vendas = "vendas"
    reservas = "reservas"
    engajamento = "engajamento"
    awareness = "awareness"
    alcance_local = "alcance_local"
    relacionamento = "relacionamento"


class OutputFormat(str, Enum):
    stories = "stories"
    carrossel = "carrossel"


class UploadedAsset(BaseModel):
    asset_id: str
    file_name: str
    file_type: str
    role: str
    url: Optional[str] = None
    notes: Optional[str] = None
    extracted_text_preview: Optional[str] = None
    detected_colors: List[str] = Field(default_factory=list)
    detected_typography: List[str] = Field(default_factory=list)
    detected_tone: Optional[str] = None


class BrandManual(BaseModel):
    brand_name: str
    tone_of_voice: str = "proximo e consultivo"
    color_palette: List[str] = Field(default_factory=lambda: ["#F97316", "#111827", "#FFFFFF"])
    typography: List[str] = Field(default_factory=lambda: ["Poppins", "Montserrat"])
    forbidden_elements: List[str] = Field(default_factory=list)
    neighborhood: Optional[str] = None
    city: str = "Porto Alegre"
    manual_asset: Optional[UploadedAsset] = None
    manual_summary: Optional[str] = None


class StoryCampaignInput(BaseModel):
    restaurant_name: str
    objective: CampaignObjective
    offer: str
    cta: str
    story_type: StoryType
    output_format: OutputFormat = OutputFormat.stories
    frames: int = 4
    locale: str = "pt-BR"
    manual: BrandManual
    media_assets: List[UploadedAsset] = Field(default_factory=list)
    media_source_url: Optional[str] = None


class StoryFrame(BaseModel):
    index: int
    headline: str
    body: str
    cta: str
    visual_direction: str
    layout_style: str = "editorial"
    media_asset_id: Optional[str] = None
    media_file_name: Optional[str] = None
    references: List[str] = Field(default_factory=list)


class StoryPack(BaseModel):
    restaurant_name: str
    objective: CampaignObjective
    story_type: StoryType
    brand_score: float
    performance_score: float
    rationale: str
    frames: List[StoryFrame]


class AgentTrace(BaseModel):
    name: str
    input_summary: str
    output_summary: str


class GenerationResponse(BaseModel):
    pack: StoryPack
    trace: List[AgentTrace]
