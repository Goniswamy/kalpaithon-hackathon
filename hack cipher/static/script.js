async function generatePlan() {
    const btn = document.getElementById("btn");
    const resultBox = document.getElementById("result");

    const payload = {
        location: document.getElementById("destination").value,
        days: document.getElementById("days").value,
        budget: document.getElementById("budget").value,
        style: document.getElementById("style").value,
        interest: document.getElementById("interests").value,
        start: document.getElementById("start").value
    };

    if (!payload.location || !payload.days || !payload.budget) {
        alert("Fill Destination, Days, Budget");
        return;
    }

    btn.disabled = true;
    btn.innerText = "⏳ Planning...";

    resultBox.style.display = "block";
    resultBox.innerText = "Generating your travel plan...";

    try {
        const res = await fetch("/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        resultBox.innerHTML = data.reply.replace(/\n/g, "<br>");

    } catch (err) {
        resultBox.innerText = "Error: Backend not responding";
    }

    btn.disabled = false;
    btn.innerText = "✨ Generate Plan";
}
