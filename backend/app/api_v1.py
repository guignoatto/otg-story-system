from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
import base64
from io import BytesIO
import json
import mimetypes
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from threading import Lock
from typing import Dict, List, Optional
from uuid import uuid4
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from .models import GenerationResponse, StoryCampaignInput, UploadedAsset
from .orchestrator import run_pipeline


class JobStatus(str, Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class CreateGenerationRequest(BaseModel):
    client_id: str = Field(description="ID interno OTG do cliente")
    campaign: StoryCampaignInput


class GenerationJob(BaseModel):
    job_id: str
    client_id: str
    status: JobStatus
    created_at: datetime
    updated_at: datetime
    result: Optional[GenerationResponse] = None
    error_message: Optional[str] = None
    estimated_cost_brl: float = 0.0


class GenerationJobList(BaseModel):
    items: List[GenerationJob]


class UsageSummary(BaseModel):
    client_id: str
    total_jobs: int
    completed_jobs: int
    estimated_total_cost_brl: float


class AssetUploadResponse(BaseModel):
    items: List[UploadedAsset]


class DriveImportRequest(BaseModel):
    client_id: str
    folder_url: str
    max_files: int = 12


class DriveCatalogRequest(BaseModel):
    folder_url: str
    max_files: int = 80


class DriveMediaItem(BaseModel):
    drive_file_id: str
    name: str
    mime_type: str
    size_bytes: Optional[int] = None
    modified_time: Optional[str] = None
    thumbnail_url: Optional[str] = None
    web_view_link: Optional[str] = None
    folder_path: List[str] = Field(default_factory=list)


class DriveCatalogResponse(BaseModel):
    configured: bool
    mode: str
    items: List[DriveMediaItem]


class DriveImportSelectedRequest(BaseModel):
    client_id: str
    file_ids: List[str]


class DriveStatusResponse(BaseModel):
    configured: bool
    mode: str
    service_account_email: Optional[str] = None
    setup_hint: str


class AiImageRequest(BaseModel):
    client_id: str
    source_image_url: str
    headline: str
    body: str
    cta: str
    visual_direction: str
    layout_style: str
    output_format: str = "stories"
    quality: str = "medium"
    restaurant_name: str = "restaurante"
    color_palette: List[str] = Field(default_factory=list)
    operational_notes: List[str] = Field(default_factory=list)


class AiImageResponse(BaseModel):
    image_url: str
    file_name: str


class AssetZipRequest(BaseModel):
    client_id: str
    urls: List[str]
    file_name: str = "imagens-ia.zip"


router = APIRouter(prefix="/v1", tags=["v1"])

_JOBS: Dict[str, GenerationJob] = {}
_ASSETS: Dict[str, UploadedAsset] = {}
_IMPORT_MANIFESTS: Dict[str, Dict[str, str]] = {}
_LOCK = Lock()
_UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads"
_OPENAI_IMAGE_MODEL = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-2")
_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
_KNOWN_FONT_HINTS = (
    "Poppins",
    "Montserrat",
    "Inter",
    "Roboto",
    "Open Sans",
    "Lato",
    "Raleway",
    "Playfair",
    "Cormorant",
    "Bebas",
    "Dragon EF",
    "Dragon EF ExtraBold",
    "Quiche Display",
    "Quiche Display light",
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _estimate_cost_brl(payload: StoryCampaignInput) -> float:
    # Heuristica simples para MVP: custo base + custo por frame
    # depois pode trocar por contagem real de tokens/imagens.
    base = 0.25
    per_frame = 0.12
    return round(base + payload.frames * per_frame, 2)


def _safe_client_id(client_id: str) -> str:
    return "".join(ch if ch.isalnum() or ch in ("-", "_") else "-" for ch in client_id)


def _public_upload_url(client_id: str, file_name: str) -> str:
    return f"/uploads/{_safe_client_id(client_id)}/{file_name}"


def _register_local_asset(client_id: str, role: str, source: Path, notes: str) -> UploadedAsset:
    asset_id = str(uuid4())
    client_dir = _UPLOAD_ROOT / _safe_client_id(client_id)
    client_dir.mkdir(parents=True, exist_ok=True)
    suffix = source.suffix
    safe_name = f"{asset_id}{suffix}"
    target = client_dir / safe_name
    shutil.copy2(source, target)
    file_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
    asset = UploadedAsset(
        asset_id=asset_id,
        file_name=source.name,
        file_type=file_type,
        role=role,
        url=_public_upload_url(client_id, safe_name),
        notes=notes,
    )
    _ASSETS[asset_id] = asset
    return asset


def _asset_from_existing_file(client_id: str, role: str, path: Path) -> UploadedAsset:
    asset_id = path.stem
    file_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    source_name = _source_name_from_manifest(client_id, path.name)
    notes = "Midia encontrada na biblioteca local do restaurante."
    if source_name:
        notes = f"{notes} Origem importada: {source_name}"
    asset = UploadedAsset(
        asset_id=asset_id,
        file_name=path.name,
        file_type=file_type,
        role=role,
        url=_public_upload_url(client_id, path.name),
        notes=notes,
    )
    _ASSETS[asset_id] = asset
    return asset


def _source_name_from_manifest(client_id: str, file_name: str) -> Optional[str]:
    safe_client_id = _safe_client_id(client_id)
    if safe_client_id not in _IMPORT_MANIFESTS:
        manifest_path = _UPLOAD_ROOT / safe_client_id / "_import_manifest.json"
        sources = {}
        if manifest_path.exists():
            try:
                raw_items = json.loads(manifest_path.read_text(encoding="utf-8"))
                sources = {
                    item.get("saved_as"): item.get("source_name")
                    for item in raw_items
                    if item.get("saved_as") and item.get("source_name")
                }
            except (OSError, json.JSONDecodeError):
                sources = {}
        _IMPORT_MANIFESTS[safe_client_id] = sources
    return _IMPORT_MANIFESTS[safe_client_id].get(file_name)


def _local_path_from_upload_url(url: str) -> Path:
    if not url.startswith("/uploads/"):
        raise HTTPException(status_code=400, detail="A imagem precisa estar na biblioteca local.")

    relative = url.replace("/uploads/", "", 1)
    path = _UPLOAD_ROOT / relative
    resolved_root = _UPLOAD_ROOT.resolve()
    resolved_path = path.resolve()
    if resolved_root not in resolved_path.parents and resolved_path != resolved_root:
        raise HTTPException(status_code=400, detail="Caminho de imagem invalido.")
    if not resolved_path.exists():
        raise HTTPException(status_code=404, detail="Imagem de origem nao encontrada.")
    return resolved_path


def _prepare_openai_image(source_path: Path, temp_dir: Path) -> Path:
    """Normalize camera files (including iPhone MPO/JPEG variants) before image editing."""
    try:
        from PIL import Image, ImageOps
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Dependencia Pillow nao instalada. Rode pip install -r backend/requirements.txt.",
        ) from exc

    try:
        with Image.open(source_path) as image:
            normalized = ImageOps.exif_transpose(image)
            if normalized.mode not in {"RGB", "RGBA"}:
                normalized = normalized.convert("RGB")
            elif normalized.mode == "RGBA":
                background = Image.new("RGB", normalized.size, (255, 255, 255))
                background.paste(normalized, mask=normalized.getchannel("A"))
                normalized = background

            max_side = 4096
            if max(normalized.size) > max_side:
                normalized.thumbnail((max_side, max_side))

            prepared_path = temp_dir / f"{source_path.stem}-openai-source.png"
            normalized.save(prepared_path, format="PNG", optimize=True)
            return prepared_path
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Nao consegui preparar a imagem de origem: {exc}") from exc


def _extract_drive_folder_id(value: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Informe o link ou ID da pasta do Google Drive.")

    patterns = (
        r"/folders/([a-zA-Z0-9_-]+)",
        r"[?&]id=([a-zA-Z0-9_-]+)",
        r"^([a-zA-Z0-9_-]{12,})$",
    )
    for pattern in patterns:
        match = re.search(pattern, cleaned)
        if match:
            return match.group(1)

    raise HTTPException(
        status_code=400,
        detail="Nao consegui identificar o ID da pasta. Use um link no formato https://drive.google.com/drive/folders/ID.",
    )


def _drive_service_account_email_from_env() -> Optional[str]:
    raw_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    if raw_json:
        try:
            return json.loads(raw_json).get("client_email")
        except json.JSONDecodeError:
            return None

    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if credentials_path and Path(credentials_path).exists():
        try:
            return json.loads(Path(credentials_path).read_text(encoding="utf-8")).get("client_email")
        except (OSError, json.JSONDecodeError):
            return None
    return None


def _drive_credentials_configured() -> bool:
    raw_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    return bool(raw_json or (credentials_path and Path(credentials_path).exists()))


def _build_drive_service():
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Dependencias do Google Drive nao instaladas. Rode pip install -r backend/requirements.txt.",
        ) from exc

    raw_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    try:
        if raw_json:
            credentials = service_account.Credentials.from_service_account_info(
                json.loads(raw_json),
                scopes=_DRIVE_SCOPES,
            )
        elif credentials_path:
            credentials = service_account.Credentials.from_service_account_file(
                credentials_path,
                scopes=_DRIVE_SCOPES,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Google Drive ainda nao esta conectado. Configure GOOGLE_APPLICATION_CREDENTIALS "
                    "ou GOOGLE_SERVICE_ACCOUNT_JSON e compartilhe a pasta do cliente com o e-mail da service account."
                ),
            )
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="GOOGLE_SERVICE_ACCOUNT_JSON esta invalido.") from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail="Arquivo GOOGLE_APPLICATION_CREDENTIALS nao encontrado.") from exc

    return build("drive", "v3", credentials=credentials, cache_discovery=False)


