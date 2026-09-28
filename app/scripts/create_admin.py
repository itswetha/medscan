"""Create an admin account directly in the configured database.

Run from the project root with:
    python -m app.scripts.create_admin EMAIL PASSWORD [--full-name NAME]
"""
import argparse
import sys

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User
from app.schemas.user import UserCreate, UserRole


def create_admin(db: Session, payload: UserCreate) -> User:
    email = str(payload.email).strip().lower()
    existing = db.scalar(select(User.id).where(func.lower(User.email) == email))
    if existing is not None:
        raise ValueError("A user with that email address already exists.")

    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=UserRole.admin.value,
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        original = exc.orig
        sqlstate = getattr(original, "sqlstate", None) or getattr(original, "pgcode", None)
        diagnostic = getattr(original, "diag", None)
        constraint = getattr(diagnostic, "constraint_name", None)
        if sqlstate == "23505" and constraint in {"ix_users_email", "users_email_key", "uq_users_email"}:
            raise ValueError("A user with that email address already exists.") from exc
        raise
    db.refresh(user)
    return user


def main() -> int:
    parser = argparse.ArgumentParser(description="Create an admin user in the configured MedScan database.")
    parser.add_argument("email", help="Admin email address")
    parser.add_argument("password", help="Admin password (minimum 8 characters)")
    parser.add_argument("--full-name", default="Platform Administrator", help="Display name (default: %(default)s)")
    args = parser.parse_args()

    try:
        payload = UserCreate(
            email=args.email,
            password=args.password,
            full_name=args.full_name,
            role=UserRole.admin,
        )
    except ValidationError as exc:
        messages = "; ".join(error["msg"] for error in exc.errors(include_input=False))
        parser.error(messages)

    db = SessionLocal()
    try:
        user = create_admin(db, payload)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    finally:
        db.close()

    print(f"Created admin user {user.email} (id: {user.id}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
