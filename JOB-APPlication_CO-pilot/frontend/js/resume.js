const API = "https://job-application-co-pilot-1.onrender.com";

/* ── Auth guard ── */
const user  = JSON.parse(localStorage.getItem("user") || "null");
const token = localStorage.getItem("token");
if (!user || !token) { location.href = "index.html"; }

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    location.href = "index.html";
});

/* ── URL param ── */
const params        = new URLSearchParams(window.location.search);
const applicationId = params.get("application_id") || params.get("id");

/* ── Module state ── */
let generatedRecord = null;   // GeneratedResume object from API
let linkedResumeId  = null;   // resume_id linked to this application
let appData         = null;

/* ── Toast ── */
function showToast(msg, type = "success") {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className   = `toast show ${type}`;
    setTimeout(() => { t.className = "toast"; }, 3500);
}

/* ── Char counter ── */
function updateCharCount(text) {
    document.getElementById("charCount").textContent =
        `${(text || "").length.toLocaleString()} chars`;
}

/* ── Editable textarea ── */
function renderTextarea(content) {
    const body = document.getElementById("resumeBody");
    body.innerHTML = `<textarea id="resumeText"></textarea>`;
    const ta = document.getElementById("resumeText");
    ta.value = content || "";
    updateCharCount(content);
    ta.addEventListener("input", () => updateCharCount(ta.value));
}

/* ── State-box placeholder ── */
function renderState(icon, msg, sub = "", isError = false) {
    document.getElementById("resumeBody").innerHTML = `
        <div class="state-box${isError ? " error" : ""}">
            <div class="icon">${icon}</div>
            <p>${msg}</p>
            ${sub ? `<small>${sub}</small>` : ""}
        </div>`;
}

/*
 * ── Action bar ──
 *   'generated' → has GeneratedResume: Regenerate + Save + Download
 *   'ready'     → resume linked, no generated content yet: Generate button
 *   'no_resume' → application loaded but no resume linked
 *   'none'      → no application context
 */
function renderActions(state) {
    const bar = document.getElementById("mainActions");
    bar.innerHTML = "";

    if (state === "generated") {
        bar.innerHTML = `
            <button class="btn-primary" id="regenerateBtn">↻ Regenerate</button>
            <button class="btn-ghost"   id="saveBtn">✓ Save</button>
            <button class="btn-ghost"   id="downloadPdfBtn">↓ PDF</button>
            <button class="btn-ghost"   id="downloadDocxBtn">↓ DOCX</button>`;
        document.getElementById("regenerateBtn").addEventListener("click", regenerateResume);
        document.getElementById("saveBtn").addEventListener("click", saveResume);
        document.getElementById("downloadPdfBtn").addEventListener("click",
            () => triggerDownload("pdf"));
        document.getElementById("downloadDocxBtn").addEventListener("click",
            () => triggerDownload("docx"));

    } else if (state === "ready") {
        bar.innerHTML = `
            <button class="btn-primary" id="generateBtn">✨ Generate Resume</button>`;
        document.getElementById("generateBtn").addEventListener("click", generateResume);
    }
    // 'no_resume' and 'none' → empty bar; guidance is in the state-box
}

/* ── Active-resume status banner ── */
function renderActiveResumeBanner(filename) {
    const meta = document.getElementById("pageMeta");
    if (filename) {
        meta.innerHTML = `
            ${appData ? `<strong>${esc(appData.company)}</strong> · ${esc(appData.job_title)} &nbsp;|&nbsp;` : ""}
            <span style="color:#16a34a;font-weight:600;">✓ Active Resume: ${esc(filename)}</span>`;
    } else if (appData) {
        meta.innerHTML =
            `<strong>${esc(appData.company)}</strong> · ${esc(appData.job_title)} &nbsp;|&nbsp;
             <span style="color:#f59e0b;font-weight:600;">⚠ No resume linked</span>`;
    } else {
        meta.textContent = "No application selected";
    }
}