def _list_drive_media_catalog(service, folder_id: str, max_files: int, max_depth: int = 3) -> List[dict]:
    pending = [(folder_id, 0, [])]
    media_files = []
    visited = set()

    while pending and len(media_files) < max_files * 3:
        current_folder_id, depth, folder_path = pending.pop(0)
        if current_folder_id in visited:
            continue
        visited.add(current_folder_id)

        query = (
            f"'{current_folder_id}' in parents and trashed = false and "
            "(mimeType contains 'image/' or mimeType contains 'video/' or "
            "mimeType = 'application/vnd.google-apps.folder')"
        )
        page_token = None

        while True:
            response = (
                service.files()
                .list(
                    q=query,
                    fields=(
                        "nextPageToken, files("
                        "id, name, mimeType, size, modifiedTime, thumbnailLink, webViewLink"
                        ")"
                    ),
                    orderBy="modifiedTime desc",
                    pageSize=100,
                    pageToken=page_token,
                    includeItemsFromAllDrives=True,
                    supportsAllDrives=True,
                )
                .execute()
            )

            for item in response.get("files", []):
                mime_type = item.get("mimeType", "")
                if mime_type == "application/vnd.google-apps.folder" and depth < max_depth:
                    pending.append((item["id"], depth + 1, [*folder_path, item.get("name", "")]))
                elif mime_type.startswith(("image/", "video/")):
                    item["folderPath"] = folder_path
                    media_files.append(item)

            page_token = response.get("nextPageToken")
            if not page_token or len(media_files) >= max_files * 3:
                break

    media_files.sort(key=lambda item: item.get("name", "").lower())
    media_files.sort(key=lambda item: item.get("modifiedTime", ""), reverse=True)
    media_files.sort(key=lambda item: not item.get("mimeType", "").startswith("image/"))
    return media_files[:max_files]


