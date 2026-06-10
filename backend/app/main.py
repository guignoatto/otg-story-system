from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api_v1 import router as v1_router
from .models import GenerationResponse, StoryCampaignInput
from .orchestrator import run_pipeline

app = FastAPI(title="OTG Story System", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)
app.mount("/uploads", StaticFiles(directory="../uploads"), name="uploads")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/generate", response_model=GenerationResponse)
def generate_story_pack(payload: StoryCampaignInput) -> GenerationResponse:
    # Endpoint legado do MVP para testes rapidos.
    return run_pipeline(payload)
