"""
AIVENTRA — AI-Powered Forensic Triage & Postmortem Intelligence System
FastAPI application entry point.
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.logging import logger
from app.services.rag.vector_store import vector_store
from app.utils.file_utils import ensure_dir

# Import all routers
from app.api.routes.health import router as health_router
from app.api.routes.upload import router as upload_router
from app.api.routes.autopsy import router as autopsy_router
from app.api.routes.correlation import router as correlation_router
from app.api.routes.timeline import router as timeline_router
from app.api.routes.anomaly import router as anomaly_router
from app.api.routes.rag import router as rag_router
from app.api.routes.reports import router as reports_router, report_router
from app.api.routes.gps import router as gps_router
from app.api.routes.ws import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle — runs once before serving requests."""
    logger.info("=" * 60)
    logger.info("  AIVENTRA Forensic Intelligence System v2.0 — STARTING")
    logger.info("=" * 60)

    # Ensure all data directories exist
    for d in [
        settings.UPLOADS_DIR, settings.EXTRACTED_DIR, settings.FINDINGS_DIR,
        settings.TIMELINES_DIR, settings.REPORTS_DIR, settings.CORRELATIONS_DIR,
        settings.SYNTHETIC_DIR, os.path.dirname(settings.FAISS_INDEX_PATH),
    ]:
        ensure_dir(d)

    # Load existing FAISS index if available
    loaded = vector_store.load()
    if loaded:
        logger.info(f"FAISS index loaded: {vector_store.total_vectors} vectors")
    else:
        logger.info("FAISS index empty — call POST /api/rag/index-synthetic to prime RAG")

    logger.info("Backend ready — serving on http://localhost:8000")
    logger.info("Docs available at http://localhost:8000/docs")
    yield

    logger.info("AIVENTRA shutting down...")
    vector_store.save()


app = FastAPI(
    title="AIVENTRA Forensic Intelligence System",
    description="AI-Powered Forensic Triage & Postmortem Intelligence Platform",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Middleware ─────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── Routers ────────────────────────────────────────────────────────────────────
API_PREFIX = "/api"
app.include_router(health_router, prefix=API_PREFIX)
app.include_router(upload_router, prefix=API_PREFIX)
app.include_router(autopsy_router, prefix=API_PREFIX)
app.include_router(correlation_router, prefix=API_PREFIX)
app.include_router(timeline_router, prefix=API_PREFIX)
app.include_router(anomaly_router, prefix=API_PREFIX)
app.include_router(rag_router, prefix=API_PREFIX)
app.include_router(reports_router, prefix=API_PREFIX)
app.include_router(report_router, prefix=API_PREFIX)
app.include_router(gps_router, prefix=API_PREFIX)

# Bare routes are also exposed for hackathon frontends that call the contract
# exactly as written: /upload, /autopsy/analyze, /rag/query, etc.
app.include_router(health_router)
app.include_router(upload_router)
app.include_router(autopsy_router)
app.include_router(correlation_router)
app.include_router(timeline_router)
app.include_router(anomaly_router)
app.include_router(rag_router)
app.include_router(reports_router)
app.include_router(report_router)
app.include_router(gps_router)
app.include_router(ws_router)  # WebSocket routes have no /api prefix


@app.get("/")
async def root():
    return {
        "system": "AIVENTRA Forensic Intelligence System",
        "version": "2.0.0",
        "status": "operational",
        "docs": "/docs",
        "health": "/api/health",
        "endpoints": {
            "upload": "/api/upload",
            "autopsy": "/api/autopsy",
            "correlation": "/api/correlation",
            "timeline": "/api/timeline",
            "anomaly": "/api/anomaly",
            "rag": "/api/rag",
            "reports": "/api/reports",
        },
    }