def _list_drive_media_files(service, folder_id: str, max_files: int) -> List[dict]:
    return _list_drive_media_catalog(service, folder_id, max_files)


def _drive_catalog_item(file_meta: dict) -> DriveMediaItem:
    size = file_meta.get("size")
    return DriveMediaItem(
        drive_file_id=file_meta["id"],
        name=file_meta.get("name") or file_meta["id"],
        mime_type=file_meta.get("mimeType", "application/octet-stream"),
        size_bytes=int(size) if str(size or "").isdigit() else None,
        modified_time=file_meta.get("modifiedTime"),
        thumbnail_url=file_meta.get("thumbnailLink"),
        web_view_link=file_meta.get("webViewLink"),
        folder_path=file_meta.get("folderPath", []),
    )


def _download_drive_file(service, file_meta: dict, target_dir: Path) -> Path:
    try:
        from googleapiclient.http import MediaIoBaseDownload
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Dependencias do Google Drive nao instaladas. Rode pip install -r backend/requirements.txt.",
        ) from exc

    mime_type = file_meta.get("mimeType", "application/octet-stream")
    original_name = file_meta.get("name") or file_meta["id"]
    suffix = Path(original_name).suffix or mimetypes.guess_extension(mime_type) or ".bin"
    safe_name = re.sub(r"[^a-zA-Z0-9._-]+", "-", Path(original_name).stem).strip("-") or file_meta["id"]
    target = target_dir / f"{safe_name}{suffix}"

    request = service.files().get_media(fileId=file_meta["id"], supportsAllDrives=True)
    with target.open("wb") as output_file:
        downloader = MediaIoBaseDownload(output_file, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
    return target


def _import_drive_assets_api(req: DriveImportRequest, max_files: int) -> AssetUploadResponse:
    folder_id = _extract_drive_folder_id(req.folder_url)
    service = _build_drive_service()

    try:
        files = _list_drive_media_files(service, folder_id, max_files)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=400,
            detail=(
                "Nao consegui listar a pasta pela Google Drive API. Confirme que a pasta foi compartilhada "
                "com a service account da OTG e que o link/ID esta correto."
            ),
        ) from exc

    if not files:
        raise HTTPException(status_code=400, detail="Nao encontrei imagens ou videos nessa pasta do Drive.")

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        downloaded_paths = [_download_drive_file(service, item, temp_path) for item in files]
        items = [
            _register_local_asset(
                client_id=req.client_id,
                role="media",
                source=path,
                notes="Midia importada pela Google Drive API da pasta conectada do restaurante.",
            )
            for path in downloaded_paths
        ]
    return AssetUploadResponse(items=items)


