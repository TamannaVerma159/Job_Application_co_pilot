const API = "https://job-application-co-pilot-1.onrender.com";

/* ── Auth guard ── */
const user  = JSON.parse(localStorage.getItem("user") || "null");
const token = localStorage.getItem("token");
if (!user || !token) { window.location.href = "login.html"; }

/* ── Logout ── */
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
});

/* ── URL param ── */
const params        = new URLSearchParams(window.location.search);
const applicationId = params.get("application_id") || params.get("id");

/* ── State ── */
let allExpanded  = false;
let practiceMode = false;

/* ── Toast ── */
function showToast(msg, type = "success") {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className   = `show ${type}`;
    setTimeout(() => { t.className = ""; }, 3500);
}

/* ── Parse LLM numbered list into array of question strings ── */
function parseQuestions(raw) {
    if (!raw || !raw.trim()) return [];

    const lines = raw.split(/\n/).map(l => l.trim()).filter(Boolean);
    const questions = [];
    let current = "";

    for (const line of lines) {
        if (/^\d+[\.\)]\s/.test(line)) {
            if (current) questions.push(current.trim());
            current = line.replace(/^\d+[\.\)]\s*/, "");
        } else {
            current += (current ? " " : "") + line;
        }
    }
    if (current) questions.push(current.trim());

    return questions.length ? questions : [raw.trim()];
}

