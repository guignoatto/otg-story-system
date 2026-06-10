from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.api_v1 import AiImageRequest, _build_ai_image_prompt, _extract_drive_folder_id, _sanitize_ai_cta
from app.models import BrandManual, OutputFormat, StoryCampaignInput, UploadedAsset
from app.orchestrator import run_pipeline

BRAND = BrandManual(
    brand_name="Heim",
    tone_of_voice="tradicional e acolhedor",
    color_palette=["#0B2A1E", "#4598B2", "#F0B05F"],
    typography=["Dragon EF", "Quiche Display"],
    city="Porto Alegre",
    neighborhood="Moinhos de Vento",
)

MEDIA = [
    UploadedAsset(
        asset_id=f"IMG_{6471 + idx}.HEIC",
        file_name=f"IMG_{6471 + idx}.HEIC.png",
        file_type="image/png",
        role="media",
        url=f"/uploads/heim/IMG_{6471 + idx}.HEIC.png",
    )
    for idx in range(8)
]

STORY_BLOCKED = (
    "salve",
    "salvar",
    "guarde",
    "guardar",
    "save_card",
    "whatsapp",
    "enquete",
    "quiz",
    "sticker",
    "clique",
    "comente",
    "assinatura da heim",
    "vender",
    "peça",
    "peca",
    "almoço",
    "almoco",
    "salao",
    "salão",
    "visita",
    "mesa esperando",
    "mesa posta",
    "roteiro",
    "passar aqui",
    "vir conhecer",
)


def make_campaign(objective: str, output_format: str = "stories", offer: str = "Vender", frames: int = 5) -> StoryCampaignInput:
    return StoryCampaignInput(
        restaurant_name="Heim",
        objective=objective,
        offer=offer,
        cta="Salve este story para lembrar depois",
        story_type="cardapio",
        output_format=output_format,
        frames=frames,
        manual=BRAND.model_copy(deep=True),
        media_assets=MEDIA,
        media_source_url="",
    )


def pack_text(pack) -> str:
    return json.dumps(pack.model_dump(), ensure_ascii=False).lower()


def frames_text(pack) -> str:
    return json.dumps([frame.model_dump() for frame in pack.frames], ensure_ascii=False).lower()


def assert_no_story_blocked_terms(pack) -> None:
    text = frames_text(pack)
    found = [term for term in STORY_BLOCKED if term in text]
    assert not found, f"Termos proibidos em Stories encontrados: {found}\n{text}"


def assert_headlines_are_unique(pack) -> None:
    headlines = [frame.headline for frame in pack.frames]
    assert len(headlines) == len(set(headlines)), f"Headlines repetidas: {headlines}"


def assert_media_are_spread(pack) -> None:
    media = [frame.media_file_name for frame in pack.frames]
    assert len(media) == len(set(media)), f"Midias repetidas: {media}"


def test_all_story_objectives_are_native_to_stories() -> None:
    objectives = ["vendas", "reservas", "engajamento", "awareness", "alcance_local", "relacionamento"]
    for objective in objectives:
        result = run_pipeline(make_campaign(objective=objective, output_format="stories", frames=5))
        assert_no_story_blocked_terms(result.pack)
        assert_headlines_are_unique(result.pack)
        assert_media_are_spread(result.pack)


def test_carousel_can_use_save_language_but_not_story_bad_terms() -> None:
    result = run_pipeline(make_campaign(objective="vendas", output_format="carrossel", frames=5))
    text = pack_text(result.pack)
    assert "whatsapp" not in text
    assert "enquete" not in text
    assert "sticker" not in text
    assert "save_card" in text, "Carrossel pode usar layout de card para salvar/rever."


def test_brand_guard_policy_is_present() -> None:
    result = run_pipeline(make_campaign(objective="awareness", output_format="stories", frames=4))
    brand_trace = next(trace for trace in result.trace if trace.name == "brand_guard_agent")
    assert "nao pode criar" in brand_trace.output_summary.lower()
    assert "redesenhar" in brand_trace.output_summary.lower()
    assert "logo oficial" in brand_trace.output_summary.lower()


