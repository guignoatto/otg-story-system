from __future__ import annotations

from dataclasses import dataclass
from typing import List
import re
import unicodedata

from .models import AgentTrace, StoryCampaignInput, StoryFrame


HEIM_FORBIDDEN_TERMS = (
    "almoco",
    "almoço",
    "salao",
    "salão",
    "visita",
    "reserva",
    "reservas",
    "mesa esperando",
    "mesa posta",
    "roteiro",
    "sair da rota",
    "passar aqui",
    "vir conhecer",
)

HEIM_CONTEXT = (
    "Heim e um delivery noturno. Conteudos devem falar de noite, jantar, pedido, conforto em casa "
    "e experiencia de delivery. Nao mencionar almoco, salao, visita, mesa no restaurante ou reserva."
)


@dataclass
class AgentContext:
    campaign: StoryCampaignInput
    references: List[str]
    content_pillars: List[str]
    copy_snippets: List[str]
    art_directions: List[str]
    curated_media: List[str]
    curated_assets: List
    frames: List[StoryFrame]


def briefing_agent(campaign: StoryCampaignInput) -> AgentTrace:
    source_note = " com pasta de midias vinculada" if campaign.media_source_url else ""
    context_note = f" Perfil operacional: {HEIM_CONTEXT}" if _is_heim(campaign) else ""
    return AgentTrace(
        name="briefing_agent",
        input_summary=f"Objetivo={campaign.objective}, tema={campaign.offer}",
        output_summary=f"Briefing validado com foco em conteudo organico para restaurante{source_note}.{context_note}",
    )


def brand_guard_agent(ctx: AgentContext) -> AgentTrace:
    m = ctx.campaign.manual
    manual_note = f"; manual anexado={m.manual_asset.file_name}" if m.manual_asset else ""
    return AgentTrace(
        name="brand_guard_agent",
        input_summary=f"Marca={m.brand_name}, tom={m.tone_of_voice}",
        output_summary=(
            f"Paleta={', '.join(m.color_palette[:3])}; fontes={', '.join(m.typography)}{manual_note}. "
            "Politica critica: IA nao pode criar, redesenhar, completar ou estilizar logo; logo oficial deve ser aplicado fora da IA."
        ),
    )


def trend_reference_agent(ctx: AgentContext) -> AgentTrace:
    st = ctx.campaign.story_type
    base = {
        "promocao": [
            "Close-up de prato com overlay editorial minimalista",
            "Sequencia com desejo, contexto e pergunta para resposta",
            "Selo editorial discreto sem simular ferramenta interativa do Instagram",
        ],
        "bastidor": [
            "Mao na massa em cozinha aberta",
            "Sequencia em 3 atos: preparo, montagem, entrega",
            "Texto curto com foco em autenticidade",
        ],
        "prova_social": [
            "Depoimento curto em cartao",
            "Print de avaliacao com destaque visual",
            "Antes/depois de cuidado no pedido",
        ],
        "cardapio": [
            "Destaque do cardapio com foco em sabor e textura",
            "Carrossel vertical de 3 itens com contraste alto",
            "Selo de mais pedido da casa",
        ],
        "urgencia": [
            "Lembrete do momento do dia com composicao forte",
            "Ritual de consumo com numeracao visual",
            "Chamada curta para responder ou compartilhar no direct sem simular botao",
        ],
    }
    ctx.references = base[st.value]
    return AgentTrace(
        name="trend_reference_agent",
        input_summary=f"Tipo={st.value}",
        output_summary=f"{len(ctx.references)} referencias selecionadas.",
    )