/* ── Escape HTML ── */
function escapeHtml(str) {
    return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/* ── Render question cards ── */
function renderQuestions(questionsArr, appLabel = "") {
    const container = document.getElementById("questionList");
    const countEl   = document.getElementById("qCount");
    const metaEl    = document.getElementById("interviewMeta");

    if (countEl) countEl.textContent =
        `${questionsArr.length} question${questionsArr.length !== 1 ? "s" : ""}`;
    if (metaEl) metaEl.textContent = appLabel;

    if (!questionsArr.length) {
        container.innerHTML = `
            <div class="state-box">
                <div class="icon">❓</div>
                <p>No questions found.</p>
                <small>Try regenerating below.</small>
            </div>`;
        return;
    }

    container.innerHTML = questionsArr.map((q, i) => `
        <div class="q-item" data-index="${i}">
            <div class="q-header">
                <div class="q-number">${i + 1}</div>
                <div class="q-text">${escapeHtml(q)}</div>
                <div class="q-chevron">▼</div>
            </div>
            <div class="q-practice">
                <label>Your practice answer</label>
                <textarea placeholder="Type your answer here to practise before the interview…" rows="4"></textarea>
            </div>
        </div>
    `).join("");

    container.querySelectorAll(".q-header").forEach(header => {
        header.addEventListener("click", () => {
            header.closest(".q-item").classList.toggle("open");
            syncExpandBtn();
        });
    });
}

/* ── State box ── */
function renderState(icon, message, sub = "", isError = false) {
    document.getElementById("questionList").innerHTML = `
        <div class="state-box ${isError ? "error" : ""}">
            <div class="icon">${icon}</div>
            <p>${message}</p>
            ${sub ? `<small>${sub}</small>` : ""}
        </div>`;
    const countEl = document.getElementById("qCount");
    const metaEl  = document.getElementById("interviewMeta");
    if (countEl) countEl.textContent = "";
    if (metaEl)  metaEl.textContent  = isError ? "Error" : "";
}

/* ── Sync expand-all button label ── */
function syncExpandBtn() {
    const items     = document.querySelectorAll(".q-item");
    const openCount = document.querySelectorAll(".q-item.open").length;
    allExpanded     = openCount === items.length && items.length > 0;
    const btn = document.getElementById("expandAllBtn");
    if (btn) btn.textContent = allExpanded ? "↕ Collapse all" : "↕ Expand all";
}

/* ══════════════════════════════════════════════════
   LOAD
   Source of truth is Application.interview_questions.
   No Draft dependency.
══════════════════════════════════════════════════ */
async function loadQuestions() {
    if (!applicationId) {
        renderState("📋", "No application selected.",
            'Open this page from the <a href="application.html">Applications list</a>.');
        return;
    }

    renderState("⏳", "Loading questions…");

    try {
        const res = await fetch(`${API}/applications/${applicationId}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const app = await res.json();

        if (app.interview_questions && app.interview_questions.trim()) {
            const questions = parseQuestions(app.interview_questions);
            renderQuestions(questions, `${app.company} · ${app.job_title} · ${questions.length} questions`);
        } else {
            /* No questions yet */
            renderGeneratePrompt(app);
        }

    } catch (err) {
        renderState("⚠️", "Could not load interview questions.",
            "Make sure the backend is running on port 8000.", true);
    }
}

/* Show generate prompt when no questions exist */
function renderGeneratePrompt(app) {
    const hasResume   = !!(app.resume_id || app.tailored_resume);
    const hasJD       = !!(app.jd_text && app.jd_text.trim());
    const canGenerate = hasResume && hasJD;

    let hint = "";
    if (!hasResume) hint = "Upload and link a resume from the Application Details page first.";
    else if (!hasJD) hint = "Add a job description to this application before generating.";
    else hint = "Click <strong>Generate Questions</strong> to get 10 likely interview questions for this role.";

    document.getElementById("questionList").innerHTML = `
        <div class="state-box">
            <div class="icon">🎤</div>
            <p>No interview questions generated yet.</p>
            <small>${hint}</small>
            ${canGenerate ? `
            <div style="margin-top:18px;">
                <button class="btn-primary" id="generateQuestionsBtn" style="padding:10px 24px;">
                    🎤 Generate Questions
                </button>
            </div>` : ""}
        </div>`;

    const countEl = document.getElementById("qCount");
    const metaEl  = document.getElementById("interviewMeta");
    if (countEl) countEl.textContent = "";
    if (metaEl)  metaEl.textContent  = `${app.company} · ${app.job_title}`;

    if (canGenerate) {
        document.getElementById("generateQuestionsBtn").addEventListener("click", generateQuestions);
    }
}

/* ══════════════════════════════════════════════════
   GENERATE (first time)
══════════════════════════════════════════════════ */
async function generateQuestions() {
    renderState("🤖", "Generating interview questions…",
        "The AI is preparing 10 likely questions for this role. Takes ~15 seconds.");

    try {
        const res  = await fetch(
            `${API}/applications/${applicationId}/regenerate/questions`,
            { method: "POST" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Server error ${res.status}`);

        const raw = data.interview_questions || "";
        if (!raw) throw new Error("AI returned no questions. Please try again.");

        const questions = parseQuestions(raw);
        renderQuestions(questions, `${questions.length} questions generated`);
        showToast("Interview questions generated!", "success");
    } catch (err) {
        renderState("⚠️", "Generation failed.", err.message, true);
        showToast(err.message, "error");
    }
}

/* ══════════════════════════════════════════════════
   REGENERATE
══════════════════════════════════════════════════ */
document.getElementById("regenerateBtn").addEventListener("click", async () => {
    if (!applicationId) { showToast("No application selected.", "error"); return; }

    const btn = document.getElementById("regenerateBtn");
    btn.disabled  = true;
    btn.innerHTML = `<span class="spinner"></span> Regenerating…`;

    try {
        const res  = await fetch(
            `${API}/applications/${applicationId}/regenerate/questions`,
            { method: "POST" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Server returned ${res.status}`);

        const questions = parseQuestions(data.interview_questions);
        renderQuestions(questions, `${questions.length} questions (regenerated)`);
        showToast("Interview questions regenerated!", "success");

    } catch (err) {
        showToast(err.message || "Regeneration failed.", "error");
    } finally {
        btn.disabled  = false;
        btn.innerHTML = "↺ Regenerate";
    }
});

/* ── Expand / collapse all ── */
document.getElementById("expandAllBtn").addEventListener("click", () => {
    const items = document.querySelectorAll(".q-item");
    if (!items.length) return;
    allExpanded = !allExpanded;
    items.forEach(item => item.classList.toggle("open", allExpanded));
    const btn = document.getElementById("expandAllBtn");
    if (btn) btn.textContent = allExpanded ? "↕ Collapse all" : "↕ Expand all";
});

/* ── Practice mode ── */
document.getElementById("practiceBtn").addEventListener("click", () => {
    const items = document.querySelectorAll(".q-item");
    if (!items.length) {
        showToast("Generate questions first.", "error"); return;
    }

    practiceMode = !practiceMode;
    const btn = document.getElementById("practiceBtn");

    if (practiceMode) {
        items.forEach(item => item.classList.add("open"));
        allExpanded = true;
        syncExpandBtn();
        btn.textContent = "✕ Exit practice";
        btn.classList.replace("btn-primary", "btn-outline");
        const first = document.querySelector(".q-practice textarea");
        if (first) first.focus();
        showToast("Practice mode on — type your answers in each box.", "success");
    } else {
        items.forEach(item => item.classList.remove("open"));
        allExpanded = false;
        syncExpandBtn();
        btn.textContent = "▶ Practice mode";
        btn.classList.replace("btn-outline", "btn-primary");
    }
});

/* ── Boot ── */
loadQuestions();
