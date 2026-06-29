from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    name: str
    email: str
    password: str


class ApplicationCreate(BaseModel):
    user_id: int
    resume_id: Optional[int] = None
    job_title: str
    company: str
    jd_text: str
    location: Optional[str] = None
    job_url: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "not_applied"


class ApplicationUpdate(BaseModel):
    job_title: Optional[str] = None
    company: Optional[str] = None
    jd_text: Optional[str] = None
    location: Optional[str] = None
    job_url: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    cover_letter: Optional[str] = None
    interview_questions: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str


class OptimizeResumeResponse(BaseModel):
    draft_id: int
    original_resume: str
    optimized_resume: str


class LoginRequest(BaseModel):
    email: str
    password: str