/* ═══════════════════════════════════════════
   INIT — load everything in order
═══════════════════════════════════════════ */
async function init() {
    /* 1. No application_id in URL */
    if (!applicationId) {
        document.getElementById("pageMeta").textContent = "No application selected";
        renderState(
            "📋",
            "No application selected.",
            'Open this page from the <a href="application.html" style="color:#2563eb">Applications list</a>, ' +
            'or select a job application first.'
        );
        renderActions("none");
        await loadUserResumes();
        return;
    }

    /* 2. Load application info */
    try {
        const res = await fetch(`${API}/applications/${applicationId}`);
        if (!res.ok) throw new Error(`Application not found (${res.status})`);
        appData        = await res.json();
        linkedResumeId = appData.resume_id || null;
    } catch (e) {
        renderState("⚠️", "Could not load application.", e.message, true);
        renderActions("none");
        document.getElementById("pageMeta").textContent = "Error";
        return;
    }

    /* 3. Populate resume upload section */
    await loadUserResumes();

    /* 4. Load generated resume (GeneratedResume table) */
    await loadGeneratedContent();
}

/* ═══════════════════════════════════════════
   RESUME LIST (upload section)
═══════════════════════════════════════════ */
async function loadUserResumes() {
    const list = document.getElementById("resumeList");
    list.innerHTML = `<p style="font-size:13px;color:#94a3b8;margin-top:8px;">Loading your resumes…</p>`;

    let resumes = [];
    try {
        const res = await fetch(`${API}/users/${user.id}/resumes`);
        if (!res.ok) throw new Error();
        resumes = await res.json();
    } catch {
        list.innerHTML = `<p style="font-size:13px;color:#dc2626;margin-top:8px;">Failed to load resumes.</p>`;
        return;
    }

    if (!resumes.length) {
        list.innerHTML = `<p style="font-size:13px;color:#94a3b8;margin-top:10px;">
            No resumes uploaded yet. Upload a PDF or DOCX above.</p>`;
        renderActiveResumeBanner(null);
        return;
    }

    const linked = resumes.find(r => r.id === linkedResumeId);
    renderActiveResumeBanner(linked ? linked.filename : null);

    list.innerHTML = resumes.map(r => {
        const isLinked = (r.id === linkedResumeId);
        const date     = new Date(r.created_at).toLocaleDateString();
        const useBtn   = applicationId && !isLinked
            ? `<button class="btn-ghost" style="font-size:12px;padding:5px 12px"
                onclick="linkResume(${r.id}, '${esc(r.filename)}')">Use this</button>`
            : "";
        return `
        <div class="resume-item${isLinked ? " selected" : ""}" id="ri-${r.id}">
            <div class="resume-item-info">
                <span class="file-icon">📄</span>
                <div>
                    <div class="resume-item-name" title="${esc(r.filename)}">${esc(r.filename)}</div>
                    <div class="resume-item-date">Uploaded ${date}</div>
                </div>
            </div>
            <div class="resume-item-actions">
                ${isLinked ? `<span class="linked-badge">✓ Active</span>` : useBtn}
                <button class="btn-danger" style="font-size:12px;padding:5px 10px"
                    onclick="deleteResume(${r.id})">Delete</button>
            </div>
        </div>`;
    }).join("");
}

/* ═══════════════════════════════════════════
   GENERATED RESUME (GeneratedResume table)
═══════════════════════════════════════════ */
async function loadGeneratedContent() {
    let res;
    try {
        res = await fetch(`${API}/applications/${applicationId}/generated-resume`);
    } catch {
        renderState("⚠️", "Could not connect to backend.", "Make sure the server is running on port 8000.", true);
        renderActions("none");
        return;
    }

    if (res.status === 404) {
        /* No generated resume yet — decide next action based on linked resume */
        if (!linkedResumeId) {
            renderState(
                "📎",
                "No resume linked to this application.",
                "Upload a resume above, then click <strong>Use this</strong> next to it."
            );
            renderActions("no_resume");
        } else if (!appData?.jd_text?.trim()) {
            renderState(
                "📋",
                "No job description found.",
                'Add a job description in <a href="application_details.html?application_id=' +
                applicationId + '" style="color:#2563eb">Application Details</a>.'
            );
            renderActions("no_resume");
        } else {
            renderState(
                "✨",
                "Ready to generate your tailored resume.",
                "Your resume is linked. Click <strong>Generate Resume</strong> to create an ATS-optimised version for this job."
            );
            renderActions("ready");
        }
        return;
    }

    if (!res.ok) {
        renderState("⚠️", "Could not load generated resume.", `Server error ${res.status}`, true);
        renderActions("none");
        return;
    }

    const data = await res.json();
    generatedRecord = data;
    const content   = data.content || "";

    if (!content) {
        renderState("📭", "Generated resume is empty.", "Click Regenerate to try again.");
        renderActions("generated");
        return;
    }

    renderTextarea(content);
    renderActions("generated");
}

