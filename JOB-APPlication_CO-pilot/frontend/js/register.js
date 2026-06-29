const form = document.getElementById("registerForm");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const firstName       = document.getElementById("firstName").value.trim();
    const lastName        = document.getElementById("lastName").value.trim();
    const email           = document.getElementById("email").value.trim();
    const password        = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const message         = document.getElementById("message");

    message.innerText  = "";
    message.className  = "form-message";

    // Client-side guard (inline errors handle the detail, this is a fallback)
    if (!firstName || !lastName) {
        message.innerText = "Please enter your full name.";
        message.className = "form-message error";
        return;
    }

    if (password !== confirmPassword) {
        message.innerText = "Passwords do not match.";
        message.className = "form-message error";
        return;
    }

    const name = `${firstName} ${lastName}`;

    try {
        const response = await fetch("https://job-application-co-pilot-1.onrender.com/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            message.innerText = "Account created! Redirecting to login…";
            message.className = "form-message success";
            setTimeout(() => { window.location.href = "login.html"; }, 1500);
        } else {
            message.innerText = data.detail || "Registration failed. Please try again.";
            message.className = "form-message error";
        }
    } catch {
        message.innerText = "Cannot reach the server. Make sure the backend is running.";
        message.className = "form-message error";
    }
});
