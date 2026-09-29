from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password_and_update
from app.core.rate_limit import rate_limit
from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserCreate, UserRead, UserRole
from app.services.audit import add_audit_log

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit())])
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if payload.role == UserRole.admin:
        raise HTTPException(status_code=400, detail="Admin accounts cannot be self-registered")
    normalized_email = str(payload.email).strip().lower()
    existing = db.scalar(select(User).where(func.lower(User.email) == normalized_email))
    if existing:
        raise HTTPException(status_code=409, detail="Email is already registered")
    user = User(email=normalized_email, full_name=payload.full_name, hashed_password=hash_password(payload.password), role=payload.role.value)
    db.add(user)
    try:
        db.flush()
        add_audit_log(db, user.id, "registration", f"users/{user.id}")
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        original = exc.orig
        sqlstate = getattr(original, "sqlstate", None) or getattr(original, "pgcode", None)
        diagnostic = getattr(original, "diag", None)
        constraint = getattr(diagnostic, "constraint_name", None)
        if sqlstate == "23505" and constraint in {"ix_users_email", "users_email_key", "uq_users_email"}:
            raise HTTPException(status_code=409, detail="Email is already registered") from exc
        raise
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit())])
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))
    if user is None:
        add_audit_log(db, None, "login_failure", "auth/login")
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    password_valid, replacement_hash = verify_password_and_update(payload.password, user.hashed_password)
    if not password_valid:
        add_audit_log(db, user.id, "login_failure", "auth/login")
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if replacement_hash is not None:
        user.hashed_password = replacement_hash
    add_audit_log(db, user.id, "login_success", "auth/login")
    db.commit()
    token = create_access_token(subject=str(user.id), role=user.role)
    return TokenResponse(access_token=token, user=user)


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return user
