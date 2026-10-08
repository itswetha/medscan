from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class ReviewDecision(str, Enum):
    agree = "agree"
    disagree = "disagree"
    needs_further_evaluation = "needs_further_evaluation"


class ReviewSubmission(BaseModel):
    decision: ReviewDecision
    notes: str | None = Field(default=None, max_length=5000)


class ReviewRequest(BaseModel):
    doctor_id: UUID
