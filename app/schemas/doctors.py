from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DoctorProfileUpdate(BaseModel):
    specialization: str | None = Field(default=None, max_length=255)
    years_experience: int | None = Field(default=None, ge=0, le=100)
    bio: str | None = Field(default=None, max_length=300)

    @field_validator("specialization")
    @classmethod
    def normalize_specialization(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Specialization cannot be blank")
        return value

    @field_validator("bio")
    @classmethod
    def normalize_bio(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class DoctorProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    specialization: str | None
    years_experience: int | None
    bio: str | None
    profile_photo_url: str | None