def content_strategy_agent(ctx: AgentContext) -> AgentTrace:
    objective = ctx.campaign.objective.value
    strategies = {
        "vendas": ["Desejo", "Produto", "Momento", "Lembrete"],
        "reservas": ["Ambiente", "Experiencia", "Ocasião", "Lembrete"],
        "engajamento": ["Pergunta", "Bastidor", "Interacao", "Compartilhamento"],
        "awareness": ["Identidade", "Historia", "Experiencia", "Memoria"],
        "alcance_local": ["Localizacao", "Rotina", "Convite", "Compartilhamento"],
        "relacionamento": ["Proximidade", "Equipe", "Ritual", "Conversa"],
    }
    ctx.content_pillars = strategies.get(objective, ["Gancho", "Autoridade", "Interacao", "Lembrete"])
    return AgentTrace(
        name="content_strategy_agent",
        input_summary=f"Objetivo={objective}",
        output_summary=f"Pilares={', '.join(ctx.content_pillars)}",
    )


def copywriting_agent(ctx: AgentContext) -> AgentTrace:
    c = ctx.campaign
    city = _safe_location(c.manual.city)
    nbh = c.manual.neighborhood or "sua regiao"
    objective = c.objective.value
    theme = _safe_theme(c.offer)
    headline_theme = _compact_headline_theme(theme)
    restaurant = c.restaurant_name
    if _is_heim(c):
        ctx.copy_snippets = _heim_copy_snippets(objective, theme, city)
    elif objective == "engajamento":
        ctx.copy_snippets = [
            f"Qual momento combina mais com {restaurant} hoje?",
            "Hoje combina com mesa cheia ou pedido para dividir?",
            f"Um pedaco da nossa rotina em {city}",
            "Manda para quem precisa conhecer",
            "Tem sabor que muda o dia",
            "Quem voce levaria para esse momento?",
        ]
    elif objective == "awareness":
        ctx.copy_snippets = [
            f"A identidade da {restaurant} aparece nos detalhes",
            f"Uma experiencia de {city} para lembrar com calma",
            "Sabor, ambiente e historia no mesmo encontro",
            "Uma lembranca para o proximo encontro",
            "A casa tambem conta uma historia",
            "Gastronomia com personalidade propria",
        ]
    elif objective == "alcance_local":
        ctx.copy_snippets = [
            f"Se voce esta em {city}, {restaurant} precisa entrar no seu roteiro",
            f"Uma pausa especial para quem circula por {nbh}",
            "Marque alguem que toparia esse programa hoje",
            "Compartilhe com quem ama descobrir bons lugares",
            "Um bom motivo para sair da rota comum",
            f"Um encontro com sabor local em {city}",
        ]
    elif objective == "relacionamento":
        ctx.copy_snippets = [
            "Por tras de cada prato, existe um ritual",
            f"{restaurant} tambem e feita de equipe, cuidado e historia",
            "Um pouco do que acontece antes da mesa estar pronta",
            f"Conta pra gente: qual memoria voce tem com {restaurant}?",
            "Detalhes pequenos fazem a experiencia",
            "A casa vive nos encontros de todos os dias",
        ]
    elif objective == "reservas":
        ctx.copy_snippets = [
            f"Um convite para desacelerar na {restaurant}",
            "Ambiente, sabor e uma mesa esperando bons encontros",
            "Qual momento merece uma pausa especial nesta semana?",
            "Planeje com quem combina esse momento",
            "Tem encontro que merece mesa posta",
            "Uma pausa para viver sem pressa",
        ]
    elif objective == "vendas":
        ctx.copy_snippets = [
            "Seu momento com sabor caseiro",
            f"{headline_theme} com jeito de casa",
            "Aquela vontade que aparece do nada",
            "Um sabor que fica na memoria",
            "Quando o dia pede algo especial",
            "Textura, calor e vontade de repetir",
        ]
    else:
        ctx.copy_snippets = [
            f"{c.restaurant_name} em {city}: {c.offer}",
            f"Sabor de verdade para quem esta em {nbh}",
            "Uma experiencia para entrar no roteiro",
            "Responda ou envie para quem combina com esse momento",
        ]
    return AgentTrace(
        name="copywriting_agent",
        input_summary=f"Tema={c.offer}, chamada organica={c.cta}",
        output_summary="4 blocos de copy gerados com linguagem local.",
    )


