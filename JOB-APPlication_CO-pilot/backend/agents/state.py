# state.py

from typing import TypedDict, Optional


class JobState(TypedDict):
    application_id: int

    # Inputs
    resume: str
    job_description: str

    # Agent Results
    fit_score: Optional[int]
    fit_analysis: Optional[str]

    tailored_resume: Optional[str]

    cover_letter: Optional[str]

    interview_questions: Optional[list]

    # Store errors if any
    error: Optional[str]