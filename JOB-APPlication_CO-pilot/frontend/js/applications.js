const API = "https://job-application-co-pilot-1.onrender.com";

// ── Auth guard ──
const user  = JSON.parse(localStorage.getItem("user") || "null");
const token = localStorage.getItem("token");
if (!user || !token) { location.href = "index.html"; }

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    location.href = "index.html";
});

// ── Toast ──
function showToast(msg, type = "success") {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = `toast show ${type}`;
    setTimeout(() => { t.className = "toast"; }, 3200);
}

// ── Status badge label ──
const STATUS_LABELS = {
    not_applied : "Not Applied",
    applied     : "Applied",
    interview   : "Interview",
    offer       : "Offer",
    rejected    : "Rejected"
};

// ── Load & render table ──
async function loadApplications() {
    const tbody = document.getElementById("applicationTable");
    try {
        const res  = await fetch(`${API}/applications?user_id=${user.id}`);
        const apps = await res.json();

        if (!apps.length) {
            tbody.innerHTML = `
                <tr><td colspan="7">
                    <div class="empty-state">
                        <div class="icon">📋</div>
                        <p>No applications yet. Click <strong>+ New Application</strong> to get started.</p>
                    </div>
                </td></tr>`;
            return;
        }

        tbody.innerHTML = apps.map((app, i) => {
            const status = app.status || "not_applied";
            const resumeCell = app.resume_id
                ? `<span class="resume-chip">✓ Uploaded</span>`
                : `<span class="no-resume-chip">No Resume</span>`;

            return `<tr>
                <td>${i + 1}</td>
                <td><strong>${esc(app.job_title)}</strong></td>
                <td>${esc(app.company)}</td>
                <td>${esc(app.location || "—")}</td>
                <td><span class="status-badge ${status}">${STATUS_LABELS[status] || status}</span></td>
                <td>${resumeCell}</td>
                <td>
                    <a class="action-link" href="application_details.html?application_id=${app.id}"
                        style="color:#2563eb;font-weight:700;">Open ↗</a>
                    <a class="action-link" href="cover-letter.html?application_id=${app.id}">Cover Letter</a>
                    <a class="action-link" href="interview.html?application_id=${app.id}">Interview</a>
                </td>
            </tr>`;
        }).join("");
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:#ef4444;text-align:center;padding:32px;">
            Failed to load applications. Is the backend running?</td></tr>`;
    }
}

function esc(str) {
    if (!str) return "";
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── Drawer open / close ──
const overlay      = document.getElementById("drawerOverlay");
const drawerClose  = document.getElementById("drawerClose");
const drawerCancel = document.getElementById("drawerCancel");

function openDrawer()  { overlay.classList.add("open"); }
function closeDrawer() { overlay.classList.remove("open"); clearForm(); }

document.getElementById("newAppBtn").addEventListener("click", openDrawer);
drawerClose.addEventListener("click", closeDrawer);
drawerCancel.addEventListener("click", closeDrawer);
overlay.addEventListener("click", e => { if (e.target === overlay) closeDrawer(); });
document.addEventListener("keydown", e => {
    if (e.key === "Escape" && overlay.classList.contains("open")) closeDrawer();
});

function clearForm() {
    ["f-company","f-title","f-location","f-url","f-jd","f-notes"].forEach(id => {
        document.getElementById(id).value = "";
    });
    document.getElementById("f-status").value = "not_applied";
    ["err-company","err-title","err-jd"].forEach(id => {
        document.getElementById(id).textContent = "";
    });
}

// ── Form validation & submit ──
function setErr(id, msg) { document.getElementById(id).textContent = msg; }

async function saveApplication() {
    const company  = document.getElementById("f-company").value.trim();
    const title    = document.getElementById("f-title").value.trim();
    const jd       = document.getElementById("f-jd").value.trim();
    const location = document.getElementById("f-location").value.trim();
    const job_url  = document.getElementById("f-url").value.trim();
    const status   = document.getElementById("f-status").value;
    const notes    = document.getElementById("f-notes").value.trim();

    let valid = true;
    setErr("err-company", ""); setErr("err-title", ""); setErr("err-jd", "");

    if (!company) { setErr("err-company", "Company name is required."); valid = false; }
    if (!title)   { setErr("err-title",   "Job title is required.");    valid = false; }
    if (!jd)      { setErr("err-jd",      "Job description is required."); valid = false; }
    if (!valid) return;

    const btn = document.getElementById("saveAppBtn");
    btn.disabled = true;
    btn.textContent = "Saving…";

    try {
        const res = await fetch(`${API}/applications`, {
            method : "POST",
            headers: { "Content-Type": "application/json" },
            body   : JSON.stringify({
                user_id  : user.id,
                company,
                job_title: title,
                jd_text  : jd,
                location : location || null,
                job_url  : job_url  || null,
                status,
                notes    : notes    || null
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Server error ${res.status}`);
        }

        const data = await res.json();
        closeDrawer();
        showToast("Application saved! Redirecting…", "success");
        // Go straight to the details page so the user can link a resume + generate
        setTimeout(() => {
            location.href = `application_details.html?application_id=${data.id}`;
        }, 800);

    } catch (e) {
        showToast(e.message || "Failed to save application.", "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "Save Application";
    }
}

document.getElementById("saveAppBtn").addEventListener("click", saveApplication);

// ── Init ──
loadApplications();
