const params = new URLSearchParams(window.location.search);

const applicationId = params.get("id");

async function loadApplication() {

    const response = await fetch(

        `http://127.0.0.1:8000/applications/${applicationId}`

    );

    const data = await response.json();

    document.getElementById("details").innerHTML = `

        <p><strong>Company:</strong> ${data.company}</p>

        <p><strong>Role:</strong> ${data.job_title}</p>

        <p><strong>Status:</strong> ${data.status}</p>

    `;

}

document
.getElementById("generateBtn")
.addEventListener("click", async () => {

    const response = await fetch(`http://127.0.0.1:8000/applications/${applicationId}/generate`,

        {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                application_id: applicationId

            })

        }

    );

    const data = await response.json();

    window.location.href =
        `generated_result.html?draft=${data.draft_id}`;

});

loadApplication();