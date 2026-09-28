from fastapi import FastAPI

from app.core.config import settings
from app.routers.auth import router as auth_router
from app.routers.scans import patients_router, router as scans_router
from app.routers.doctor_reviews import doctor_router, patient_router as review_request_router
from app.routers.notifications import router as notifications_router
from app.routers.admin_monitoring import router as admin_monitoring_router

app = FastAPI(title=settings.app_name)
app.include_router(auth_router)
app.include_router(scans_router)
app.include_router(patients_router)
app.include_router(review_request_router)
app.include_router(doctor_router)
app.include_router(notifications_router)
app.include_router(admin_monitoring_router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
