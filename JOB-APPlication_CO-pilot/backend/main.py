from fastapi import (
    FastAPI,
    Depends,
    UploadFile,
    File,
    HTTPException
)
from sqlalchemy.exc import IntegrityError
from typing import Optional
from fastapi import Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from database import SessionLocal
from sqlalchemy.orm import Session
from schemas import UserCreate, ApplicationCreate, ApplicationUpdate, StatusUpdate, LoginRequest
from crud import create_user, create_application,get_applications, get_application,update_status,save_resume, save_optimized_resume,get_draft
from models import User, Application, Draft, Resume, GeneratedResume
from datetime import datetime, timedelta
from jose import jwt

from agents.fit_analyzer import analyze_fit
from agents.cover_letter_writer import generate_cover_letter
from agents.resume_rewriter import rewrite_resume
from agents.interview_generator import generate_questions


from utils.docx_generator import create_docx

from fastapi.responses import FileResponse
from utils.pdf_generator import create_pdf

from laggraph_App import graph
import shutil
import os
from dotenv import load_dotenv

load_dotenv()

# ── JWT config ──────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-to-a-long-random-secret-in-production")
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

def create_access_token(user_id: int, email: str) -> str:
    expire  = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

from database import engine, Base
import models  # ensure all models are registered before create_all
Base.metadata.create_all(bind=engine)

from pydantic import BaseModel as PydanticBase

class DraftResumeUpdate(PydanticBase):
    resume_rewrite: str

app = FastAPI()


origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "https://job-application-co-pilot-frontend.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


os.makedirs(
    "generated_files",
    exist_ok=True
)

@app.get("/")
def home():
    return {
        "message": "Job Application Copilot"
    }

# Connect Database to FastAPI

def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()

# create user Endpoint
@app.post("/users")
def add_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    try:
        return create_user(db, user.name, user.email, user.password)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

# Register endpoint (alias for /users)
@app.post("/register")
def register(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    try:
        return create_user(db, user.name, user.email, user.password)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

@app.post("/login")
def login(
    user: LoginRequest,
    db: Session = Depends(get_db)
):

    existing_user = (
        db.query(User)
        .filter(User.email == user.email)
        .first()
    )

    if not existing_user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email"
        )

    if existing_user.password != user.password:
        raise HTTPException(
            status_code=401,
            detail="Invalid password"
        )

    token = create_access_token(existing_user.id, existing_user.email)
    return {
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": existing_user.id,
            "name": existing_user.name,
            "email": existing_user.email
        }
    }

@app.post("/applications")
def add_application(
    application: ApplicationCreate,
    db: Session = Depends(get_db)
):
    app_obj = Application(
        user_id=application.user_id,
        resume_id=application.resume_id,
        job_title=application.job_title,
        company=application.company,
        jd_text=application.jd_text,
        location=application.location,
        job_url=application.job_url,
        notes=application.notes,
        status=application.status or "not_applied",
    )
    db.add(app_obj)
    db.commit()
    db.refresh(app_obj)
    return app_obj


