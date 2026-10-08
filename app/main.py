import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.db.session import engine
from app.routers.auth import router as auth_router
from app.routers.scans import patients_router, router as scans_router
from app.routers.doctor_reviews import doctor_router, patient_router as review_request_router
from app.routers.notifications import router as notifications_router
from app.routers.admin_monitoring import router as admin_monitoring_router
from app.routers.admin_audit import router as admin_audit_router
from app.routers.doctors import router as doctors_router

logger = logging.getLogger(__name__)
app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    # Pydantic input/context may echo submitted passwords; omit both from responses.
    errors = [
        {key: value for key, value in error.items() if key not in {"input", "ctx"}}
        for error in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    logger.error("Unhandled request error", exc_info=(type(exc), exc, exc.__traceback__))
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(auth_router)
app.include_router(scans_router)
app.include_router(patients_router)
app.include_router(review_request_router)
app.include_router(doctor_router)
app.include_router(notifications_router)
app.include_router(admin_monitoring_router)
app.include_router(admin_audit_router)
app.include_router(doctors_router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
def readiness():
    database_ready = True
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        database_ready = False

    model_ready = Path(settings.model_path).expanduser().is_file()
    if not database_ready or not model_ready:
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "database": database_ready,
                "model": model_ready,
            },
        )
    return {"status": "ready", "database": True, "model": True}