def test_ai_prompt_sanitizes_old_bad_frame_inputs() -> None:
    req = AiImageRequest(
        client_id="heim",
        source_image_url="/uploads/heim/IMG_6471.HEIC.png",
        headline="Vender com a assinatura da Heim no almoço",
        body="Frame de sticker com logo e enquete para salvar reserva no salao",
        cta="Salve este story para lembrar depois",
        visual_direction="Layout com logo, sticker de resposta e botao de WhatsApp",
        layout_style="editorial",
        output_format="stories",
    )
    prompt = _build_ai_image_prompt(req).lower()
    assert "salve este story" not in prompt
    assert "vender com a assinatura da heim" not in prompt
    assert "frame de sticker" not in prompt
    assert "botao de whatsapp" not in prompt
    assert "almoço" not in prompt
    assert "almoco" not in prompt
    assert "salao" not in prompt
    assert "reserva no salao" not in prompt
    assert "never create, redraw" in prompt
    assert "do not use save/salve/guardar" in prompt


def test_ai_cta_sanitizer_respects_output_format() -> None:
    assert _sanitize_ai_cta("Salve este story para lembrar", "stories") == "Mande para quem combina"
    assert _sanitize_ai_cta("Salve para lembrar", "carrossel") == "Salve para lembrar"
    assert _sanitize_ai_cta("Vote na enquete", "stories") == "Responda no direct"


def test_drive_folder_id_parser_accepts_common_links() -> None:
    folder_id = "1iSIrPzJbNbl0II8AqSpEaKkIFTRzz9Na"
    assert _extract_drive_folder_id(folder_id) == folder_id
    assert _extract_drive_folder_id(f"https://drive.google.com/drive/folders/{folder_id}?usp=sharing") == folder_id
    assert _extract_drive_folder_id(f"https://drive.google.com/open?id={folder_id}") == folder_id


def test_generic_restaurant_does_not_inherit_heim_context() -> None:
    campaign = make_campaign(objective="reservas", output_format="stories", offer="Pizza da noite", frames=4)
    campaign.restaurant_name = "Pizzaria Venus"
    campaign.manual.brand_name = "Pizzaria Venus"
    campaign.manual.forbidden_elements = []
    result = run_pipeline(campaign)
    text = pack_text(result.pack)
    assert "heim" not in text
    assert "delivery noturno" not in text
    assert "pizzaria venus" in text or "venus" in text

    prompt = _build_ai_image_prompt(
        AiImageRequest(
            client_id="pizzaria-venus",
            source_image_url="/uploads/pizzaria-venus/pizza.png",
            headline="Almoço especial da casa",
            body="Frame editorial com reserva e salao",
            cta="Mande para quem iria com voce",
            visual_direction="Layout produto",
            layout_style="editorial",
            output_format="stories",
            restaurant_name="Pizzaria Venus",
            operational_notes=[],
        )
    ).lower()
    assert "delivery-only" not in prompt
    assert "works at night" not in prompt
    assert "german-inspired" not in prompt
    assert "alma alema" not in prompt
    assert "almoço especial da casa" in prompt or "almoco especial da casa" in prompt


def test_generic_awareness_does_not_use_german_language() -> None:
    campaign = make_campaign(objective="awareness", output_format="stories", offer="Pizza especial", frames=4)
    campaign.restaurant_name = "Pizzaria Venus"
    campaign.manual.brand_name = "Pizzaria Venus"
    campaign.manual.tone_of_voice = "nostalgico, divertido e caloroso"
    campaign.manual.forbidden_elements = []
    result = run_pipeline(campaign)
    text = pack_text(result.pack)
    assert "alem" not in text
    assert "alemã" not in text
    assert "alema" not in text
    assert "heim" not in text


def test_client_notes_block_night_for_lunch_client() -> None:
    campaign = make_campaign(objective="vendas", output_format="stories", offer="Picanha no disco", frames=4)
    campaign.restaurant_name = "Picanha no Disco"
    campaign.manual.brand_name = "Picanha no Disco"
    campaign.manual.tone_of_voice = "popular, objetivo e saboroso"
    campaign.manual.forbidden_elements = [
        "Foco operacional conhecido: almoco e comida de prato.",
        "Nao mencionar jantar/noite sem briefing confirmado.",
    ]
    result = run_pipeline(campaign)
    text = frames_text(result.pack)
    assert "jantar" not in text
    assert "noite" not in text


def run() -> None:
    tests = [
        test_all_story_objectives_are_native_to_stories,
        test_carousel_can_use_save_language_but_not_story_bad_terms,
        test_brand_guard_policy_is_present,
        test_ai_prompt_sanitizes_old_bad_frame_inputs,
        test_ai_cta_sanitizer_respects_output_format,
        test_drive_folder_id_parser_accepts_common_links,
        test_generic_restaurant_does_not_inherit_heim_context,
        test_generic_awareness_does_not_use_german_language,
        test_client_notes_block_night_for_lunch_client,
    ]
    for test in tests:
        test()
        print(f"PASS {test.__name__}")


if __name__ == "__main__":
    run()
