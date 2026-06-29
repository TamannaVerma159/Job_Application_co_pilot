const form = document.getElementById("loginForm");

form.addEventListener("submit", async function (e) {

    e.preventDefault();

    const email = document.getElementById("email").value;

    const password = document.getElementById("password").value;

    const message = document.getElementById("message");

    message.innerText = "";

    try {

        const response = await fetch(
            "http://127.0.0.1:8000/login",
            {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    email: email,

                    password: password

                })

            }
        );

        const data = await response.json();

        if (response.ok) {

            localStorage.setItem(
                "token",
                data.access_token
            );

            localStorage.setItem(
                "user",
                JSON.stringify(data.user)
            );

            window.location.href =
                "dashboard.html";

        } else {

            message.innerText =
                data.detail;

        }

    } catch (error) {

        message.innerText =
            "Server not running";

    }

});