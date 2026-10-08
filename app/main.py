import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
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