def _safe_theme(value: str) -> str:
    cleaned = (value or "").strip()
    blocked = {
        "vender",
        "venda",
        "vendas",
        "promocao",
        "promoção",
        "oferta",
        "anuncio",
        "anúncio",
        "whatsapp",
    }
    if not cleaned or cleaned.lower() in blocked:
        return "Jantar com sabor caseiro"
    return cleaned


def _compact_headline_theme(value: str, max_chars: int = 34) -> str:
    cleaned = (value or "").strip()
    if "," in cleaned:
        cleaned = cleaned.split(",", 1)[0].strip()
    if len(cleaned) <= max_chars:
        return cleaned
    words = cleaned.split()
    compact = []
    for word in words:
        candidate = " ".join([*compact, word])
        if len(candidate) > max_chars:
            break
        compact.append(word)
    return " ".join(compact) or cleaned[:max_chars].strip()


def _safe_location(value: str) -> str:
    cleaned = (value or "").strip()
    lowered = cleaned.lower()
    if not cleaned or "confirmar" in lowered or "unknown" in lowered or "nao sei" in lowered:
        return "sua regiao"
    return cleaned


def _is_heim(campaign: StoryCampaignInput) -> bool:
    return campaign.restaurant_name.strip().lower() == "heim"


def _heim_copy_snippets(objective: str, theme: str, city: str) -> List[str]:
    if objective == "engajamento":
        return [
            "Qual momento combina com a noite de hoje?",
            "Jantar em casa ou pedido para dividir?",
            "Um pedaco da rotina noturna da casa",
            "Manda para quem dividiria esse pedido",
            "Tem sabor que muda a noite",
            "Quem voce chamaria para pedir junto?",
        ]
    if objective == "awareness":
        return [
            "Tradicao alema no conforto de casa",
            f"Uma experiencia de {city} para a noite ficar especial",
            "Sabor, cuidado e historia no mesmo pedido",
            "Uma lembranca para o proximo jantar",
            "A casa tambem chega pelo delivery",
            "Gastronomia com alma alema para a noite",
        ]
    if objective == "alcance_local":
        return [
            f"Delivery com alma alema em {city}",
            "Uma pausa especial para a noite em casa",
            "Mande para quem ama descobrir bons pedidos",
            "Compartilhe com quem pediria hoje",
            "Um bom motivo para pedir algo diferente",
            f"Uma noite com sabor especial em {city}",
        ]
    if objective == "relacionamento":
        return [
            "Por tras de cada pedido, existe um ritual",
            "A Heim tambem e feita de cuidado e historia",
            "Um pouco do que acontece antes do pedido chegar",
            "Conta pra gente: qual sabor lembra a Heim?",
            "Detalhes pequenos fazem a experiencia",
            "A casa vive nos pedidos de todos os dias",
        ]
    if objective == "reservas":
        return [
            "Um convite para desacelerar em casa",
            "Sabor, conforto e uma noite sem pressa",
            "Qual noite merece um pedido especial?",
            "Combine com quem divide esse momento",
            "Tem noite que merece um pedido caprichado",
            "Uma pausa para viver em casa sem pressa",
        ]
    return [
        "Seu jantar com sabor caseiro",
        f"{theme} com jeito de casa",
        "Aquela vontade que aparece no fim do dia",
        "Um sabor que fica na memoria",
        "Quando a noite pede algo especial",
        "Textura, calor e vontade de repetir",
    ]


