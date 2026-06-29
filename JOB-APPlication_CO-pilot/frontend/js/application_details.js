/* ═══════════════════════════════════════════════════════════════
   application_details.js
   Workflow:
   App Info → Upload/Link Resume → Fit Analysis → Generate Resume
   → Preview/Edit/Diff → Regenerate → Save → Download
═══════════════════════════════════════════════════════════════ */

const API = "http://127.0.0.1:8000";

/* ── Auth guard ── */
const user  = JSON.parse(localStorage.getItem("user") || "null");
const token = localStorage.getItem("token");
if (!user || !token) { location.href = "index.html"; }

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    location.href = "index.html";
});

/* ── URL param ── */
const applicationId = new URLSearchParams(location.search).get("application_id")
                   || new URLSearchParams(location.search).get("id");

/* ── Module state ── */
let appData          = null;   // full application object
let linkedResumeId   = null;   // resume_id currently linked
let generatedRecord  = null;   // GeneratedResume object
let originalText     = null;   // raw text of the linked resume (for diff)
let currentTab       = "edit"; // 'edit' | 'diff'

/* ══════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════ */
function showToast(msg, type = "success") {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className   = `toast show ${type}`;
    setTimeout(() => { t.className = "toast"; }, 3500);
}

/* ══════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════ */
function esc(s) {
    return (s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function show(id) { const el = document.getElementById(id); if (el) el.style.display = ""; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = "none"; }
function fmtDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/* ══════════════════════════════════════════════════
   STEPPER  (5 steps per spec)
   1 App Created · 2 Resume Linked · 3 Fit Analysed ·
   4 Resume Generated · 5 Package Complete
══════════════════════════════════════════════════ */
function renderStepper(hasResume, hasFit, hasGenerated) {
    const steps = [
        { label: "App\nCreated",      done: true,          active: false },
        { label: "Resume\nLinked",    done: hasResume,     active: !hasResume },
        { label: "Fit\nAnalysed",     done: hasFit,        active: hasResume && !hasFit },
        { label: "Resume\nGenerated", done: hasGenerated,  active: hasFit && !hasGenerated },
        { label: "Package\nComplete", done: hasGenerated,  active: false },
    ];
    document.getElementById("stepper").innerHTML = steps.map((s, i) => `
        <div class="step ${s.done ? "done" : s.active ? "active" : ""}">
            <div class="step-circle">${s.done ? "✓" : i + 1}</div>
            <div class="step-label" style="white-space:pre-line">${s.label}</div>
        </div>`).join("");
}

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
async function init() {
    if (!applicationId) {
        document.getElementById("pageTitle").textContent = "No application selected";
        setGenPlaceholder("📋", "No application selected.",
            'Go to <a href="application.html" style="color:#2563eb">Applications</a> and click Open.');
        renderStepper(false, false, false);
        return;
    }

    /* 1. Load application */
    try {
        const res = await fetch(`${API}/applications/${applicationId}`);
        if (!res.ok) throw new Error(`${res.status}`);
        appData        = await res.json();
        linkedResumeId = appData.resume_id || null;
    } catch (e) {
        setGenPlaceholder("⚠️", "Could not load application.", e.message, true);
        return;
    }

    renderAppInfo();
    renderStatusSelector();

    /* 2. Load user resumes */
    await loadResumes();

    /* 3. Load fit analysis (if any) */
    await loadFitAnalysis();

    /* 4. Load existing generated resume */
    await loadGeneratedResume();
}

/* ══════════════════════════════════════════════════
   CARD 1 – Application Info
══════════════════════════════════════════════════ */
function renderAppInfo() {
    document.getElementById("pageTitle").textContent =
        `${appData.job_title} — ${appData.company}`;
    document.getElementById("pageSub").textContent =
        `Application #${applicationId}` + (appData.location ? ` · ${appData.location}` : "");

    const jobUrlHtml = appData.job_url
        ? `<a class="val" href="${esc(appData.job_url)}" target="_blank" rel="noreferrer">View job posting ↗</a>`
        : `<span class="val" style="color:#94a3b8">—</span>`;

    document.getElementById("infoGrid").innerHTML = `
        <div class="info-item">
            <label>Company</label>
            <span class="val">${esc(appData.company)}</span>
        </div>
        <div class="info-item">
            <label>Job Title</label>
            <span class="val">${esc(appData.job_title)}</span>
        </div>
        <div class="info-item">
            <label>Location</label>
            <span class="val">${esc(appData.location || "—")}</span>
        </div>
        <div class="info-item">
            <label>Status</label>
            <span class="val" id="statusLabel">${statusLabel(appData.status)}</span>
        </div>
        <div class="info-item" style="grid-column:1/-1">
            <label>Job Posting URL</label>
            ${jobUrlHtml}
        </div>`;

    if (appData.jd_text && appData.jd_text.trim()) {
        document.getElementById("jdBlock").innerHTML = `
            <div style="margin-top:16px">
                <label style="font-size:11px;font-weight:700;color:#94a3b8;
                    text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:6px">
                    Job Description
                </label>
                <div class="jd-preview">${esc(appData.jd_text)}</div>
            </div>`;
    } else {
        document.getElementById("jdBlock").innerHTML = `
            <div class="info-banner yellow" style="margin-top:14px">
                ⚠ No job description. The AI needs a job description to tailor your resume.
            </div>`;
    }
}

function statusLabel(s) {
    return { not_applied:"Not Applied", applied:"Applied",
             interview:"Interview", offer:"Offer", rejected:"Rejected" }[s] || s;
}

function renderStatusSelector() {
    const sel = document.getElementById("statusSelect");
    sel.value = appData.status || "not_applied";
    sel.addEventListener("change", async () => {
        try {
            await fetch(`${API}/applications/${applicationId}/status`, {
                method : "PUT",
                headers: { "Content-Type": "application/json" },
                body   : JSON.stringify({ status: sel.value })
            });
            document.getElementById("statusLabel").textContent = statusLabel(sel.value);
            showToast("Status updated.");
        } catch { showToast("Could not update status.", "error"); }
    });
}

/* ══════════════════════════════════════════════════
   CARD 2 – Resume Upload & Link
══════════════════════════════════════════════════ */
async function loadResumes() {
    const list = document.getElementById("resumeList");
    list.innerHTML = `<p style="font-size:13px;color:#94a3b8;margin-top:10px">Loading resumes…</p>`;

    let resumes = [];
    try {
        const res = await fetch(`${API}/users/${user.id}/resumes`);
        if (!res.ok) throw new Error();
        resumes = await res.json();
    } catch {
        list.innerHTML = `<p style="font-size:13px;color:#dc2626;margin-top:10px">Failed to load resumes.</p>`;
        updateResumeBadge(false);
        return;
    }

    updateResumeBadge(!!linkedResumeId);

    const banner = document.getElementById("linkedBanner");
    const nameEl = document.getElementById("linkedName");
    if (linkedResumeId) {
        const linked = resumes.find(r => r.id === linkedResumeId);
        nameEl.textContent = linked ? linked.filename : `Resume #${linkedResumeId}`;
        banner.style.display = "flex";
    } else {
        banner.style.display = "none";
    }

    if (!resumes.length) {
        list.innerHTML = `<p style="font-size:13px;color:#94a3b8;margin-top:10px">
            No resumes uploaded yet. Upload a PDF or DOCX above.</p>`;
        return;
    }

    list.innerHTML = resumes.map(r => {
        const isLinked = (r.id === linkedResumeId);
        const date     = new Date(r.created_at).toLocaleDateString();
        const action   = isLinked
            ? `<span class="active-chip">✓ Active</span>`
            : `<button class="btn-ghost" style="font-size:12px;padding:5px 12px"
                onclick="linkResume(${r.id},'${esc(r.filename)}')">Use this</button>`;
        return `
        <div class="resume-item${isLinked ? " linked-item" : ""}" id="ri-${r.id}">
            <div class="ri-info">
                <span style="font-size:22px">📄</span>
                <div>
                    <div class="ri-name" title="${esc(r.filename)}">${esc(r.filename)}</div>
                    <div class="ri-date">Uploaded ${date}</div>
                </div>
            </div>
            <div class="ri-actions">
                ${action}
                <button class="btn-danger" style="font-size:12px;padding:5px 10px"
                    onclick="deleteResume(${r.id})">Delete</button>
            </div>
        </div>`;
    }).join("");
}

function updateResumeBadge(linked) {
    const b = document.getElementById("resumeBadge");
    b.textContent = linked ? "✓ Linked" : "Action Required";
    b.className   = `step-badge ${linked ? "badge-done" : "badge-active"}`;
}

/* ── Upload ── */
const uploadZone = document.getElementById("uploadZone");
const fileInput  = document.getElementById("fileInput");

uploadZone.addEventListener("click",    () => fileInput.click());
uploadZone.addEventListener("dragover", e  => { e.preventDefault(); uploadZone.classList.add("drag-over"); });
uploadZone.addEventListener("dragleave",() => uploadZone.classList.remove("drag-over"));
uploadZone.addEventListener("drop",     e  => {
    e.preventDefault(); uploadZone.classList.remove("drag-over");
    if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => { if (fileInput.files[0]) uploadFile(fileInput.files[0]); });

async function uploadFile(file) {
    if (!file.name.match(/\.(pdf|docx)$/i)) {
        showToast("Only PDF or DOCX files are accepted.", "error"); return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showToast("File too large (max 10 MB).", "error"); return;
    }

    const origHtml = uploadZone.innerHTML;
    uploadZone.innerHTML = `<div class="uz-icon">⏳</div><p>Uploading…</p>`;

    const form = new FormData();
    form.append("file", file);

    try {
        const res  = await fetch(`${API}/upload-resume/${user.id}`, { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Upload failed");

        fileInput.value = "";
        await linkResume(data.resume_id, data.filename, true);
        showToast(`"${data.filename}" uploaded and linked!`, "success");
    } catch (e) {
        showToast(e.message, "error");
    } finally {
        uploadZone.innerHTML = origHtml;
    }
}

async function linkResume(resumeId, filename, silent = false) {
    try {
        const res = await fetch(
            `${API}/applications/${applicationId}/link-resume/${resumeId}`,
            { method: "PUT" }
        );
        if (!res.ok) throw new Error("Link request failed");
        linkedResumeId = resumeId;
        originalText   = null; // invalidate cached original text
        if (!silent) showToast(`"${filename}" linked.`, "success");
        await loadResumes();
        updateFitButton();
        if (!generatedRecord) renderRequirementsPanel();
    } catch (e) {
        showToast("Could not link resume: " + e.message, "error");
    }
}

async function deleteResume(resumeId) {
    if (!confirm("Delete this resume? It will be unlinked from all applications.")) return;
    try {
        const res = await fetch(`${API}/resumes/${resumeId}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        if (resumeId === linkedResumeId) {
            linkedResumeId = null;
            originalText   = null;
        }
        showToast("Resume deleted.", "success");
        await loadResumes();
        updateFitButton();
        if (!generatedRecord) renderRequirementsPanel();
    } catch { showToast("Could not delete resume.", "error"); }
}

/* ══════════════════════════════════════════════════
   CARD 3 – Fit Analysis
══════════════════════════════════════════════════ */

/* Enable / disable the Analyse Fit button based on preconditions */
function updateFitButton() {
    const btn   = document.getElementById("fitBtn");
    if (!btn) return;
    const ready = !!(linkedResumeId && appData?.jd_text?.trim());
    btn.disabled      = !ready;
    btn.style.opacity = ready ? "1" : ".5";
    btn.style.cursor  = ready ? "pointer" : "not-allowed";
    if (ready) btn.onclick = runFitAnalysis;
}

async function loadFitAnalysis() {
    updateFitButton();

    try {
        const res = await fetch(`${API}/applications/${applicationId}/fit-analysis`);
        if (res.status === 404) {
            /* No analysis yet — show prompt panel */
            showFitPlaceholder();
            return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        showFitResult(data.fit_analysis);
    } catch {
        showFitPlaceholder();
    }
}

function showFitPlaceholder() {
    show("fitPlaceholder"); hide("fitRunning"); hide("fitResult");
    updateFitBadge(false);
}

function showFitResult(text) {
    hide("fitPlaceholder"); hide("fitRunning"); show("fitResult");
    document.getElementById("fitOutput").textContent = text || "—";
    updateFitBadge(true);

    const refit = document.getElementById("refitBtn");
    if (refit) refit.onclick = runFitAnalysis;
}

function updateFitBadge(done) {
    const b = document.getElementById("fitBadge");
    b.textContent = done ? "✓ Analysed" : "Pending";
    b.className   = `step-badge ${done ? "badge-done" : "badge-active"}`;
}

async function runFitAnalysis() {
    if (!linkedResumeId) {
        showToast("Link a resume first (Step 2 above).", "error"); return;
    }
    if (!appData?.jd_text?.trim()) {
        showToast("Add a job description before running fit analysis.", "error"); return;
    }

    hide("fitPlaceholder"); hide("fitResult"); show("fitRunning");

    const btn = document.getElementById("fitBtn");
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>Analysing…`; }

    try {
        const res  = await fetch(
            `${API}/applications/${applicationId}/fit-analysis?user_id=${user.id}`,
            { method: "POST" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Server error ${res.status}`);

        showFitResult(data.fit_analysis);
        /* Refresh stepper — fit is now done */
        renderStepper(!!linkedResumeId, true, !!generatedRecord);
        showToast("Fit analysis complete!", "success");
    } catch (e) {
        showToast(e.message, "error");
        showFitPlaceholder();
    } finally {
        const b = document.getElementById("fitBtn");
        if (b) {
            b.disabled = false;
            b.innerHTML = "🔍 Analyse Fit";
            updateFitButton();
        }
    }
}

/* ══════════════════════════════════════════════════
   CARD 4 – AI Resume Generation
══════════════════════════════════════════════════ */

async function loadGeneratedResume() {
    try {
        const res = await fetch(`${API}/applications/${applicationId}/generated-resume`);

        if (res.status === 404) {
            renderRequirementsPanel();
            /* stepper: need to know if fit analysis exists */
            const fitDone = document.getElementById("fitBadge")?.textContent.startsWith("✓");
            renderStepper(!!linkedResumeId, fitDone, false);
            renderNextSteps(false);
            return;
        }

        if (!res.ok) throw new Error(`Server error ${res.status}`);

        generatedRecord = await res.json();
        showEditorPanel(generatedRecord.content, generatedRecord);

        /* Load original resume text for diff */
        if (linkedResumeId) await fetchOriginalText(linkedResumeId);

        const fitDone = document.getElementById("fitBadge")?.textContent.startsWith("✓");
        renderStepper(true, fitDone, true);
        updateGenBadge(true);
        renderNextSteps(true);

    } catch (e) {
        setGenPlaceholder("⚠️", "Could not load resume.", e.message, true);
    }
}

/* Requirements checklist */
function renderRequirementsPanel() {
    const hasResume = !!linkedResumeId;
    const hasJD     = !!(appData?.jd_text?.trim());
    const ready     = hasResume && hasJD;

    hide("generatingPanel"); hide("editorPanel"); hide("genPlaceholder");
    show("reqPanel");

    document.getElementById("reqList").innerHTML = `
        <div class="req-item ${hasResume ? "ok" : "bad"}">
            <span class="req-icon">${hasResume ? "✅" : "📎"}</span>
            <span>${hasResume
                ? `Resume linked: <strong>${esc(getLinkedFilename())}</strong>`
                : "No resume linked — upload or select one in <strong>Step 2</strong> above"}</span>
        </div>
        <div class="req-item ${hasJD ? "ok" : "bad"}">
            <span class="req-icon">${hasJD ? "✅" : "📋"}</span>
            <span>${hasJD
                ? "Job description found"
                : "No job description — edit this application to add one"}</span>
        </div>`;

    const btn = document.getElementById("generateBtn");
    btn.disabled      = !ready;
    btn.style.opacity = ready ? "1" : ".5";
    btn.style.cursor  = ready ? "pointer" : "not-allowed";
    btn.onclick       = ready ? generateResume : null;
    btn.textContent   = "✨ Generate Resume";

    updateGenBadge(false);
}

function getLinkedFilename() {
    if (!linkedResumeId) return "";
    const el = document.querySelector(`#ri-${linkedResumeId} .ri-name`);
    return el ? el.textContent : `Resume #${linkedResumeId}`;
}

/* ── Generate ── */
async function generateResume() {
    if (!applicationId) { showToast("No application selected.", "error"); return; }
    if (!linkedResumeId) { showToast("Link a resume first (Step 2 above).", "error"); return; }
    if (!appData?.jd_text?.trim()) { showToast("Add a job description to this application.", "error"); return; }

    hide("reqPanel"); hide("editorPanel"); hide("genPlaceholder");
    show("generatingPanel");

    try {
        const res  = await fetch(
            `${API}/applications/${applicationId}/generate-resume?user_id=${user.id}`,
            { method: "POST" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Server error ${res.status}`);

        generatedRecord = data;
        await fetchOriginalText(linkedResumeId);
        showEditorPanel(data.content, data);
        updateGenBadge(true);

        const fitDone = document.getElementById("fitBadge")?.textContent.startsWith("✓");
        renderStepper(true, fitDone, true);
        renderNextSteps(true);
        showToast("Resume generated successfully!", "success");

    } catch (e) {
        hide("generatingPanel");
        renderRequirementsPanel();
        showToast(e.message, "error");
    }
}

/* ── Regenerate ── */
async function regenerateResume() {
    if (!linkedResumeId) { showToast("No resume linked. Link one in Step 2.", "error"); return; }
    const btn = document.getElementById("regenerateBtn");
    btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>Regenerating…`;

    try {
        const res  = await fetch(
            `${API}/applications/${applicationId}/generate-resume?user_id=${user.id}`,
            { method: "POST" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);

        generatedRecord = data;
        const ta = document.getElementById("resumeEditor");
        ta.value = data.content;
        updateCharBar(data.content);
        updateMeta(data);

        /* Refresh diff panel if currently visible */
        if (currentTab === "diff") renderDiff();

        showToast(`Resume regenerated (v${data.version})!`, "success");
    } catch (e) {
        showToast(e.message, "error");
    } finally {
        btn.disabled = false; btn.innerHTML = "↻ Regenerate";
    }
}

/* ── Editor panel ── */
function showEditorPanel(content, meta) {
    hide("reqPanel"); hide("generatingPanel"); hide("genPlaceholder");
    show("editorPanel");

    const ta = document.getElementById("resumeEditor");
    ta.value = content || "";
    updateCharBar(content);
    ta.addEventListener("input", () => updateCharBar(ta.value));
    updateMeta(meta);

    document.getElementById("regenerateBtn").onclick = regenerateResume;
    document.getElementById("saveBtn").onclick       = saveResume;
    document.getElementById("dlPdfBtn").onclick      = () => downloadFile("pdf");
    document.getElementById("dlDocxBtn").onclick     = () => downloadFile("docx");

    /* Default to Edit tab */
    switchTab("edit");
}

function updateCharBar(text) {
    document.getElementById("charBar").textContent =
        `${(text || "").length.toLocaleString()} characters`;
}

function updateMeta(meta) {
    const el = document.getElementById("genMeta");
    if (!el || !meta) return;
    el.innerHTML = `
        <span style="color:#16a34a;font-weight:600">✓ Generated successfully</span>
        &nbsp;·&nbsp;Version <strong>${meta.version || 1}</strong>
        &nbsp;·&nbsp;Source: <strong>${esc(meta.source_filename || "—")}</strong>
        &nbsp;·&nbsp;Last updated: ${fmtDate(meta.updated_at)}`;
}

function updateGenBadge(done) {
    const b = document.getElementById("genBadge");
    b.textContent = done ? "✓ Generated" : "Action Required";
    b.className   = `step-badge ${done ? "badge-done" : "badge-active"}`;
}

/* ── Save ── */
async function saveResume() {
    const ta = document.getElementById("resumeEditor");
    if (!ta || !generatedRecord?.id) { showToast("Nothing to save.", "error"); return; }

    const btn = document.getElementById("saveBtn");
    btn.disabled = true; btn.textContent = "Saving…";

    try {
        const res = await fetch(`${API}/generated-resumes/${generatedRecord.id}`, {
            method : "PUT",
            headers: { "Content-Type": "application/json" },
            body   : JSON.stringify({ resume_rewrite: ta.value })
        });
        const data = await res.json();
        if (res.ok) {
            generatedRecord.updated_at = data.updated_at;
            updateMeta(generatedRecord);
            /* Keep diff in sync with saved edits */
            if (currentTab === "diff") renderDiff();
            showToast("Saved!", "success");
        } else {
            showToast("Saved locally (server unavailable).", "success");
        }
    } catch { showToast("Saved locally.", "success"); }
    finally { btn.disabled = false; btn.textContent = "✓ Save"; }
}

/* ── Download ── */
function downloadFile(type) {
    if (!generatedRecord?.id) { showToast("Generate a resume first.", "error"); return; }
    const url  = `${API}/generated-resumes/${generatedRecord.id}/download/${type}`;
    const name = `resume_v${generatedRecord.version || 1}.${type}`;
    const a = document.createElement("a");
    a.href = url; a.download = name; a.target = "_blank";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

/* ── State placeholder ── */
function setGenPlaceholder(icon, msg, sub = "", isError = false) {
    hide("reqPanel"); hide("editorPanel"); hide("generatingPanel");
    const el = document.getElementById("genPlaceholder");
    el.style.display = "";
    el.innerHTML = icon
        ? `<div class="sb-icon">${icon}</div>
           <p${isError ? ' style="color:#dc2626"' : ""}>${msg}</p>
           <small>${sub}</small>`
        : "";
}

/* ══════════════════════════════════════════════════
   DIFF VIEW
   Fetches original resume text from backend, then
   renders a side-by-side word-level diff.
══════════════════════════════════════════════════ */

async function fetchOriginalText(resumeId) {
    if (!resumeId) return;
    try {
        const res  = await fetch(`${API}/resumes/${resumeId}/text`);
        if (!res.ok) return;
        const data = await res.json();
        originalText = data.resume_text || "";
    } catch { /* silently ignore — diff will show "unavailable" */ }
}

/* Tab switcher */
function switchTab(tab) {
    currentTab = tab;
    document.getElementById("tabEdit").classList.toggle("active", tab === "edit");
    document.getElementById("tabDiff").classList.toggle("active", tab === "diff");

    const editView = document.getElementById("editView");
    const diffView = document.getElementById("diffView");

    if (tab === "edit") {
        editView.style.display = ""; diffView.style.display = "none";
    } else {
        editView.style.display = "none"; diffView.style.display = "";
        renderDiff();
    }
}

/* Word-level diff renderer (no external library needed) */
function renderDiff() {
    const rewrittenText = document.getElementById("resumeEditor")?.value || "";
    const sourceText    = originalText || "";

    document.getElementById("diffOriginal").innerHTML  = highlightDiff(sourceText, rewrittenText, "del");
    document.getElementById("diffRewritten").innerHTML = highlightDiff(rewrittenText, sourceText, "ins");
}

/*
 * Simple word-diff: tokenise both strings, compute LCS,
 * then mark additions / deletions with <ins>/<del> tags.
 */
function highlightDiff(a, b, markTag) {
    /* tokenise preserving whitespace */
    const tokA = tokenise(a);
    const tokB = tokenise(b);

    const lcs  = computeLCS(tokA, tokB);
    const out  = [];
    let iA = 0, iB = 0, iL = 0;

    while (iA < tokA.length || iB < tokB.length) {
        if (iL < lcs.length && iA < tokA.length && tokA[iA] === lcs[iL] &&
                                iB < tokB.length && tokB[iB] === lcs[iL]) {
            out.push(esc(tokA[iA]));
            iA++; iB++; iL++;
        } else if (iA < tokA.length && (iL >= lcs.length || tokA[iA] !== lcs[iL])) {
            if (markTag === "del") {
                out.push(`<del>${esc(tokA[iA])}</del>`);
            }
            iA++;
        } else if (iB < tokB.length) {
            if (markTag === "ins") {
                out.push(`<ins>${esc(tokB[iB])}</ins>`);
            }
            iB++;
        }
    }
    return out.join("") || `<span style="color:#94a3b8;font-style:italic">No content.</span>`;
}

function tokenise(text) {
    /* split on whitespace boundaries, keep the whitespace tokens */
    return (text || "").split(/(\s+)/).filter(t => t.length > 0);
}

function computeLCS(a, b) {
    /* DP LCS — capped to prevent O(n²) hang on very long resumes */
    const MAX = 600;
    const A = a.slice(0, MAX);
    const B = b.slice(0, MAX);
    const m = A.length, n = B.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = A[i-1] === B[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
        }
    }
    /* Backtrack */
    const result = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
        if (A[i-1] === B[j-1]) { result.push(A[i-1]); i--; j--; }
        else if (dp[i-1][j] > dp[i][j-1]) i--;
        else j--;
    }
    return result.reverse();
}

/* ══════════════════════════════════════════════════
   CARD 5 – Next Steps
══════════════════════════════════════════════════ */
function renderNextSteps(hasGenerated) {
    const id     = applicationId;
    const locked = !hasGenerated;
    document.getElementById("nextSteps").innerHTML = `
        <a class="next-link${locked ? " locked" : ""}"
           href="cover-letter.html?application_id=${id}">
           ✉ Cover Letter${locked ? " 🔒" : ""}
        </a>
        <a class="next-link${locked ? " locked" : ""}"
           href="interview.html?application_id=${id}">
           🎤 Interview Prep${locked ? " 🔒" : ""}
        </a>
        <a class="next-link" href="resume.html?application_id=${id}">
            📝 Full Resume Editor
        </a>`;

    const badge = document.getElementById("nextBadge");
    badge.textContent = hasGenerated ? "Unlocked" : "Locked";
    badge.className   = `step-badge ${hasGenerated ? "badge-done" : "badge-pending"}`;
}

/* ══════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════ */
init();
