from __future__ import annotations

from .agents import (
    AgentContext,
    art_direction_agent,
    brand_guard_agent,
    briefing_agent,
    content_strategy_agent,
    copywriting_agent,
    creative_generator_agent,
    media_curator_agent,
    qa_performance_agent,
    trend_reference_agent,
)
from .models import GenerationResponse, StoryCampaignInput, StoryPack


def run_pipeline(campaign: StoryCampaignInput) -> GenerationResponse:
    ctx = AgentContext(
        campaign=campaign,
        references=[],
        content_pillars=[],
        copy_snippets=[],
        art_directions=[],
        curated_media=[],
        curated_assets=[],
        frames=[],
    )

    trace = [
        briefing_agent(campaign),
        brand_guard_agent(ctx),
        trend_reference_agent(ctx),
        content_strategy_agent(ctx),
        copywriting_agent(ctx),
        media_curator_agent(ctx),
        art_direction_agent(ctx),
        creative_generator_agent(ctx),
        qa_performance_agent(ctx),
    ]

    pack = StoryPack(
        restaurant_name=campaign.restaurant_name,
        objective=campaign.objective,
        story_type=campaign.story_type,
        brand_score=9.2,
        performance_score=8.8,
        rationale=(
            "Sequencia orientada a conteudo organico com identidade de marca, interacao e lembranca."
        ),
        frames=ctx.frames,
    )
    return GenerationResponse(pack=pack, trace=trace)
