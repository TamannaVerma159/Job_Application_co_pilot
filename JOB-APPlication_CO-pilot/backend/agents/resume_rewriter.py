from langchain_groq import ChatGroq
from dotenv import load_dotenv
from state import JobState
import os
load_dotenv()
llm = ChatGroq(
    model="llama-3.3-70b-versatile"
)

def rewrite_resume(
    state:JobState
):
    prompt = f"""
    Rewrite the resume
    specifically for this job.

    Resume:
    {state['resume']}

    Job Description:
    {state['job_description']}
    """

    result = llm.invoke(prompt)
    return{
        "tailored_resume": result.content
    }