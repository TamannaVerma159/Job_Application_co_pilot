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

/* ── Toast ── */
function showToast(msg, type = "success") {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className   = `show ${type}`;
    setTimeout(() => { t.className = ""; }, 3000);
}

/* ── Char counter ── */
function updateCharCount(text) {
    const el = document.getElementById("charCount");
    if (el) el.textContent = `${(text || "").length.toLocaleString()} characters`;
}

/* ── Render editable textarea ── */
function renderTextarea(content) {
    document.getElementById("coverBody").innerHTML =
        `<textarea id="coverText" spellcheck="true"></textarea>`;
    const ta = document.getElementById("coverText");
    ta.value = content || "";
    updateCharCount(content);
    ta.addEventListener("input", () => updateCharCount(ta.value));
}

/* ── State / error box ── */
function renderState(icon, message, sub = "", isError = false) {
    document.getElementById("coverBody").innerHTML = `
        <div class="state-box ${isError ? "error" : ""}">
            <div class="icon">${icon}</div>
            <p>${message}</p>
            ${sub ? `<small>${sub}</small>` : ""}
        </div>`;
    const meta = document.getElementById("coverMeta");
    if (meta) meta.textContent = isError ? "Error" : "";
}

/* ══════════════════════════════════════════════════
   LOAD
   Source of truth is Application.cover_letter.
   We load the full application object and check that
   field — no Draft dependency.
══════════════════════════════════════════════════ */
async function loadCoverLetter() {
    if (!applicationId) {
        renderState("📋", "No application selected.",
            'Open this page from the <a href="application.html">Applications list</a>.');
        return;
    }

    renderState("⏳", "Loading cover letter…");

    try {
        const res = await fetch(`${API}/applications/${applicationId}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const app = await res.json();

        const meta = document.getElementById("coverMeta");
        if (meta) meta.textContent = `${app.company} · ${app.job_title}`;

        if (app.cover_letter && app.cover_letter.trim()) {
            renderTextarea(app.cover_letter);
        } else {
            /* No cover letter yet — prompt user to generate one */
            renderGeneratePrompt(app);
        }

    } catch (err) {
        renderState("⚠️", "Could not load application.",
            "Make sure the backend is running on port 8000.", true);
    }
}

/* Show a prompt with a Generate button when no cover letter exists */
function renderGeneratePrompt(app) {
    const hasResume = !!(app.resume_id || app.tailored_resume);
    const hasJD     = !!(app.jd_text && app.jd_text.trim());
    const canGenerate = hasResume && hasJD;

    let hint = "";
    if (!hasResume) hint = "Upload and link a resume from the Application Details page first.";
    else if (!hasJD) hint = "Add a job description to this application before generating.";
    else hint = "Click <strong>Generate</strong> to create a cover letter tailored to this job.";

    document.getElementById("coverBody").innerHTML = `
        <div class="state-box">
            <div class="icon">✉️</div>
            <p>No cover letter generated yet.</p>
            <small>${hint}</small>
            ${canGenerate ? `
            <div style="margin-top:18px;">
                <button class="btn-primary" id="generateCoverBtn" style="padding:10px 24px;">
                    ✉ Generate Cover Letter
                </button>
            </div>` : ""}
        </div>`;

    if (canGenerate) {
        document.getElementById("generateCoverBtn").addEventListener("click", generateCoverLetter);
    }
}

/* ══════════════════════════════════════════════════
   GENERATE (first time)
══════════════════════════════════════════════════ */
async function generateCoverLetter() {
    renderState("🤖", "Generating your cover letter…",
        "The AI is writing a tailored cover letter. Takes ~15 seconds.");

    try {
        const res  = await fetch(
            `${API}/applications/${applicationId}/regenerate/cover-letter`,
            { method: "POST" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Server error ${res.status}`);

        const content = data.cover_letter || "";
        if (!content) throw new Error("AI returned an empty cover letter. Please try again.");

        renderTextarea(content);
        showToast("Cover letter generated!", "success");
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
    showToast("Regenerating cover letter…");

    try {
        const res  = await fetch(
            `${API}/applications/${applicationId}/regenerate/cover-letter`,
            { method: "POST" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Server returned ${res.status}`);

        const content = data.cover_letter || "";
        renderTextarea(content);
        showToast("Cover letter regenerated!", "success");
    } catch (err) {
        showToast(err.message || "Regeneration failed.", "error");
    } finally {
        btn.disabled  = false;
        btn.innerHTML = "↺ Regenerate";
    }
});

/* ══════════════════════════════════════════════════
   SAVE  — persists edits to Application.cover_letter
══════════════════════════════════════════════════ */
document.getElementById("saveBtn").addEventListener("click", async () => {
    const ta = document.getElementById("coverText");
    if (!ta) { showToast("Nothing to save.", "error"); return; }
    if (!applicationId) { showToast("No application selected.", "error"); return; }

    const btn = document.getElementById("saveBtn");
    btn.disabled  = true;
    btn.textContent = "Saving…";

    try {
        const res = await fetch(`${API}/applications/${applicationId}`, {
            method : "PUT",
            headers: { "Content-Type": "application/json" },
            body   : JSON.stringify({ cover_letter: ta.value })
        });
        if (res.ok) {
            showToast("Cover letter saved!", "success");
        } else {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Server error ${res.status}`);
        }
    } catch (err) {
        showToast(err.message || "Save failed.", "error");
    } finally {
        btn.disabled    = false;
        btn.textContent = "✓ Save";
    }
});

/* ══════════════════════════════════════════════════
   DOWNLOAD
══════════════════════════════════════════════════ */
function triggerDownload(url, filename) {
    /* Save current edits to the Application first, then trigger download */
    const ta = document.getElementById("coverText");
    if (!ta) { showToast("Generate a cover letter first.", "error"); return; }

    const a = document.createElement("a");
    a.href     = url;
    a.download = filename;
    a.target   = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

document.getElementById("downloadPdfBtn").addEventListener("click", () => {
    if (!applicationId) { showToast("No application selected.", "error"); return; }
    triggerDownload(
        `${API}/applications/${applicationId}/cover-letter/pdf`,
        `cover_letter_${applicationId}.pdf`
    );
});

document.getElementById("downloadDocxBtn").addEventListener("click", () => {
    if (!applicationId) { showToast("No application selected.", "error"); return; }
    triggerDownload(
        `${API}/applications/${applicationId}/cover-letter/docx`,
        `cover_letter_${applicationId}.docx`
    );
});

/* ── Boot ── */
loadCoverLetter();
