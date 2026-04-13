from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import get_settings
from routers import message, vocab, review, conversation, progress, cron, gamification
from services.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    settings = get_settings()
    if settings.enable_internal_scheduler:
        start_scheduler()
    yield
    # Shutdown
    if settings.enable_internal_scheduler:
        stop_scheduler()


app = FastAPI(
    title="明老師 — Mandarin AI Learning System",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(message.router, prefix="/api", tags=["message"])
app.include_router(vocab.router, prefix="/api/vocab", tags=["vocabulary"])
app.include_router(review.router, prefix="/api/review", tags=["review"])
app.include_router(conversation.router, prefix="/api/conversation", tags=["conversation"])
app.include_router(progress.router, prefix="/api/stats", tags=["progress"])
app.include_router(gamification.router, prefix="/api/gamification", tags=["gamification"])
app.include_router(cron.router, prefix="/cron", tags=["cron"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ming-laoshi"}