def art_direction_agent(ctx: AgentContext) -> AgentTrace:
    m = ctx.campaign.manual
    media_names = ctx.curated_media or [asset.file_name for asset in ctx.campaign.media_assets[:3]]
    if media_names:
        media_note = ", ".join(media_names)
    elif ctx.campaign.media_source_url:
        media_note = f"pasta do Google Drive de {ctx.campaign.restaurant_name}"
    else:
        media_note = "banco de imagem do restaurante"
    format_note = "story 1080x1920" if ctx.campaign.output_format.value == "stories" else "carrossel 1080x1350"
    objective = ctx.campaign.objective.value
    if objective in {"engajamento", "relacionamento"}:
        ctx.art_directions = [
            f"Layout pergunta: foto em tela cheia, faixa superior {m.color_palette[2]} e chamada editorial curta",
            "Layout bastidor: imagem com moldura branca irregular e legenda curta",
            f"Layout conversa: dividir imagem e bloco de texto em {m.color_palette[0]}",
            "Layout convite: imagem cheia com chamada de resposta no canto inferior",
        ]
    elif objective in {"awareness", "alcance_local"}:
        ctx.art_directions = [
            "Layout manifesto: foto ambiental real, texto grande central e sem logo gerado por IA",
            f"Layout editorial: margem generosa, cor {m.color_palette[0]} e foto vertical",
            "Layout memoria: close da experiencia com legenda pequena e sofisticada",
            "Layout compartilhavel: frase curta com imagem desfocada no fundo",
        ]
    else:
        ctx.art_directions = [
            f"Layout desejo: midia real ({media_note}) com bloco editorial em {m.color_palette[2]}",
            "Layout produto: foto principal grande e texto curto em alto contraste",
            "Layout prova: imagem com selo de destaque e motivo para compartilhar no direct",
            "Layout lembrete: fundo visual forte, selo organico no rodape e chamada leve",
        ]
    return AgentTrace(
        name="art_direction_agent",
        input_summary=f"Paleta principal={m.color_palette[0:2]}",
        output_summary=f"Direcao visual definida para {format_note}.",
    )


def media_curator_agent(ctx: AgentContext) -> AgentTrace:
    images = [asset for asset in ctx.campaign.media_assets if asset.file_type.startswith("image/")]
    videos = [asset for asset in ctx.campaign.media_assets if asset.file_type.startswith("video/")]
    frames = max(3, min(ctx.campaign.frames, 10))
    ranked_images = _rank_media_assets(images, ctx)
    ranked_videos = _rank_media_assets(videos, ctx)

    def spread(items):
        if len(items) <= frames:
            return items
        # Evita pegar fotos consecutivas muito parecidas do mesmo take.
        step = (len(items) - 1) / max(frames - 1, 1)
        indexes = []
        for i in range(frames):
            index = round(i * step)
            if index not in indexes:
                indexes.append(index)
        cursor = 0
        while len(indexes) < frames and cursor < len(items):
            if cursor not in indexes:
                indexes.append(cursor)
            cursor += 1
        return [items[index] for index in indexes[:frames]]

    if ctx.campaign.story_type.value in {"bastidor", "urgencia"} and ranked_videos:
        selected = ranked_videos[:3] + spread(ranked_images)
    else:
        selected = spread(ranked_images) + ranked_videos[:2]

    ctx.curated_assets = selected[:frames]
    ctx.curated_media = [asset.file_name for asset in ctx.curated_assets]
    if ctx.curated_media:
        blocked_count = len(images) + len(videos) - len(ranked_images) - len(ranked_videos)
        blocked_note = f" {blocked_count} arquivo(s) de baixa seguranca foram evitados." if blocked_count else ""
        summary = f"{len(ctx.curated_media)} midias escolhidas: {', '.join(ctx.curated_media[:3])}.{blocked_note}"
    elif ctx.campaign.media_source_url:
        summary = "Pasta do Drive vinculada, mas nenhuma midia foi importada ainda."
    else:
        summary = "Nenhuma midia real disponivel para curadoria."

    return AgentTrace(
        name="media_curator_agent",
        input_summary=f"Midias recebidas={len(ctx.campaign.media_assets)}",
        output_summary=summary,
    )


def _rank_media_assets(assets: List, ctx: AgentContext) -> List:
    scored = []
    fallback = []
    for index, asset in enumerate(assets):
        score = _media_asset_score(asset, ctx)
        if score <= -80:
            fallback.append((score, index, asset))
            continue
        scored.append((score, index, asset))

    source = scored or fallback
    source.sort(key=lambda item: (-item[0], item[1]))
    return [asset for _, _, asset in source]