def _drive_file_meta(service, file_id: str) -> dict:
    return (
        service.files()
        .get(
            fileId=file_id,
            fields="id, name, mimeType, size, modifiedTime, thumbnailLink, webViewLink",
            supportsAllDrives=True,
        )
        .execute()
    )


def _import_selected_drive_assets_api(req: DriveImportSelectedRequest) -> AssetUploadResponse:
    service = _build_drive_service()
    file_ids = list(dict.fromkeys(item.strip() for item in req.file_ids if item.strip()))[:40]
    if not file_ids:
        raise HTTPException(status_code=400, detail="Selecione pelo menos um arquivo do Drive para importar.")

    try:
        files = [_drive_file_meta(service, file_id) for file_id in file_ids]
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=400,
            detail="Nao consegui acessar um ou mais arquivos selecionados. Confirme permissao da service account.",
        ) from exc

    usable = [item for item in files if item.get("mimeType", "").startswith(("image/", "video/"))]
    if not usable:
        raise HTTPException(status_code=400, detail="Os arquivos selecionados nao sao imagens ou videos utilizaveis.")

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        downloaded_paths = [_download_drive_file(service, item, temp_path) for item in usable]
        items = [
            _register_local_asset(
                client_id=req.client_id,
                role="media",
                source=path,
                notes="Midia selecionada manualmente no catalogo do Google Drive.",
            )
            for path in downloaded_paths
        ]
    return AssetUploadResponse(items=items)


def _import_drive_assets_public(req: DriveImportRequest, max_files: int) -> AssetUploadResponse:
    with tempfile.TemporaryDirectory() as temp_dir:
        output_dir = f"{temp_dir}/"
        try:
            subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "gdown",
                    "--folder",
                    "--remaining-ok",
                    "--no-cookies",
                    "-O",
                    output_dir,
                    req.folder_url,
                ],
                check=True,
                capture_output=True,
                text=True,
                timeout=60,
            )
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(
                status_code=408,
                detail="O Google Drive demorou demais para responder. Para teste, use uma pasta publica com menos arquivos ou conecte a API oficial do Drive.",
            ) from exc
        except FileNotFoundError as exc:
            raise HTTPException(
                status_code=500,
                detail="Dependencia gdown nao encontrada. Rode pip install -r requirements.txt.",
            ) from exc
        except subprocess.CalledProcessError as exc:
            message = (exc.stderr or exc.stdout or "").strip()
            hint = (
                " Se a pasta for privada, configure a service account do Google Drive e compartilhe a pasta com ela."
                if not _drive_credentials_configured()
                else ""
            )
            raise HTTPException(
                status_code=400,
                detail=f"Nao consegui acessar a pasta do Drive. Confirme permissoes e link. Erro: {message}{hint}",
            ) from exc

        downloaded = [str(path) for path in Path(temp_dir).rglob("*") if path.is_file()]
        if not downloaded:
            raise HTTPException(
                status_code=400,
                detail="Nao encontrei arquivos para baixar nessa pasta do Drive.",
            )

        paths = [Path(item) for item in downloaded if Path(item).is_file()]
        usable = []
        for path in paths:
            file_type = mimetypes.guess_type(path.name)[0] or ""
            if file_type.startswith(("image/", "video/")):
                usable.append(path)

        if not usable:
            raise HTTPException(
                status_code=400,
                detail="A pasta foi acessada, mas nao encontrei imagens ou videos utilizaveis.",
            )

        usable.sort(key=lambda item: (not (mimetypes.guess_type(item.name)[0] or "").startswith("image/"), item.name))
        items = [
            _register_local_asset(
                client_id=req.client_id,
                role="media",
                source=path,
                notes="Midia importada automaticamente da pasta publica do Google Drive do restaurante.",
            )
            for path in usable[:max_files]
        ]
        return AssetUploadResponse(items=items)


