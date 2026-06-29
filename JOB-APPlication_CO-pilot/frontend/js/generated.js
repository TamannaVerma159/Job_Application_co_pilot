const params = new URLSearchParams(window.location.search);

const draftId = params.get("draft");

if (!draftId) {
    document.body.innerHTML = "<p>Error: no draft ID in URL. Please generate from the application page.</p>";
    throw new Error("Missing draft ID");
}

async function loadGeneratedResults() {

    const response = await fetch(

        `https://job-application-co-pilot-1.onrender.com/drafts/${draftId}`

    );

    const data = await response.json();

    document.getElementById("fit_score").innerHTML =
        data.fit_analysis;

    document.getElementById("resume").textContent =
        data.optimized_resume;

    document.getElementById("cover_letter").textContent =
        data.cover_letter;

    const list = document.getElementById("questions");

    
    document.getElementById("questions").textContent = data.interview_questions;
    

}

loadGeneratedResults();