def _media_asset_score(asset, ctx: AgentContext) -> int:
    text = _normalize_media_text(" ".join([asset.file_name or "", asset.notes or ""]))
    score = 0
    objective = ctx.campaign.objective.value
    story_type = ctx.campaign.story_type.value

    if "captacoes" in text or "captacao" in text or "takes brutos" in text:
        score += 35
    if any(term in text for term in ("brasa", "churrasco", "carne", "picanha", "espeto", "costela", "corte")):
        score += 45
    if objective == "vendas" and any(term in text for term in ("brasa", "fogo", "churrasco", "chama")):
        score += 30
    if any(term in text for term in ("prato", "comida", "pizza", "frango", "linguica", "linguica", "sobremesa")):
        score += 20

    if "stories" in text or "story" in text:
        score -= 90
    if any(term in text for term in ("segunda", "terca", "ter a", "quarta", "quinta", "sexta", "sabado", "domingo")):
        score -= 70
    if any(term in text for term in ("abertos", "fechado", "fechados", "horario", "aviso", "comunicado")):
        score -= 90
    if any(term in text for term in ("generico", "generica", "gen rico", "gen rica")):
        score -= 30

    if objective in {"vendas", "engajamento"} or story_type == "cardapio":
        if any(term in text for term in ("fachada", "ambiente", "salao", "salao vazio", "placa")):
            score -= 35

    return score


def _normalize_media_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    normalized = normalized.lower()
    return re.sub(r"[^a-z0-9]+", " ", normalized).strip()


def creative_generator_agent(ctx: AgentContext) -> AgentTrace:
    frames = max(3, min(ctx.campaign.frames, 10))
    built = []
    media = ctx.curated_assets or ctx.campaign.media_assets
    if ctx.campaign.output_format.value == "carrossel":
        layout_styles = ["editorial", "split", "full_bleed", "quote", "save_card"]
    else:
        layout_styles = ["editorial", "split", "full_bleed", "quote", "editorial"]
    for i in range(frames):
        headline = ctx.copy_snippets[min(i, len(ctx.copy_snippets) - 1)]
        pillar = ctx.content_pillars[min(i, len(ctx.content_pillars) - 1)]
        asset_note = ""
        selected_asset = None
        if media:
            asset = media[i % len(media)]
            selected_asset = asset
            asset_note = f" Usar a midia real '{asset.file_name}' como base visual."
        elif ctx.campaign.media_source_url:
            asset_note = f" Selecionar uma midia real da pasta do Google Drive de {ctx.campaign.restaurant_name} como base visual."
        body = f"Frame de {pillar.lower()} com foco em interacao organica e lembranca de marca.{asset_note}"
        organic_cta = _organic_cta_for(ctx.campaign.objective.value, i, ctx.campaign.output_format.value)
        built.append(
            StoryFrame(
                index=i + 1,
                headline=headline,
                body=body,
                cta=organic_cta,
                visual_direction=ctx.art_directions[min(i, len(ctx.art_directions) - 1)],
                layout_style=layout_styles[i % len(layout_styles)],
                media_asset_id=selected_asset.asset_id if selected_asset else None,
                media_file_name=selected_asset.file_name if selected_asset else None,
                references=ctx.references[:2],
            )
        )
    ctx.frames = built
    return AgentTrace(
        name="creative_generator_agent",
        input_summary=f"Frames solicitados={ctx.campaign.frames}",
        output_summary=f"{len(ctx.frames)} frames gerados.",
    )