def _build_ai_image_prompt(req: AiImageRequest) -> str:
    format_note = "vertical story 9:16" if req.output_format == "stories" else "vertical carousel cover 4:5"
    delivery_night = _has_delivery_night_context(req)
    if req.output_format == "stories":
        organic_action_rules = (
            "For Instagram Stories, valid organic actions are: reply by DM, emoji reaction, share/send in Direct, "
            "or continue watching the next story. Do not use save/salve/guardar, comments, feed saves, fake buttons, "
            "or link prompts unless a real native sticker will be added later outside the image."
        )
    else:
        organic_action_rules = (
            "For carousel/feed content, save/share/comment language can be used when it fits the concept, "
            "but do not draw fake app buttons or fake Instagram UI."
        )
    restaurant_name = _sanitize_ai_text(req.restaurant_name, delivery_night)
    colors = req.color_palette or ["#0B2A1E", "#4598B2", "#F0B05F"]
    color_note = ", ".join(colors[:5])
    operational_note = _build_operational_note(req, delivery_night)
    headline = _sanitize_ai_text(req.headline, delivery_night)
    body = _sanitize_ai_text(req.body, delivery_night)
    visual_direction = _sanitize_ai_text(req.visual_direction, delivery_night)
    cta = _sanitize_ai_cta(req.cta, req.output_format)
    return (
        f"Create a premium social media creative for {restaurant_name}, a restaurant brand served by OTG Midia. "
        f"Brand context for mood only: {restaurant_name}. Do not render the brand name as a logo or wordmark. "
        f"{operational_note} "
        "Use the provided image as the real product/order reference and preserve "
        "the dish/order accurately. Do not invent a different dish. Improve lighting, composition, background "
        "and editorial polish while keeping the food realistic and appetizing. "
        f"Format: {format_note}. Brand colors: {color_note}. "
        "Brand feeling: respect the restaurant's own brand manual, tone, cuisine, and positioning. "
        "The creative should feel appetizing, polished, local, and professionally art-directed. "
        "CRITICAL BRAND SAFETY RULE: never create, redraw, restyle, complete, enhance, sharpen, reconstruct, "
        "move, duplicate, or invent any logo, wordmark, crown, roof icon, flag icon, monogram, embroidered mark, "
        "packaging logo, glass logo, napkin logo, or any stylized text that looks like a brand mark. "
        "Do not place any logo at the top, bottom, corner, or center of the creative. "
        "If a logo or brand mark already exists inside the source photo, preserve it exactly as photographed: "
        "same blur, crop, angle, distortion, partial visibility, and imperfections. Do not fix it. "
        "If the logo would be unclear, leave it unclear or crop around it; never regenerate it. "
        "The official logo will be added later by the design system outside the AI generation. "
        f"{organic_action_rules} "
        f"Creative layout style: {req.layout_style}. Visual direction: {visual_direction}. "
        f"Main headline to include if legible: {headline}. "
        f"Support copy: {body}. Organic story interaction cue: {cta}. "
        "Use very little text on the image. Do not create polls, quizzes, question boxes, sliders, reaction bars, "
        "Instagram UI elements, fake buttons, or interactive stickers. Do not invent poll options, menu items, "
        "phone numbers, handles, prices, addresses, or extra claims. Treat the organic cue as a small editorial "
        "text badge only, never as an app component. "
        "Double-check Portuguese spelling and accents. If text clarity is uncertain, keep only the headline "
        "and the organic cue. "
        "This is organic Instagram Stories content, not a paid Meta ad. Do not add WhatsApp buttons, "
        "fake app buttons, click-to-WhatsApp CTAs, prices, hard-sell language, or ad-style conversion buttons. "
        "Prefer quiet organic behaviors that are native to the selected format. "
        "Use clean Portuguese typography, strong hierarchy, enough safe margins for Instagram UI, "
        "and avoid clutter. The final image should feel like a polished restaurant story designed by a senior art director."
    )


def _build_operational_note(req: AiImageRequest, delivery_night: bool) -> str:
    notes = ". ".join(note.strip() for note in req.operational_notes if note.strip())
    if delivery_night:
        return (
            "Operational context: this client is delivery-only and works at night. The creative must suggest dinner, "
            "night cravings, comfort at home, delivery, and ordering for the evening. Never mention lunch, dining room, "
            "restaurant visit, reservations, tables, or eating at the venue."
        )
    if notes:
        return f"Client operational notes: {notes}. Follow these notes strictly."
    return "No special operational restrictions were provided."


def _has_delivery_night_context(req: AiImageRequest) -> bool:
    text = " ".join([req.client_id, req.restaurant_name, *req.operational_notes]).lower()
    return "heim" in text or ("delivery" in text and ("noite" in text or "noturno" in text or "night" in text))


