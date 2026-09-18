import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from httpx import HTTPStatusError

from apps.api.core.config import settings
from apps.api.routers import auth, chat, contact, diagnoses, farms, notifications, outbreaks, recommendations, reviews, weather

logger = logging.getLogger("agrisense.api")

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="AgriSense AI — AI-Powered Agricultural Decision Support Platform API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPStatusError)
async def inference_error_handler(request: Request, exc: HTTPStatusError):
    # The inference service (or any downstream HTTP call) returned an error.
    # Log the real cause server-side, but give the frontend a clean, stable
    # response instead of letting the raw exception crash past the CORS
    # middleware (which is what makes the browser report a false "CORS
    # blocked" error instead of the real problem).
    logger.error("Downstream service error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=502,
        content={"detail": "The diagnosis service is temporarily unavailable. Please try again in a moment."},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on our end. Please try again."},
    )


# Serve locally-stored diagnosis images at /uploads/<user_id>/<filename>
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(farms.router)
app.include_router(diagnoses.router)
app.include_router(chat.router)
app.include_router(weather.router)
app.include_router(recommendations.router)
app.include_router(notifications.router)
app.include_router(outbreaks.router)
app.include_router(reviews.router)
app.include_router(contact.router)


@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok", "service": settings.APP_NAME, "env": settings.ENV}