def _organic_cta_for(objective: str, index: int, output_format: str = "stories") -> str:
    if output_format == "carrossel":
        options = {
            "engajamento": ["Comente com quem iria com voce", "Marque alguem que combina", "Compartilhe com alguem", "Salve para rever"],
            "awareness": ["Salve para conhecer", "Compartilhe com quem ama gastronomia", "Guarde esse nome", "Envie para quem combina"],
            "vendas": ["Salve para lembrar", "Marque quem ama esse sabor", "Compartilhe com quem provaria", "Envie para o grupo"],
            "reservas": ["Salve para planejar a visita", "Marque quem iria com voce", "Compartilhe com quem combina", "Envie para decidir o dia"],
            "alcance_local": ["Compartilhe com alguem de Porto Alegre", "Marque quem precisa conhecer", "Salve no seu roteiro", "Envie para o grupo"],
            "relacionamento": ["Comente sua memoria", "Compartilhe com quem conhece", "Salve para rever", "Marque quem lembra da casa"],
        }
    else:
        options = {
            "engajamento": ["Responda no direct", "Mande para quem iria com voce", "Reage se bateu vontade", "Compartilhe no direct"],
            "awareness": ["Lembre desse nome", "Mande para quem ama gastronomia", "Compartilhe no direct", "Veja os proximos stories"],
            "vendas": ["Mande para quem provaria", "Responda: hoje ou fim de semana?", "Reage se bateu vontade", "Envie para o grupo"],
            "reservas": ["Mande para quem iria com voce", "Responda qual dia combina", "Compartilhe no direct", "Combine nos proximos stories"],
            "alcance_local": ["Mande para alguem de Porto Alegre", "Compartilhe no direct", "Envie para quem precisa conhecer", "Mostre para o grupo"],
            "relacionamento": ["Conta pra gente no direct", "Responda com sua memoria", "Reage se lembrou", "Mande para quem conhece a casa"],
        }
    selected = options.get(objective, options["engajamento"])
    return selected[index % len(selected)]


def qa_performance_agent(ctx: AgentContext) -> AgentTrace:
    blocked_terms = [
        "enquete",
        "quiz",
        "vote",
        "arraste",
        "sticker",
        "caixa de pergunta",
        "botao",
        "botão",
        "whatsapp",
        "vender",
        "assinatura da heim",
        "salve este story",
        "peça",
        "peca",
    ]
    if ctx.campaign.output_format.value == "stories":
        blocked_terms.extend(
            [
                "salve",
                "salvar",
                "save",
                "guarde",
                "guardar",
                "salve no roteiro",
                "salve para",
                "link na bio",
                "clique",
                "comente",
            ]
        )
    blocked_terms.extend(_client_forbidden_terms(ctx.campaign))
    replacements = 0
    for frame in ctx.frames:
        combined = f"{frame.headline} {frame.cta} {frame.body} {frame.visual_direction} {frame.layout_style}".lower()
        if any(term in combined for term in blocked_terms):
            frame.cta = _organic_cta_for(
                ctx.campaign.objective.value,
                frame.index + 1,
                ctx.campaign.output_format.value,
            )
            frame.headline = _safe_headline_for(ctx.campaign.objective.value, frame.index)
            if _is_heim(ctx.campaign):
                frame.headline = _safe_heim_headline_for(ctx.campaign.objective.value, frame.index)
            frame.visual_direction = (
                frame.visual_direction
                .replace("sticker de resposta", "chamada editorial curta")
                .replace("sticker", "selo editorial")
                .replace("Sticker", "Selo editorial")
                .replace("enquete", "conversa")
                .replace("Enquete", "Conversa")
                .replace("botao", "selo")
                .replace("botão", "selo")
                .replace("salvar", "responder")
                .replace("Salvar", "Responder")
            )
            frame.body = (
                frame.body
                .replace("sticker", "compartilhamento")
                .replace("Sticker", "Compartilhamento")
                .replace("enquete", "conversa")
                .replace("Enquete", "Conversa")
                .replace("salvar", "responder")
                .replace("Salvar", "Responder")
                .replace("guardar", "lembrar")
                .replace("Guardar", "Lembrar")
            )
            if frame.layout_style == "sticker":
                frame.layout_style = "editorial"
            replacements += 1
    summary = "Criativos aprovados em conformidade com manual da marca e perfil operacional do cliente."
    if replacements:
        summary = (
            f"{replacements} ideia(s) bloqueada(s): sem enquete, quiz, botao falso, sticker interativo "
            "ou CTA impossivel para Stories."
        )
    return AgentTrace(
        name="qa_performance_agent",
        input_summary="Validacao de tom, paleta, legibilidade, chamada organica e bom senso de story.",
        output_summary=summary,
    )