def _sanitize_ai_text(value: str, delivery_night: bool = False) -> str:
    replacements = {
        "Vender com a assinatura da Heim": "Seu momento com sabor caseiro",
        "vender com a assinatura da Heim": "Seu momento com sabor caseiro",
        "vender com a assinatura da heim": "Seu momento com sabor caseiro",
        "assinatura da Heim": "jeito de casa",
        "assinatura da heim": "jeito de casa",
        "Vender": "Seu momento",
        "vender": "seu momento",
        "Salve este story para lembrar depois": "Mande para quem combina",
        "salve este story para lembrar depois": "Mande para quem combina",
        "salve este story": "Mande para quem combina",
        "Salve este story": "Mande para quem combina",
        "salvar": "responder",
        "Salvar": "Responder",
        "guarde": "lembre",
        "Guarde": "Lembre",
        "guardar": "lembrar",
        "Guardar": "Lembrar",
        "marca visual discreta": "assinatura visual sem logo",
        "Marca visual discreta": "Assinatura visual sem logo",
        "logo": "assinatura editorial sem marca",
        "Logo": "Assinatura editorial sem marca",
        "wordmark": "texto editorial",
        "Wordmark": "Texto editorial",
        "enquete": "conversa",
        "Enquete": "Conversa",
        "quiz": "conteudo",
        "Quiz": "Conteudo",
        "sticker de resposta": "chamada editorial curta",
        "sticker": "selo editorial",
        "Sticker": "Selo editorial",
        "botao": "selo",
        "botão": "selo",
        "WhatsApp": "story",
        "whatsapp": "story",
    }
    if delivery_night:
        replacements.update(
            {
                "almoço": "jantar",
                "Almoço": "Jantar",
                "almoco": "jantar",
                "Almoco": "Jantar",
                "salao": "delivery",
                "salão": "delivery",
                "Salao": "Delivery",
                "Salão": "Delivery",
                "visita": "pedido",
                "Visita": "Pedido",
                "reserva": "pedido",
                "Reserva": "Pedido",
                "mesa esperando": "pedido chegando",
                "Mesa esperando": "Pedido chegando",
                "mesa posta": "noite em casa",
                "Mesa posta": "Noite em casa",
                "roteiro": "noite",
                "Roteiro": "Noite",
            }
        )
    sanitized = value
    for old, new in replacements.items():
        sanitized = sanitized.replace(old, new)
    return sanitized


def _sanitize_ai_cta(value: str, output_format: str = "stories") -> str:
    blocked = ("enquete", "quiz", "vote", "arraste", "reaja", "sticker", "whatsapp", "botao", "botão")
    story_blocked = ("salve", "salvar", "save", "guarde", "guardar", "comente", "clique")
    lowered = value.lower()
    if any(term in lowered for term in blocked):
        return "Responda no direct" if output_format == "stories" else "Compartilhe com alguem"
    if output_format == "stories" and any(term in lowered for term in story_blocked):
        return "Mande para quem combina"
    return _sanitize_ai_text(value)


