from langgraph.graph import StateGraph, START,END
from state import JobState
from agents.fit_analyzer import analyze_fit
from agents.resume_rewriter import rewrite_resume
from agents.cover_letter_writer import generate_cover_letter
from agents.interview_generator import generate_questions


graph1 = StateGraph(JobState)

# nodes
graph1.add_node("analyze_fit", analyze_fit)
graph1.add_node("rewrite_resume", rewrite_resume)
graph1.add_node("generate_cover_letter", generate_cover_letter)
graph1.add_node("generate_questions", generate_questions)

# edges
graph1.add_edge(START, "analyze_fit")
graph1.add_edge("analyze_fit","rewrite_resume")
graph1.add_edge("rewrite_resume","generate_cover_letter")
graph1.add_edge("generate_cover_letter", "generate_questions")
graph1.add_edge("generate_questions", END)

graph = graph1.compile()

# run workflow

if __name__ == "__main__":
    result = graph.invoke(
        {
            "resume": "Python Developer",
            "job_description": "Backend Developer"
        }
    )

    print(result)