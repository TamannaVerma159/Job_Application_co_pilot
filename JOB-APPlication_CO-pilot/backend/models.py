# models.py now define all table

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    DateTime
)

from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from database import Base

# Users Table
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(100), nullable=False)

    email = Column(String(255), unique=True, nullable=False)

    password = Column(String(255), nullable=False)


    applications = relationship(
        "Application",
        back_populates="user",
        cascade="all, delete"
    )
    resumes = relationship("Resume", back_populates="user")
    drafts  = relationship("Draft",  back_populates="user")
    generated_resumes = relationship("GeneratedResume", back_populates="user")

# Application Table
class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id")
    )

    resume_id = Column(Integer, ForeignKey("resumes.id"))

    job_title = Column(String(255))

    company = Column(String(255))

    jd_text = Column(Text)

    status = Column(
        String,
        default="not_applied"
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    tailored_resume = Column(Text)
    cover_letter = Column(Text)
    interview_questions = Column(Text)

    location = Column(String, nullable=True)
    job_url  = Column(String, nullable=True)
    notes    = Column(Text,   nullable=True)

    resume_docx_path = Column(String, nullable=True)
    resume_pdf_path = Column(String, nullable=True)

    cover_docx_path = Column(String, nullable=True)
    cover_pdf_path = Column(String, nullable=True)

   
    user = relationship(
        "User",
        back_populates="applications"
    )

    draft = relationship(
        "Draft",
        back_populates="application",
        uselist=False
    )

    revisions = relationship(
        "Revision",
        back_populates="application"
    )

    resume = relationship(
        "Resume",
        back_populates="applications"
    )
    generated_resume = relationship(
        "GeneratedResume",
        back_populates="application",
        uselist=False
    )

# Draft Table
class Draft(Base):
    __tablename__ = "drafts"

    id = Column(Integer, primary_key=True)

    application_id = Column(
        Integer,
        ForeignKey("applications.id")
    )

    resume_id = Column(Integer, ForeignKey("resumes.id"))

    job_title = Column(String)
    company_name = Column(String)

    fit_analysis = Column(Text)

    resume_rewrite = Column(Text)

    cover_letter = Column(Text)

    interview_questions = Column(Text)

    application = relationship(
        "Application",
        back_populates="draft"
    )

    resume = relationship("Resume", back_populates="drafts")

    created_at = Column(DateTime, default=datetime.utcnow)

    user_id = Column(Integer, ForeignKey("users.id"))

    original_resume = Column(Text)
    optimized_resume = Column(Text)

    user = relationship("User", back_populates="drafts")
# Revisions Table
class Revision(Base):
    __tablename__ = "revisions"

    id = Column(Integer, primary_key=True)

    application_id = Column(
        Integer,
        ForeignKey("applications.id")
    )

    old_resume = Column(Text)

    new_resume = Column(Text)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    application = relationship(
        "Application",
        back_populates="revisions"
    )

# separate table for resume
class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String)
    file_path = Column(String)
    resume_text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship(
        "User", back_populates="resumes"
        )
    applications = relationship(
        "Application",
        back_populates="resume"
    )
    drafts = relationship(
        "Draft",
        back_populates="resume"
    )
    generated_resumes = relationship(
        "GeneratedResume",
        back_populates="source_resume"
    )


# Generated Resumes — one row per application, versioned on each regeneration
class GeneratedResume(Base):
    __tablename__ = "generated_resumes"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"),        nullable=False)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False, unique=True)
    resume_id      = Column(Integer, ForeignKey("resumes.id"),      nullable=True)

    content    = Column(Text,    nullable=False)
    version    = Column(Integer, default=1, nullable=False)
    docx_path  = Column(String,  nullable=True)
    pdf_path   = Column(String,  nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    application   = relationship("Application",  back_populates="generated_resume")
    source_resume = relationship("Resume",        back_populates="generated_resumes")
    user          = relationship("User",          back_populates="generated_resumes")