def _safe_headline_for(objective: str, index: int) -> str:
    options = {
        "vendas": [
            "Seu momento com sabor caseiro",
            "Sabor com jeito de casa",
            "Aquela vontade que aparece",
            "Um sabor que fica na memoria",
            "Quando o dia pede algo especial",
            "Textura, calor e vontade de repetir",
        ],
        "engajamento": [
            "Qual momento combina com hoje?",
            "Mesa cheia ou pedido para dividir?",
            "Um pedaco da rotina da casa",
            "Manda para quem precisa conhecer",
            "Tem sabor que muda o dia",
            "Quem iria com voce?",
        ],
        "awareness": [
            "Identidade que aparece nos detalhes",
            "Uma experiencia para lembrar com calma",
            "Sabor, ambiente e historia",
            "Lembre desse nome para depois",
            "A casa tambem conta uma historia",
            "Gastronomia com personalidade propria",
        ],
    }
    selected = options.get(objective, options["vendas"])
    return selected[(index - 1) % len(selected)]


def _safe_heim_headline_for(objective: str, index: int) -> str:
    options = {
        "vendas": [
            "Seu jantar com sabor caseiro",
            "Jantar com jeito de casa",
            "Aquela vontade no fim do dia",
            "Um sabor que fica na memoria",
            "Quando a noite pede algo especial",
            "Textura, calor e vontade de repetir",
        ],
        "engajamento": [
            "Qual momento combina com a noite?",
            "Jantar em casa ou pedido para dividir?",
            "Um pedaco da rotina noturna",
            "Manda para quem pediria junto",
            "Tem sabor que muda a noite",
            "Quem divide esse pedido com voce?",
        ],
        "awareness": [
            "Tradicao alema no conforto de casa",
            "Uma experiencia para a noite",
            "Sabor, cuidado e historia",
            "A casa tambem chega pelo delivery",
            "Gastronomia com alma alema",
            "Uma noite com sabor especial",
        ],
    }
    selected = options.get(objective, options["vendas"])
    return selected[(index - 1) % len(selected)]


def _client_forbidden_terms(campaign: StoryCampaignInput) -> List[str]:
    forbidden = []
    for item in campaign.manual.forbidden_elements:
        note = item.lower()
        forbidden.append(note)
        if "almoco" in note or "almoço" in note:
            forbidden.extend(["almoco", "almoço"])
        if "salao" in note or "salão" in note:
            forbidden.extend(["salao", "salão"])
        if "reserva" in note:
            forbidden.extend(["reserva", "reservas"])
        if "visita" in note:
            forbidden.append("visita")
        if "mesa" in note:
            forbidden.extend(["mesa esperando", "mesa posta", "mesa no restaurante"])
        if "whatsapp" in note:
            forbidden.append("whatsapp")
        if "salvar" in note or "salve" in note:
            forbidden.extend(["salvar", "salve"])
        if "jantar" in note:
            forbidden.append("jantar")
        if "noite" in note or "noturno" in note:
            forbidden.extend(["noite", "noturno"])
        if "delivery" in note and ("nao" in note or "sem" in note):
            forbidden.append("delivery")
        if "rodizio" in note or "rodízio" in note or "sequencia" in note or "sequência" in note:
            if "nao" in note or "sem" in note:
                forbidden.extend(["rodizio", "rodízio", "sequencia", "sequência"])
    if _is_heim(campaign):
        forbidden.extend(HEIM_FORBIDDEN_TERMS)
    return sorted(set(forbidden))
