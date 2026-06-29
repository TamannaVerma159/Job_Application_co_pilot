from langchain_groq import ChatGroq
from dotenv import load_dotenv
from state import JobState
import os
load_dotenv()
llm = ChatGroq(
    model="llama-3.3-70b-versatile"
)
def generate_cover_letter(
    state:JobState
):
    prompt = f"""
    Write a professional
    cover letter.
    
    Resume:
    {state['tailored_resume']}

    JD:
    {state['job_description']}
    """

    result = llm.invoke(prompt)

    return {
        "cover_letter": result.content
    }

    