# Job Application Co-Pilot

An AI-powered job application assistant that helps you tailor your resume, generate cover letters, and prepare for interviews — all from one place.

---

## Features

- **Resume Upload & Parsing** — Upload PDF or DOCX resumes; text is extracted automatically
- **AI Resume Rewriting** — Rewrites your resume bullets to match a specific job description
- **Before / After Diff View** — Side-by-side word-level diff of original vs. tailored resume
- **Fit Analysis** — AI scores how well your resume matches the job description
- **Cover Letter Generation** — Generates a tailored cover letter from your resume and JD
- **Interview Prep** — Generates 10 likely interview questions for the role with a practice-answer panel
- **Download** — Export resumes and cover letters as PDF or DOCX
- **JWT Authentication** — Secure login with 24-hour token expiry

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLAlchemy, SQLite |
| AI Agents | LangChain + Groq (`llama-3.3-70b-versatile`) |
| Auth | python-jose (JWT, HS256) |
| File Parsing | pypdf, python-docx |
| File Generation | reportlab (PDF), python-docx (DOCX) |
| Frontend | Vanilla HTML / CSS / JavaScript |

---

## Project Structure

```
JOB-APPlication_CO-pilot/
├── backend/
│   ├── agents/
│   │   ├── fit_analyzer.py          # Fit analysis agent
│   │   ├── resume_rewriter.py       # Resume tailoring agent
│   │   ├── cover_letter_writer.py   # Cover letter agent
│   │   ├── interview_generator.py   # Interview questions agent
│   │   └── state.py                 # Shared LangGraph state type
│   ├── utils/
│   │   ├── pdf_parser.py            # PDF + DOCX text extraction
│   │   ├── pdf_generator.py         # PDF generation via reportlab
│   │   └── docx_generator.py        # DOCX generation via python-docx
│   ├── main.py                      # FastAPI app — all routes
│   ├── models.py                    # SQLAlchemy ORM models
│   ├── schemas.py                   # Pydantic request/response schemas
│   ├── crud.py                      # DB helper functions
│   ├── database.py                  # DB engine + session setup
│   ├── state.py                     # LangGraph pipeline state
│   ├── requirements.txt
│   ├── .env                         # GROQ_API_KEY, SECRET_KEY
│   ├── uploads/                     # Uploaded resume files
│   └── generated_files/             # Generated PDF/DOCX outputs
└── frontend/
    ├── index.html                   # Landing page
    ├── login.html
    ├── register.html
    ├── dashboard.html               # Application overview + stats
    ├── application.html             # Application list
    ├── application_details.html     # Per-application hub (resume, fit, diff)
    ├── resume.html                  # Tailored resume viewer / editor
    ├── cover-letter.html            # Cover letter viewer / editor
    ├── interview.html               # Interview questions + practice mode
    ├── js/
    │   ├── auth.js                  # JWT token helper
    │   ├── login.js / register.js
    │   ├── dashboard.js
    │   ├── applications.js          # CRUD for applications
    │   ├── application_details.js   # Fit analysis, diff view, resume linking
    │   ├── resume.js                # Tailored resume generation + download
    │   ├── cover.js                 # Cover letter generation + download
    │   └── interview.js             # Question generation + practice mode
    └── css/
        ├── style.css
        └── ...
```

---

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd JOB-APPlication_CO-pilot
```

### 2. Create and activate the virtual environment

```bash
cd backend
python -m venv env

# Windows
env\Scripts\activate

# macOS / Linux
source env/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create `backend/.env` (or edit the existing one):

```env
GROQ_API_KEY=your_groq_api_key_here
SECRET_KEY=your_long_random_secret_key_here
```

Get a free Groq API key at [console.groq.com](https://console.groq.com).

### 5. Initialise the database

```bash
python create_database_file.py
```

### 6. Start the backend

```bash
uvicorn main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.

### 7. Open the frontend

Open `frontend/index.html` in your browser (no build step required).

---

## API Overview

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Create a new account |
| POST | `/login` | Login and receive a JWT token |

### Applications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/applications?user_id=` | List all applications for a user |
| POST | `/applications` | Create a new application |
| GET | `/applications/{id}` | Get application details |
| PUT | `/applications/{id}` | Update application fields |
| DELETE | `/applications/{id}` | Delete an application |
| PUT | `/applications/{id}/status` | Update application status |

### Resumes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload-resume/{user_id}` | Upload a PDF or DOCX resume |
| GET | `/users/{user_id}/resumes` | List uploaded resumes |
| PUT | `/applications/{id}/link-resume/{resume_id}` | Link a resume to an application |
| GET | `/resumes/{id}/text` | Get extracted resume text |
| DELETE | `/resumes/{id}` | Delete a resume |

### AI Generation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/applications/{id}/fit-analysis?user_id=` | Run fit analysis |
| GET | `/applications/{id}/fit-analysis` | Get stored fit analysis |
| POST | `/applications/{id}/generate-resume?user_id=` | Generate tailored resume |
| GET | `/applications/{id}/generated-resume` | Get generated resume |
| PUT | `/generated-resumes/{id}` | Save edits to generated resume |
| POST | `/applications/{id}/regenerate/cover-letter` | Generate / regenerate cover letter |
| POST | `/applications/{id}/regenerate/questions` | Generate / regenerate interview questions |

### Downloads
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/generated-resumes/{id}/download/pdf` | Download tailored resume as PDF |
| GET | `/generated-resumes/{id}/download/docx` | Download tailored resume as DOCX |
| GET | `/applications/{id}/cover-letter/pdf` | Download cover letter as PDF |
| GET | `/applications/{id}/cover-letter/docx` | Download cover letter as DOCX |

---

## Workflow

```
Register / Login
       ↓
Create Application (job title, company, job description)
       ↓
Upload Resume (PDF or DOCX)  →  Link to Application
       ↓
Run Fit Analysis  (AI scores resume vs. JD)
       ↓
Generate Tailored Resume  →  View Before/After Diff  →  Edit & Download
       ↓
Generate Cover Letter  →  Edit & Download
       ↓
Generate Interview Questions  →  Practice Mode
```

---

## Database Models

| Table | Key Columns |
|-------|-------------|
| `users` | id, name, email, password |
| `resumes` | id, user_id, filename, resume_text |
| `applications` | id, user_id, resume_id, job_title, company, jd_text, status, tailored_resume, cover_letter, interview_questions |
| `generated_resumes` | id, application_id, resume_rewrite, created_at |
| `drafts` | id, application_id, fit_analysis, tailored_resume, cover_letter, interview_questions |

---

## Notes

- The backend must be running on `http://127.0.0.1:8000` before opening the frontend.
- Uploaded files are stored locally in `backend/uploads/`. For production, use object storage (S3, GCS, etc.).
- The SQLite database file `job_copilot.db` is created in the `backend/` directory.
- All AI generation uses the `llama-3.3-70b-versatile` model via Groq's free API.
