from langchain_groq import ChatGroq
from dotenv import load_dotenv
from state import JobState
import os
load_dotenv()
llm = ChatGroq(
    model="llama-3.3-70b-versatile"
)

def analyze_fit(
    state: JobState
):
    prompt = f"""
    Compare resume and job description.

    Resume:
    {state['resume']}

    Job Description:
    {state['job_description']}

    Give:
    1. Match Score
    2. Missing Skills
    3. Strengths
    """

    result = llm.invoke(prompt)

    return {
        "fit_analysis": result.content
    }