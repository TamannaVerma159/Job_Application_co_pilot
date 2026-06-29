User uploads PDF
        ↓
Save PDF in uploads/
        ↓
Extract text using pypdf
        ↓
Save text in resumes table
        ↓
Send resume_text + job_description
to AI agent
        ↓
Save AI output in drafts table



login.js -	Login and save JWT token
dashboard.js-	Dashboard statistics and recent applications
applications.js-	Create, edit, delete, and list applications
resume.js-	View, edit, regenerate, and download resumes
cover.js-	View, edit, regenerate, and download cover letters
interview.js-	Display and regenerate mock interview questions
auth.js-	Common authentication helper functions
api.js-	Base API URL and reusable fetch wrapper



mapping frontend files with backendendpoints
Frontend File	Backend Endpoint
login.js	POST /login
dashboard.js	GET /applications
applications.js	GET /applications, POST /applications, DELETE /applications/{id}
resume.js	GET /drafts/{id}, POST /regenerate/resume, GET /drafts/{id}/download/resume-pdf, GET /drafts/{id}/download/resume-docx
cover.js	GET /drafts/{id}, POST /regenerate/cover, GET /drafts/{id}/download/cover-pdf, GET /drafts/{id}/download/cover-docx
interview.js	GET /drafts/{id}, POST /regenerate/interview
api.js	Shared helper that all the above files use to communicate with the FastAPI backend