def _extract_pdf_text(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""

    try:
        reader = PdfReader(str(path))
        page_text = []
        for page in reader.pages[:20]:
            page_text.append(page.extract_text() or "")
        return "\n".join(page_text).strip()
    except Exception:
        return ""


def _analyze_manual(path: Path, file_type: str) -> dict:
    text = ""
    if file_type == "application/pdf" or path.suffix.lower() == ".pdf":
        text = _extract_pdf_text(path)
    elif path.suffix.lower() in {".txt", ".md"}:
        text = path.read_text(encoding="utf-8", errors="ignore")

    colors = sorted(set(re.findall(r"#[0-9A-Fa-f]{6}", text)))
    lower_text = text.lower()
    normalized_text = re.sub(r"\s+", " ", lower_text)
    fonts = [font for font in _KNOWN_FONT_HINTS if font.lower() in normalized_text]
    tone = None
    if any(word in lower_text for word in ("sofistic", "elegante", "premium")):
        tone = "sofisticado e acolhedor"
    elif any(word in lower_text for word in ("divertid", "descontra", "jovem")):
        tone = "leve e descontraido"
    elif any(word in lower_text for word in ("tradicional", "tradicion", "famil", "caseir")):
        tone = "tradicional e acolhedor"

    preview = " ".join(text.split())[:900]
    notes = "Manual recebido."
    if preview:
        notes = "Manual lido automaticamente para extrair pistas de identidade."
    elif path.suffix.lower() == ".pdf":
        notes = "Manual recebido, mas o PDF parece visual ou com texto pouco extraivel."

    return {
        "notes": notes,
        "extracted_text_preview": preview or None,
        "detected_colors": colors[:8],
        "detected_typography": fonts[:6],
        "detected_tone": tone,
    }


def _save_upload(client_id: str, role: str, upload: UploadFile) -> UploadedAsset:
    asset_id = str(uuid4())
    client_dir = _UPLOAD_ROOT / _safe_client_id(client_id)
    client_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(upload.filename or "arquivo").suffix
    safe_name = f"{asset_id}{suffix}"
    target = client_dir / safe_name

    with target.open("wb") as out_file:
        shutil.copyfileobj(upload.file, out_file)

    analysis = _analyze_manual(target, upload.content_type or "") if role == "manual" else {}
    asset = UploadedAsset(
        asset_id=asset_id,
        file_name=upload.filename or safe_name,
        file_type=upload.content_type or "application/octet-stream",
        role=role,
        url=_public_upload_url(client_id, safe_name),
        notes=analysis.get("notes", "Arquivo recebido pelo MVP."),
        extracted_text_preview=analysis.get("extracted_text_preview"),
        detected_colors=analysis.get("detected_colors", []),
        detected_typography=analysis.get("detected_typography", []),
        detected_tone=analysis.get("detected_tone"),
    )
    _ASSETS[asset_id] = asset
    return asset


@router.post("/assets/upload", response_model=AssetUploadResponse)
def upload_assets(
    client_id: str = Form(...),
    role: str = Form(...),
    files: List[UploadFile] = File(...),
) -> AssetUploadResponse:
    if role not in {"manual", "media"}:
        raise HTTPException(status_code=400, detail="Role deve ser manual ou media")

    items = [_save_upload(client_id=client_id, role=role, upload=file) for file in files]
    return AssetUploadResponse(items=items)


@router.get("/drive/status", response_model=DriveStatusResponse)
def drive_status() -> DriveStatusResponse:
    configured = _drive_credentials_configured()
    email = _drive_service_account_email_from_env()
    return DriveStatusResponse(
        configured=configured,
        mode="google_drive_api" if configured else "public_folder_fallback",
        service_account_email=email,
        setup_hint=(
            "Drive API conectada. Compartilhe as pastas dos clientes com a service account."
            if configured
            else "Modo publico/manual ativo. Isso e esperado enquanto a conexao privada do Google Drive nao for configurada; por enquanto use pastas publicas ou upload manual."
        ),
    )


@router.post("/assets/import-drive", response_model=AssetUploadResponse)
def import_drive_assets(req: DriveImportRequest) -> AssetUploadResponse:
    max_files = max(1, min(req.max_files, 40))
    if _drive_credentials_configured():
        return _import_drive_assets_api(req, max_files)
    return _import_drive_assets_public(req, max_files)


@router.post("/drive/catalog", response_model=DriveCatalogResponse)
def drive_catalog(req: DriveCatalogRequest) -> DriveCatalogResponse:
    if not _drive_credentials_configured():
        raise HTTPException(
            status_code=400,
            detail=(
                "Catalogo sem download exige Google Drive API privada. Configure a service account; "
                "o fallback publico so consegue importar, nao navegar com seguranca."
            ),
        )

    folder_id = _extract_drive_folder_id(req.folder_url)
    max_files = max(1, min(req.max_files, 200))
    service = _build_drive_service()

    try:
        files = _list_drive_media_catalog(service, folder_id, max_files)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=400,
            detail=(
                "Nao consegui listar o catalogo do Drive. Confirme que a pasta foi compartilhada "
                "com a service account e que o link/ID esta correto."
            ),
        ) from exc

    return DriveCatalogResponse(
        configured=True,
        mode="google_drive_api",
        items=[_drive_catalog_item(item) for item in files],
    )


@router.post("/assets/import-drive-selected", response_model=AssetUploadResponse)
def import_selected_drive_assets(req: DriveImportSelectedRequest) -> AssetUploadResponse:
    if not _drive_credentials_configured():
        raise HTTPException(
            status_code=400,
            detail="Importacao seletiva exige Google Drive API privada configurada.",
        )
    return _import_selected_drive_assets_api(req)


@router.get("/clients/{client_id}/assets", response_model=AssetUploadResponse)
def list_client_assets(client_id: str, role: str = "media") -> AssetUploadResponse:
    client_dir = _UPLOAD_ROOT / _safe_client_id(client_id)
    if not client_dir.exists():
        return AssetUploadResponse(items=[])

    allowed_prefixes = ("image/", "video/") if role == "media" else ("application/pdf", "image/")
    items = []
    for path in sorted(client_dir.iterdir()):
        if not path.is_file():
            continue
        if path.stat().st_size < 10_000:
            continue
        file_type = mimetypes.guess_type(path.name)[0] or ""
        if any(file_type.startswith(prefix) for prefix in allowed_prefixes):
            items.append(_asset_from_existing_file(client_id, role, path))
    return AssetUploadResponse(items=items)