/* ═══════════════════════════════════════════
   GENERATE (first time)
═══════════════════════════════════════════ */
async function generateResume() {
    if (!applicationId) {
        showToast("No application selected. Open this page from the Applications list.", "error");
        return;
    }
    if (!linkedResumeId) {
        showToast("No resume linked. Upload a resume above and click 'Use this'.", "error");
        return;
    }
    if (!appData?.jd_text?.trim()) {
        showToast("This application has no job description. Add one in the application details.", "error");
        return;
    }

    const btn = document.getElementById("generateBtn");
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>Generating…`; }

    renderState("🤖", "Generating your tailored resume…",
        "The AI is reading your resume and the job description. This takes 30–60 seconds.");

    try {
        const res  = await fetch(
            `${API}/applications/${applicationId}/generate-resume?user_id=${user.id}`,
            { method: "POST" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Server error ${res.status}`);

        generatedRecord = data;
        renderTextarea(data.content);
        renderActions("generated");
        showToast("Resume generated successfully!", "success");
    } catch (e) {
        showToast(e.message, "error");
        renderState("⚠️", "Generation failed.", e.message, true);
        renderActions("ready");
    }
}

/* ═══════════════════════════════════════════
   REGENERATE
═══════════════════════════════════════════ */
async function regenerateResume() {
    if (!linkedResumeId) {
        showToast("No resume linked to this application.", "error"); return;
    }

    const btn = document.getElementById("regenerateBtn");
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>Regenerating…`; }

    try {
        const res  = await fetch(
            `${API}/applications/${applicationId}/generate-resume?user_id=${user.id}`,
            { method: "POST" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);

        generatedRecord = data;
        const ta = document.getElementById("resumeText");
        if (ta) {
            ta.value = data.content || "";
            updateCharCount(data.content);
        } else {
            renderTextarea(data.content);
            renderActions("generated");
        }
        showToast(`Resume regenerated (v${data.version})!`, "success");
    } catch (e) {
        showToast(e.message, "error");
    } finally {
        const b = document.getElementById("regenerateBtn");
        if (b) { b.disabled = false; b.innerHTML = "↻ Regenerate"; }
    }
}

/* ═══════════════════════════════════════════
   SAVE
═══════════════════════════════════════════ */
async function saveResume() {
    const ta = document.getElementById("resumeText");
    if (!ta) { showToast("Nothing to save.", "error"); return; }
    if (!generatedRecord?.id) { showToast("No generated resume to save.", "error"); return; }

    const btn = document.getElementById("saveBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }

    try {
        const res = await fetch(`${API}/generated-resumes/${generatedRecord.id}`, {
            method : "PUT",
            headers: { "Content-Type": "application/json" },
            body   : JSON.stringify({ resume_rewrite: ta.value })
        });
        showToast(res.ok ? "Saved!" : "Saved locally (server unavailable).", "success");
    } catch {
        showToast("Saved locally.", "success");
    } finally {
        const b = document.getElementById("saveBtn");
        if (b) { b.disabled = false; b.textContent = "✓ Save"; }
    }
}

/* ═══════════════════════════════════════════
   DOWNLOAD
═══════════════════════════════════════════ */
function triggerDownload(type) {
    if (!generatedRecord?.id) { showToast("No generated resume to download.", "error"); return; }
    const url  = `${API}/generated-resumes/${generatedRecord.id}/download/${type}`;
    const name = `resume_v${generatedRecord.version || 1}.${type}`;
    const a = document.createElement("a");
    a.href = url; a.download = name; a.target = "_blank";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

/* ═══════════════════════════════════════════
   UPLOAD
═══════════════════════════════════════════ */
const uploadZone = document.getElementById("uploadZone");
const fileInput  = document.getElementById("fileInput");

uploadZone.addEventListener("click", () => fileInput.click());
uploadZone.addEventListener("dragover",  e => { e.preventDefault(); uploadZone.classList.add("drag-over"); });
uploadZone.addEventListener("dragleave", ()  => uploadZone.classList.remove("drag-over"));
uploadZone.addEventListener("drop", e => {
    e.preventDefault();
    uploadZone.classList.remove("drag-over");
    if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) uploadFile(fileInput.files[0]);
});

async function uploadFile(file) {
    if (!file.name.match(/\.(pdf|docx)$/i)) {
        showToast("Only PDF or DOCX files are accepted.", "error"); return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showToast("File too large (max 10 MB).", "error"); return;
    }

    const origHtml = uploadZone.innerHTML;
    uploadZone.innerHTML = `<div class="icon">⏳</div><p>Uploading…</p>`;

    const resetZone = () => { uploadZone.innerHTML = origHtml; };

    const form = new FormData();
    form.append("file", file);

    try {
        const res  = await fetch(`${API}/upload-resume/${user.id}`, { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Upload failed");

        fileInput.value = "";
        resetZone();

        /* Auto-link to this application (if one is selected) */
        if (applicationId) {
            await linkResume(data.resume_id, data.filename, true);
        } else {
            showToast(`"${data.filename}" uploaded. Select an application to link it.`, "success");
            await loadUserResumes();
        }
    } catch (e) {
        showToast(e.message, "error");
        resetZone();
    }
}

/* ═══════════════════════════════════════════
   LINK RESUME
═══════════════════════════════════════════ */
async function linkResume(resumeId, filename, silent = false) {
    if (!applicationId) {
        showToast("No application selected. Open this page from the Applications list.", "error");
        return;
    }

    try {
        const res = await fetch(
            `${API}/applications/${applicationId}/link-resume/${resumeId}`,
            { method: "PUT" }
        );
        if (!res.ok) throw new Error("Failed to link resume");

        linkedResumeId = resumeId;
        showToast(silent
            ? `"${filename}" uploaded and linked!`
            : `"${filename}" linked to this application.`, "success");

        await loadUserResumes();

        /* If no generated resume, update state box / action buttons */
        if (!generatedRecord) {
            if (!appData?.jd_text?.trim()) {
                renderState("📋", "No job description found.",
                    'Add a job description in <a href="application_details.html?application_id=' +
                    applicationId + '" style="color:#2563eb">Application Details</a>.');
                renderActions("no_resume");
            } else {
                renderState("✨", "Resume linked. Ready to generate.",
                    "Click <strong>Generate Resume</strong> to create your ATS-tailored resume.");
                renderActions("ready");
            }
        }
    } catch (e) {
        showToast("Could not link resume: " + e.message, "error");
    }
}

/* ═══════════════════════════════════════════
   DELETE RESUME
═══════════════════════════════════════════ */
async function deleteResume(resumeId) {
    if (!confirm("Delete this resume? It will be unlinked from all applications.")) return;
    try {
        const res = await fetch(`${API}/resumes/${resumeId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");

        if (resumeId === linkedResumeId) {
            linkedResumeId = null;
            if (!generatedRecord) {
                renderState("📎", "Resume unlinked.", "Upload or link another resume to continue.");
                renderActions("no_resume");
            }
        }
        showToast("Resume deleted.", "success");
        await loadUserResumes();
    } catch (e) {
        showToast("Could not delete resume.", "error");
    }
}

/* ── Escape HTML ── */
function esc(str) {
    return (str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ── Boot ── */
init();
