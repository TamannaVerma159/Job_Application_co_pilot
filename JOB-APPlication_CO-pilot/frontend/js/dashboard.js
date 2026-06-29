const API = "https://job-application-co-pilot-1.onrender.com";

// Auth guard — redirect to login if no session
const user = JSON.parse(localStorage.getItem("user"));
const token = localStorage.getItem("token");

if (!user || !token) {
    window.location.href = "login.html";
}

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "login.html";
});

// Fetch this user's applications and populate dashboard
async function loadDashboard() {
    try {
        const res = await fetch(`${API}/applications?user_id=${user.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Failed to fetch applications");

        const apps = await res.json();

        // Stat cards
        document.getElementById("totalApplications").textContent = apps.length;
        document.getElementById("generatedResumes").textContent =
            apps.filter(a => a.resume_id).length;
        document.getElementById("generatedCovers").textContent =
            apps.filter(a => a.cover_letter).length;
        document.getElementById("interviewSets").textContent =
            apps.filter(a => a.interview_questions).length;

        // Recent applications table (up to 5)
        const tbody = document.getElementById("recentApplications");
        if (apps.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align:center;color:#888;padding:20px;">
                        No applications yet.
                        <a href="application.html" style="color:#2563eb;">Add one →</a>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = apps.slice(0, 5).map(app => `
            <tr>
                <td>${app.job_title || "—"}</td>
                <td>${app.company || "—"}</td>
                <td>
                    <span class="status-badge status-${(app.status || "").replace(/\s+/g, "_")}">
                        ${app.status || "—"}
                    </span>
                </td>
            </tr>
        `).join("");

    } catch (err) {
        console.error("Dashboard load error:", err);
    }
}

loadDashboard();