@app.get("/applications")
def all_applications(user_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    if user_id:
        return db.query(Application).filter(Application.user_id == user_id).all()
    return db.query(Application).all()


@app.get("/applications/{application_id}")
def get_application_by_id(
    application_id: int,
    db: Session = Depends(get_db)
):
    app_obj = db.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")
    return {
        "id": app_obj.id,
        "user_id": app_obj.user_id,
        "resume_id": app_obj.resume_id,
        "job_title": app_obj.job_title,
        "company": app_obj.company,
        "jd_text": app_obj.jd_text,
        "location": app_obj.location,
        "job_url": app_obj.job_url,
        "notes": app_obj.notes,
        "status": app_obj.status,
        "created_at": str(app_obj.created_at) if app_obj.created_at else None,
        "has_resume": app_obj.resume_id is not None,
        "resume_filename": app_obj.resume.filename if app_obj.resume else None,
        "tailored_resume": app_obj.tailored_resume,
        "cover_letter": app_obj.cover_letter,
        "interview_questions": app_obj.interview_questions,
    }


@app.put("/applications/{application_id}")
def update_application(
    application_id: int,
    data: ApplicationUpdate,
    db: Session = Depends(get_db)
):
    app_obj = db.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(app_obj, field, value)
    db.commit()
    db.refresh(app_obj)
    return {"message": "Application updated", "id": app_obj.id}


@app.get("/users/{user_id}/resumes")
def get_user_resumes(user_id: int, db: Session = Depends(get_db)):
    resumes = db.query(Resume).filter(Resume.user_id == user_id).order_by(Resume.id.desc()).all()
    return [
        {"id": r.id, "filename": r.filename, "created_at": str(r.created_at)}
        for r in resumes
    ]


@app.delete("/resumes/{resume_id}")
def delete_resume(resume_id: int, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    # Unlink from any applications referencing this resume
    db.query(Application).filter(Application.resume_id == resume_id).update({"resume_id": None})
    db.delete(resume)
    db.commit()
    return {"message": "Resume deleted"}


# ── GET /resumes/{resume_id}/text — return raw resume text for the diff view
@app.get("/resumes/{resume_id}/text")
def get_resume_text(resume_id: int, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return {
        "id":          resume.id,
        "filename":    resume.filename,
        "resume_text": resume.resume_text or "",
        "created_at":  str(resume.created_at),
    }


# ── POST /applications/{id}/fit-analysis — run fit-analyzer agent only
@app.post("/applications/{application_id}/fit-analysis")
def run_fit_analysis(
    application_id: int,
    user_id: int = Query(..., description="Logged-in user ID for ownership check"),
    db: Session = Depends(get_db),
):
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found.")
    if application.user_id != user_id:
        raise HTTPException(status_code=403, detail="This application does not belong to the current user.")
    if not application.resume_id:
        raise HTTPException(
            status_code=400,
            detail="No resume linked. Upload and link a resume before running fit analysis."
        )
    source_resume = db.query(Resume).filter(Resume.id == application.resume_id).first()
    if not source_resume or not (source_resume.resume_text or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Linked resume has no readable text. Please re-upload the file."
        )
    if not application.jd_text or not application.jd_text.strip():
        raise HTTPException(
            status_code=400,
            detail="No job description found. Add a JD to this application before running fit analysis."
        )

    try:
        result = analyze_fit({
            "resume":          source_resume.resume_text,
            "job_description": application.jd_text,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fit analysis failed: {str(e)}")

    fit_text = result.get("fit_analysis", "")
    if not fit_text:
        raise HTTPException(status_code=500, detail="AI returned an empty fit analysis. Please try again.")

    # Persist into the latest draft if one exists; otherwise store on the application directly
    latest_draft = (
        db.query(Draft)
        .filter(Draft.application_id == application_id)
        .order_by(Draft.id.desc())
        .first()
    )
    if latest_draft:
        latest_draft.fit_analysis = fit_text
    # Always mirror onto Application so GET /applications/{id}/draft picks it up
    application.tailored_resume = application.tailored_resume  # no-op; keep existing value
    db.commit()

    return {
        "application_id": application_id,
        "fit_analysis":   fit_text,
        "message":        "Fit analysis complete.",
    }


# ── GET /applications/{id}/fit-analysis — retrieve stored fit analysis
@app.get("/applications/{application_id}/fit-analysis")
def get_fit_analysis(application_id: int, db: Session = Depends(get_db)):
    draft = (
        db.query(Draft)
        .filter(Draft.application_id == application_id)
        .order_by(Draft.id.desc())
        .first()
    )
    if not draft or not draft.fit_analysis:
        raise HTTPException(status_code=404, detail="No fit analysis found for this application.")
    return {
        "application_id": application_id,
        "fit_analysis":   draft.fit_analysis,
    }


# update status
@app.put("/applications/{application_id}/status")
def change_status(
    application_id: int,
    data: StatusUpdate,
    db: Session = Depends(get_db)
):
    return update_status(
        db,
        application_id,
        data.status
    )


# upload resume

@app.post("/upload-resume/{user_id}")
def upload_resume(
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Validate file extension
    allowed = {".pdf", ".docx"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a PDF or DOCX file."
        )

    os.makedirs("uploads", exist_ok=True)
    file_path = f"uploads/{file.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        resume = save_resume(db, user_id, file_path)
    except ValueError as e:
        # Text extraction failed — remove the orphan file
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to process resume: {str(e)}")

    if not resume.resume_text or not resume.resume_text.strip():
        # File parsed but no text found (e.g. scanned/image-only PDF)
        raise HTTPException(
            status_code=400,
            detail=(
                "Your resume file was uploaded but no text could be extracted. "
                "This usually means the PDF is image-based (scanned). "
                "Please upload a text-based PDF or a DOCX file."
            )
        )

    return {
        "message": "Resume uploaded successfully",
        "resume_id": resume.id,
        "filename": resume.filename
    }


@app.post("/optimize-resume/{user_id}")
def optimize_resume(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    original_resume = user.resume_text

    # AI output
    optimized_resume = "Optimized Resume Text"

    draft = save_optimized_resume(
        db=db,
        user_id=user_id,
        original_resume=original_resume,
        optimized_resume=optimized_resume
    )

    return {
        "draft_id": draft.id,
        "original_resume": draft.original_resume,
        "optimized_resume": draft.optimized_resume
    }


@app.put(
    "/applications/{application_id}/link-resume/{resume_id}"
)
def link_resume(
    application_id: int,
    resume_id: int,
    db: Session = Depends(get_db)
):
    application = (
        db.query(Application)
        .filter(Application.id == application_id)
        .first()
    )

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Application not found"
        )

    resume = (
        db.query(Resume)
        .filter(Resume.id == resume_id)
        .first()
    )

    if not resume:
        raise HTTPException(
            status_code=404,
            detail="Resume not found"
        )

    application.resume_id = resume.id

    db.commit()

    return {
        "message": "Resume linked successfully"
    }


# ══════════════════════════════════════════════════════════════
#  POST /applications/{application_id}/generate-resume
#  Dedicated resume-only generation with versioning.
#  Upserts into generated_resumes table (one row per application).
# ══════════════════════════════════════════════════════════════
@app.post("/applications/{application_id}/generate-resume")
def generate_resume_endpoint(
    application_id: int,
    user_id: int = Query(..., description="Logged-in user ID for ownership check"),
    db: Session = Depends(get_db)
):
    # 1. Fetch and validate application
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found.")

    # 2. Ownership check
    if application.user_id != user_id:
        raise HTTPException(status_code=403, detail="This application does not belong to the current user.")

    # 3. Validate resume is linked
    if not application.resume_id:
        raise HTTPException(
            status_code=400,
            detail="No resume linked to this application. Upload a resume and click 'Use this' to link it."
        )

    # 4. Load the uploaded resume
    source_resume = db.query(Resume).filter(Resume.id == application.resume_id).first()
    if not source_resume:
        raise HTTPException(
            status_code=404,
            detail="Linked resume record not found. It may have been deleted — please upload and link a new one."
        )
    if not source_resume.resume_text or not source_resume.resume_text.strip():
        raise HTTPException(
            status_code=400,
            detail="The linked resume appears to be empty or could not be parsed. Please re-upload the file."
        )

    # 5. Validate job description
    if not application.jd_text or not application.jd_text.strip():
        raise HTTPException(
            status_code=400,
            detail="No job description found. Add a job description to this application before generating."
        )

    # 6. Run resume rewriter agent only
    try:
        result = rewrite_resume({
            "resume":          source_resume.resume_text,
            "job_description": application.jd_text,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    generated_content = result.get("tailored_resume", "")
    if not generated_content:
        raise HTTPException(status_code=500, detail="AI returned an empty resume. Please try again.")

    # 7. Generate DOCX and PDF files
    docx_path = f"generated_files/resume_{application_id}.docx"
    pdf_path  = f"generated_files/resume_{application_id}.pdf"
    try:
        create_docx(generated_content, docx_path)
        create_pdf(generated_content,  pdf_path)
    except Exception:
        docx_path = None
        pdf_path  = None

    # 8. Upsert into generated_resumes (one row per application)
    now = datetime.utcnow()
    existing = db.query(GeneratedResume).filter(
        GeneratedResume.application_id == application_id
    ).first()

    if existing:
        existing.content    = generated_content
        existing.version    = (existing.version or 1) + 1
        existing.resume_id  = source_resume.id
        existing.docx_path  = docx_path
        existing.pdf_path   = pdf_path
        existing.updated_at = now
        record = existing
    else:
        record = GeneratedResume(
            user_id        = application.user_id,
            application_id = application_id,
            resume_id      = source_resume.id,
            content        = generated_content,
            version        = 1,
            docx_path      = docx_path,
            pdf_path       = pdf_path,
            created_at     = now,
            updated_at     = now,
        )
        db.add(record)

    # Also keep Application.tailored_resume in sync for other endpoints
    application.tailored_resume = generated_content
    application.resume_docx_path = docx_path
    application.resume_pdf_path  = pdf_path

    db.commit()
    db.refresh(record)

    return {
        "id":             record.id,
        "application_id": application_id,
        "resume_id":      source_resume.id,
        "content":        generated_content,
        "version":        record.version,
        "created_at":     record.created_at.isoformat(),
        "updated_at":     record.updated_at.isoformat(),
        "docx_path":      record.docx_path,
        "pdf_path":       record.pdf_path,
        "source_filename": source_resume.filename,
        "job_title":      application.job_title,
        "company":        application.company,
        "message":        "Resume generated successfully.",
    }


# GET /applications/{application_id}/generated-resume
@app.get("/applications/{application_id}/generated-resume")
def get_generated_resume(application_id: int, db: Session = Depends(get_db)):
    record = db.query(GeneratedResume).filter(
        GeneratedResume.application_id == application_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="No generated resume found for this application.")

    source = db.query(Resume).filter(Resume.id == record.resume_id).first()
    application = db.query(Application).filter(Application.id == application_id).first()

    return {
        "id":              record.id,
        "application_id":  application_id,
        "resume_id":       record.resume_id,
        "content":         record.content,
        "version":         record.version,
        "created_at":      record.created_at.isoformat() if record.created_at else None,
        "updated_at":      record.updated_at.isoformat() if record.updated_at else None,
        "source_filename": source.filename if source else None,
        "job_title":       application.job_title if application else None,
        "company":         application.company if application else None,
    }


# PUT /generated-resumes/{id}  — save edited text
@app.put("/generated-resumes/{generated_resume_id}")
def update_generated_resume(
    generated_resume_id: int,
    data: DraftResumeUpdate,
    db: Session = Depends(get_db)
):
    record = db.query(GeneratedResume).filter(GeneratedResume.id == generated_resume_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Generated resume not found.")

    record.content    = data.resume_rewrite
    record.updated_at = datetime.utcnow()

    # Regenerate files with edited text
    docx_path = f"generated_files/resume_{record.application_id}.docx"
    pdf_path  = f"generated_files/resume_{record.application_id}.pdf"
    try:
        create_docx(data.resume_rewrite, docx_path)
        create_pdf(data.resume_rewrite,  pdf_path)
        record.docx_path = docx_path
        record.pdf_path  = pdf_path
    except Exception:
        pass

    db.commit()
    return {"message": "Saved.", "updated_at": record.updated_at.isoformat()}


# Download endpoints for generated_resumes table
@app.get("/generated-resumes/{generated_resume_id}/download/pdf")
def download_generated_resume_pdf(generated_resume_id: int, db: Session = Depends(get_db)):
    record = db.query(GeneratedResume).filter(GeneratedResume.id == generated_resume_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Generated resume not found.")
    path = record.pdf_path
    if not path or not os.path.exists(path):
        # Regenerate on the fly
        path = f"generated_files/resume_{record.application_id}.pdf"
        create_pdf(record.content, path)
        record.pdf_path = path
        db.commit()
    return FileResponse(path, media_type="application/pdf",
                        filename=f"resume_{record.application_id}_v{record.version}.pdf")


@app.get("/generated-resumes/{generated_resume_id}/download/docx")
def download_generated_resume_docx(generated_resume_id: int, db: Session = Depends(get_db)):
    record = db.query(GeneratedResume).filter(GeneratedResume.id == generated_resume_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Generated resume not found.")
    path = record.docx_path
    if not path or not os.path.exists(path):
        path = f"generated_files/resume_{record.application_id}.docx"
        create_docx(record.content, path)
        record.docx_path = path
        db.commit()
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=f"resume_{record.application_id}_v{record.version}.docx"
    )


# POST /applications/{id}/generate
@app.post("/applications/{application_id}/generate")
def generate_ai_outputs(
    application_id: int,
    db: Session = Depends(get_db)
):
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if not application.resume:
        raise HTTPException(status_code=400, detail="No resume linked to this application. Upload and link a resume first.")
    if not application.jd_text:
        raise HTTPException(status_code=400, detail="No job description found on this application.")

    # Single LangGraph call
    result = graph.invoke({
        "resume": application.resume.resume_text,
        "job_description": application.jd_text
    })

    fit_analysis_text = result.get("fit_analysis", "")
    tailored_resume   = result.get("tailored_resume", "")
    cover_letter_text = result.get("cover_letter", "")
    questions_text    = result.get("interview_questions", "")

    # Generate files
    resume_docx = f"generated_files/resume_{application.id}.docx"
    resume_pdf  = f"generated_files/resume_{application.id}.pdf"
    cover_docx  = f"generated_files/cover_{application.id}.docx"
    cover_pdf   = f"generated_files/cover_{application.id}.pdf"

    create_docx(tailored_resume, resume_docx)
    create_pdf(tailored_resume,  resume_pdf)
    create_docx(cover_letter_text, cover_docx)
    create_pdf(cover_letter_text,  cover_pdf)

    # Update application fields
    application.tailored_resume   = tailored_resume
    application.cover_letter      = cover_letter_text
    application.interview_questions = questions_text
    application.resume_docx_path  = resume_docx
    application.resume_pdf_path   = resume_pdf
    application.cover_docx_path   = cover_docx
    application.cover_pdf_path    = cover_pdf

    # Delete old draft if any, create fresh one
    old_draft = db.query(Draft).filter(Draft.application_id == application_id).first()
    if old_draft:
        db.delete(old_draft)
        db.flush()

    draft = Draft(
        application_id=application.id,
        resume_id=application.resume_id,
        user_id=application.user_id,
        fit_analysis=fit_analysis_text,
        resume_rewrite=tailored_resume,
        cover_letter=cover_letter_text,
        interview_questions=questions_text,
        original_resume=application.resume.resume_text,
        optimized_resume=tailored_resume,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)

    return {
        "application_id": application.id,
        "draft_id": draft.id,
        "message": "AI content generated successfully",
        "resume_rewrite": tailored_resume,
    }



@app.get("/applications/{application_id}/draft")
def get_draft_by_application(
    application_id: int,
    db: Session = Depends(get_db)
):
    draft = (
        db.query(Draft)
        .filter(Draft.application_id == application_id)
        .order_by(Draft.id.desc())
        .first()
    )

    if not draft:
        raise HTTPException(
            status_code=404,
            detail="No draft found for this application. Run 'Generate' first."
        )

    return {
        "draft_id": draft.id,
        "application_id": application_id,
        "user_id": draft.user_id,
        "original_resume": draft.original_resume,
        "optimized_resume": draft.optimized_resume,
        "resume_rewrite": draft.resume_rewrite,
        "fit_analysis": draft.fit_analysis,
        "cover_letter": draft.cover_letter,
        "interview_questions": draft.interview_questions,
    }


@app.get("/drafts/{draft_id}")
def get_draft_endpoint(
    draft_id: int,
    db: Session = Depends(get_db)
):
    draft = get_draft(
        db=db,
        draft_id=draft_id
    )

    if not draft:
        raise HTTPException(
            status_code=404,
            detail="Draft not found"
        )

    return {
        "draft_id": draft.id,
        "user_id": draft.user_id,
        "original_resume": draft.original_resume,
        "optimized_resume": draft.optimized_resume,
        "fit_analysis": draft.fit_analysis,
        "cover_letter": draft.cover_letter,
        "interview_questions": draft.interview_questions,
        "resume_rewrite": draft.resume_rewrite,
    }


@app.put("/drafts/{draft_id}/update-resume")
def update_draft_resume(draft_id: int, data: DraftResumeUpdate, db: Session = Depends(get_db)):
    draft = db.query(Draft).filter(Draft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    draft.resume_rewrite  = data.resume_rewrite
    draft.optimized_resume = data.resume_rewrite
    # Regenerate files with edited text
    resume_docx = f"generated_files/resume_{draft.application_id}.docx"
    resume_pdf  = f"generated_files/resume_{draft.application_id}.pdf"
    create_docx(data.resume_rewrite, resume_docx)
    create_pdf(data.resume_rewrite,  resume_pdf)
    db.commit()
    return {"message": "Draft updated"}



# Resume Regeneration Endpoint
@app.post("/applications/{application_id}/regenerate/resume")
def regenerate_resume(
    application_id: int,
    db: Session = Depends(get_db)
):
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    resume = application.resume
    if not resume:
        raise HTTPException(status_code=400, detail="No resume linked to this application.")

    result = rewrite_resume({
        "resume": resume.resume_text,
        "job_description": application.jd_text
    })
    tailored = result["tailored_resume"]

    # Update application
    application.tailored_resume = tailored

    # Regenerate files
    resume_docx = f"generated_files/resume_{application.id}.docx"
    resume_pdf  = f"generated_files/resume_{application.id}.pdf"
    create_docx(tailored, resume_docx)
    create_pdf(tailored,  resume_pdf)
    application.resume_docx_path = resume_docx
    application.resume_pdf_path  = resume_pdf

    # Update latest draft so GET /draft returns fresh resume
    latest_draft = db.query(Draft).filter(Draft.application_id == application_id).order_by(Draft.id.desc()).first()
    if latest_draft:
        latest_draft.resume_rewrite  = tailored
        latest_draft.optimized_resume = tailored

    db.commit()
    return {
        "message": "Resume regenerated",
        "resume_rewrite": tailored
    }
# Cover Letter Generation / Regeneration
@app.post("/applications/{application_id}/regenerate/cover-letter")
def regenerate_cover_letter(
    application_id: int,
    db: Session = Depends(get_db)
):
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Prefer the already-tailored resume; fall back to the raw uploaded resume text
    resume_text = (
        application.tailored_resume
        or (application.resume.resume_text if application.resume else None)
    )
    if not resume_text or not resume_text.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "No resume text found for this application. "
                "Please upload and link a resume, then generate your tailored resume first."
            )
        )

    if not application.jd_text or not application.jd_text.strip():
        raise HTTPException(
            status_code=400,
            detail="No job description found. Add a job description to this application."
        )

    try:
        result = generate_cover_letter({
            "tailored_resume": resume_text,
            "job_description": application.jd_text,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    cover = result.get("cover_letter", "")
    if not cover or not cover.strip():
        raise HTTPException(status_code=500, detail="AI returned an empty cover letter. Please try again.")

    application.cover_letter = cover
    db.commit()

    return {
        "message": "Cover letter generated successfully",
        "cover_letter": cover,
    }


# Interview Questions Generation / Regeneration
@app.post("/applications/{application_id}/regenerate/questions")
def regenerate_questions_endpoint(
    application_id: int,
    db: Session = Depends(get_db)
):
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Prefer tailored resume; fall back to original uploaded resume
    resume_text = (
        application.tailored_resume
        or (application.resume.resume_text if application.resume else None)
    )
    if not resume_text or not resume_text.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "No resume text found for this application. "
                "Please upload and link a resume before generating interview questions."
            )
        )

    if not application.jd_text or not application.jd_text.strip():
        raise HTTPException(
            status_code=400,
            detail="No job description found. Add a job description to this application."
        )

    try:
        result = generate_questions({
            "resume": resume_text,
            "job_description": application.jd_text,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

    new_questions = result.get("interview_questions", "")
    if not new_questions or not new_questions.strip():
        raise HTTPException(status_code=500, detail="AI returned no questions. Please try again.")

    application.interview_questions = new_questions

    # Keep any existing Draft in sync
    latest_draft = (
        db.query(Draft)
        .filter(Draft.application_id == application_id)
        .order_by(Draft.id.desc())
        .first()
    )
    if latest_draft:
        latest_draft.interview_questions = new_questions

    db.commit()

    return {
        "message": "Interview questions generated successfully",
        "interview_questions": new_questions,
    }

# Resume download


@app.get(
    "/applications/{application_id}/resume/docx"
)
def download_resume_docx(
    application_id: int,
    db: Session = Depends(get_db)
):
    
    application = (
        db.query(Application)
        .filter(
            Application.id == application_id
        )
        .first()
    )
    if not application:
        raise HTTPException(
            status_code=404,
            detail="Application not found"
        )
    draft = db.query(Draft)\
    .filter(Draft.application_id == application_id)\
    .first()

    return FileResponse(
        draft.resume_docx_path,
        filename="resume.docx"
    )
    
# Resume pdf

@app.get(
    "/applications/{application_id}/resume/pdf"
)
def download_resume_pdf(
    application_id: int,
    db: Session = Depends(get_db)
):
    
    application = db.query(Application).filter(Application.id == application_id).first()

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Application not found"
        )
    

    draft = db.query(Draft)\
    .filter(Draft.application_id == application_id)\
    .first()

    return FileResponse(
        draft.resume_pdf_path,
        filename="resume.pdf"
    )

# cover letter download
@app.get("/applications/{application_id}/cover-letter/docx")
def download_cover_letter_docx(
    application_id: int,
    db: Session = Depends(get_db)
):
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if not application.cover_letter:
        raise HTTPException(status_code=404, detail="No cover letter found for this application.")

    file_path = f"generated_files/cover_{application_id}.docx"
    create_docx(application.cover_letter, file_path)
    application.cover_docx_path = file_path
    db.commit()
    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=f"cover_letter_{application_id}.docx"
    )

# cover letter pdf download
@app.get("/applications/{application_id}/cover-letter/pdf")
def download_cover_letter_pdf(
    application_id: int,
    db: Session = Depends(get_db)
):
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if not application.cover_letter:
        raise HTTPException(status_code=404, detail="No cover letter found for this application.")

    file_path = f"generated_files/cover_{application_id}.pdf"
    create_pdf(application.cover_letter, file_path)
    application.cover_pdf_path = file_path
    db.commit()
    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=f"cover_letter_{application_id}.pdf"
    )


# save docx resume in draft
@app.get(
    "/drafts/{id}/download/resume-docx"
)
def download_resume_docx(id: int):

    file_path = (
        f"generated_files/resume_{id}.docx"
    )

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="Resume DOCX not found"
        )

    return FileResponse(
        path=file_path,
        filename=f"resume_{id}.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

# save resume pdf in draft
@app.get(
    "/drafts/{id}/download/resume-pdf"
)
def download_resume_pdf(id: int):

    file_path = (
        f"generated_files/resume_{id}.pdf"
    )

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="Resume PDF not found"
        )

    return FileResponse(
        path=file_path,
        filename=f"resume_{id}.pdf",
        media_type="application/pdf"
    )

    # savedocx cover letter in draft
@app.get(
"/drafts/{id}/download/cover-docx"
)
def download_cover_docx(id: int):

    file_path = (
        f"generated_files/cover_{id}.docx"
    )

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="Cover Letter DOCX not found"
        )

    return FileResponse(
        path=file_path,
        filename=f"cover_{id}.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

    # save coverletter pdf in draft
@app.get(
"/drafts/{id}/download/cover-pdf"
)
def download_cover_pdf(id: int):

    file_path = (
        f"generated_files/cover_{id}.pdf"
    )

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="Cover Letter PDF not found"
        )

    return FileResponse(
        path=file_path,
        filename=f"cover_{id}.pdf",
        media_type="application/pdf"
    )
