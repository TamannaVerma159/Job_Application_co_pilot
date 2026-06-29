from langchain_groq import ChatGroq
from dotenv import load_dotenv
from state import JobState
import os
load_dotenv()
llm = ChatGroq(
    model="llama-3.3-70b-versatile"
)
def generate_questions(state: JobState):
    prompt = f"""
    Generate 10 likely interview questions
    for a candidate applying to this role.

    Resume:
    {state['resume']}

    Job Description:
    {state['job_description']}
    """

    result = llm.invoke(prompt)

    return {
        "interview_questions": result.content
    }