@router.get("/assets/download")
def download_asset(url: str) -> FileResponse:
    path = _local_path_from_upload_url(url)
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FileResponse(
        path,
        media_type=media_type,
        filename=path.name,
        headers={"Cache-Control": "no-store"},
    )


@router.post("/assets/download-zip")
def download_assets_zip(req: AssetZipRequest) -> StreamingResponse:
    if not req.urls:
        raise HTTPException(status_code=400, detail="Nenhuma imagem foi enviada para baixar.")

    safe_client_id = _safe_client_id(req.client_id)
    allowed_prefix = f"/uploads/{safe_client_id}/"
    buffer = BytesIO()

    with ZipFile(buffer, "w", ZIP_DEFLATED) as zip_file:
        for index, url in enumerate(req.urls, start=1):
            if not url.startswith(allowed_prefix):
                raise HTTPException(status_code=400, detail="Imagem fora da pasta deste cliente.")

            path = _local_path_from_upload_url(url)
            suffix = path.suffix or ".png"
            zip_file.write(path, arcname=f"{safe_client_id}-story-{index:02d}-ia{suffix}")

    buffer.seek(0)
    filename = req.file_name if req.file_name.endswith(".zip") else f"{req.file_name}.zip"
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.post("/ai-images/generate", response_model=AiImageResponse)
def generate_ai_image(req: AiImageRequest) -> AiImageResponse:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="OPENAI_API_KEY nao configurada. Adicione a chave da OpenAI para gerar imagens com IA.",
        )

    source_path = _local_path_from_upload_url(req.source_image_url)
    output_dir = _UPLOAD_ROOT / _safe_client_id(req.client_id) / "ai"
    output_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"ai-{uuid4()}.png"
    output_path = output_dir / file_name

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        with tempfile.TemporaryDirectory() as temp_dir:
            prepared_source_path = _prepare_openai_image(source_path, Path(temp_dir))
            with prepared_source_path.open("rb") as image_file:
                result = client.images.edit(
                    model=_OPENAI_IMAGE_MODEL,
                    image=image_file,
                    prompt=_build_ai_image_prompt(req),
                    size="1024x1536",
                    quality=req.quality,
                )

        b64_image = result.data[0].b64_json
        output_path.write_bytes(base64.b64decode(b64_image))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha ao gerar imagem com IA: {exc}") from exc

    return AiImageResponse(
        image_url=_public_upload_url(req.client_id, f"ai/{file_name}"),
        file_name=file_name,
    )


@router.post("/generations", response_model=GenerationJob)
def create_generation_job(req: CreateGenerationRequest) -> GenerationJob:
    job_id = str(uuid4())
    now = _now()
    job = GenerationJob(
        job_id=job_id,
        client_id=req.client_id,
        status=JobStatus.queued,
        created_at=now,
        updated_at=now,
        estimated_cost_brl=_estimate_cost_brl(req.campaign),
    )

    with _LOCK:
        _JOBS[job_id] = job

    try:
        job.status = JobStatus.processing
        job.updated_at = _now()
        result = run_pipeline(req.campaign)
        job.result = result
        job.status = JobStatus.completed
        job.updated_at = _now()
    except Exception as exc:  # noqa: BLE001
        job.status = JobStatus.failed
        job.error_message = str(exc)
        job.updated_at = _now()

    with _LOCK:
        _JOBS[job_id] = job

    return job


@router.get("/generations/{job_id}", response_model=GenerationJob)
def get_generation_job(job_id: str) -> GenerationJob:
    job = _JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job nao encontrado")
    return job


@router.get("/clients/{client_id}/generations", response_model=GenerationJobList)
def list_client_jobs(client_id: str) -> GenerationJobList:
    items = [j for j in _JOBS.values() if j.client_id == client_id]
    items.sort(key=lambda x: x.created_at, reverse=True)
    return GenerationJobList(items=items)


@router.get("/clients/{client_id}/usage", response_model=UsageSummary)
def usage_summary(client_id: str) -> UsageSummary:
    jobs = [j for j in _JOBS.values() if j.client_id == client_id]
    completed = [j for j in jobs if j.status == JobStatus.completed]
    total_cost = round(sum(j.estimated_cost_brl for j in completed), 2)
    return UsageSummary(
        client_id=client_id,
        total_jobs=len(jobs),
        completed_jobs=len(completed),
        estimated_total_cost_brl=total_cost,
    )
