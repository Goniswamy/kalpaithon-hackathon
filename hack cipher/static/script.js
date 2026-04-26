// ── Animated destination strip ────────────────────────────────────
const destinations = [
    { icon: "🏖️", name: "Goa",        tag: "Beach"      },
    { icon: "🏔️", name: "Manali",     tag: "Mountains"  },
    { icon: "🕌", name: "Varanasi",   tag: "Heritage"   },
    { icon: "🌴", name: "Kerala",     tag: "Nature"      },
    { icon: "🐯", name: "Ranthambore",tag: "Wildlife"   },
    { icon: "🏯", name: "Jaipur",     tag: "Culture"    },
    { icon: "🌊", name: "Andaman",    tag: "Islands"    },
    { icon: "🗼", name: "Paris",      tag: "Romance"    },
    { icon: "🗽", name: "New York",   tag: "City"       },
    { icon: "🌸", name: "Tokyo",      tag: "Asia"       },
    { icon: "🏝️", name: "Maldives",   tag: "Luxury"     },
    { icon: "🦁", name: "Kenya",      tag: "Safari"     },
    { icon: "🎭", name: "London",     tag: "Historic"   },
    { icon: "🌅", name: "Santorini",  tag: "Scenic"     },
    { icon: "🏜️", name: "Rajasthan",  tag: "Desert"     },
    { icon: "🎋", name: "Dandeli",    tag: "Adventure"  },
];

function buildStrip() {
    const track = document.getElementById("stripTrack");
    // duplicate for seamless loop
    const all = [...destinations, ...destinations];
    track.innerHTML = all.map(d => `
        <div class="strip-card">
            <div class="strip-icon">${d.icon}</div>
            <div class="strip-name">${d.name}</div>
            <div class="strip-tag">${d.tag}</div>
        </div>
    `).join("");
}

buildStrip();

document.getElementById("budget").addEventListener("input", updateBudget);
document.getElementById("days").addEventListener("input", updateBudget);
document.getElementById("destination").addEventListener("input", updateBudget);
document.getElementById("style").addEventListener("change", updateBudget);

let debounceTimer = null;

async function updateBudget() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {

        const total    = parseInt(document.getElementById("budget").value);
        const days     = parseInt(document.getElementById("days").value) || 1;
        const location = document.getElementById("destination").value.trim();
        const style    = document.getElementById("style").value;
        const start    = document.getElementById("start").value.trim() || "Not specified";
        const box      = document.getElementById("budgetBreakdown");

        if (!total || total <= 0 || location.length < 3) {
            box.innerHTML = "";
            return;
        }

        box.innerHTML = `<span style="opacity:0.5; font-size:12px;">⏳ Calculating split for <b>${location}</b>…</span>`;

        try {
            const res  = await fetch("/budget-preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ location, days, budget: total, style, start })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const { stay, food, transport, activities, misc, location_type } = data;
            box.innerHTML = `
                <div style="font-size:11px; opacity:0.55; margin-bottom:5px;">
                    📍 ${location_type || location} &nbsp;·&nbsp; 📅 ${days} day${days > 1 ? "s" : ""}
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:10px; font-size:12.5px;">
                    <span>🏨 Stay &nbsp;<b style="color:#00c6ff">₹${stay.toLocaleString()}</b></span>
                    <span style="opacity:0.3">|</span>
                    <span>🍜 Food &nbsp;<b style="color:#00c6ff">₹${food.toLocaleString()}</b></span>
                    <span style="opacity:0.3">|</span>
                    <span>🚗 Transport &nbsp;<b style="color:#00c6ff">₹${transport.toLocaleString()}</b></span>
                    <span style="opacity:0.3">|</span>
                    <span>🎯 Activities &nbsp;<b style="color:#00c6ff">₹${activities.toLocaleString()}</b></span>
                    <span style="opacity:0.3">|</span>
                    <span>🧾 Misc &nbsp;<b style="color:#00c6ff">₹${misc.toLocaleString()}</b></span>
                </div>`;
        } catch (err) {
            fallbackBudget(total, days, location.toLowerCase(), style);
        }

    }, 600);
}

function fallbackBudget(total, days, location, style) {
    const box = document.getElementById("budgetBreakdown");

    let locationType = "cheap";
    if (location.includes("usa") || location.includes("uk") || location.includes("dubai")) locationType = "international";
    else if (location.includes("bangalore") || location.includes("mumbai") || location.includes("delhi")) locationType = "metro";
    else if (location.includes("goa") || location.includes("manali") || location.includes("ooty")) locationType = "tourist";

    let stayPerDay, foodPerDay, activityPerDay, transportBase;
    if (locationType === "international") { stayPerDay = 5000; foodPerDay = 1500; activityPerDay = 1200; transportBase = 8000; }
    else if (locationType === "metro")    { stayPerDay = 2000; foodPerDay = 600;  activityPerDay = 500;  transportBase = 1500; }
    else if (locationType === "tourist")  { stayPerDay = 1500; foodPerDay = 500;  activityPerDay = 600;  transportBase = 1200; }
    else                                  { stayPerDay = 800;  foodPerDay = 300;  activityPerDay = 300;  transportBase = 500;  }

    let multiplier = 1;
    if (style === "Budget") multiplier = 0.8;
    if (style === "Luxury") multiplier = 1.8;

    let stay       = Math.floor(stayPerDay * days * multiplier);
    let food       = Math.floor(foodPerDay * days * multiplier);
    let activities = Math.floor(activityPerDay * days * multiplier);
    let transport  = Math.floor(transportBase + 200 * days);
    const scale    = total / (stay + food + activities + transport);

    stay       = Math.floor(stay * scale);
    food       = Math.floor(food * scale);
    activities = Math.floor(activities * scale);
    transport  = Math.floor(transport * scale);

    box.innerHTML = `
        <div style="font-size:11px; opacity:0.55; margin-bottom:5px;">
            📍 ${locationType.toUpperCase()} (offline) &nbsp;·&nbsp; 📅 ${days} day${days > 1 ? "s" : ""}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px; font-size:12.5px;">
            <span>🏨 Stay &nbsp;<b style="color:#00c6ff">₹${stay.toLocaleString()}</b></span>
            <span style="opacity:0.3">|</span>
            <span>🍜 Food &nbsp;<b style="color:#00c6ff">₹${food.toLocaleString()}</b></span>
            <span style="opacity:0.3">|</span>
            <span>🚗 Transport &nbsp;<b style="color:#00c6ff">₹${transport.toLocaleString()}</b></span>
            <span style="opacity:0.3">|</span>
            <span>🎯 Activities &nbsp;<b style="color:#00c6ff">₹${activities.toLocaleString()}</b></span>
        </div>`;
}

// ── Open overlay with loading state ──────────────────────────────
function openOverlay(location) {
    const overlay = document.getElementById("overlay");
    const body    = document.getElementById("overlayBody");
    const title   = document.getElementById("overlayTitle");

    title.textContent = `📍 ${location} — Your Trip Plan`;
    body.innerHTML = `
        <div class="overlay-loading">
            <div class="plane">✈️</div>
            <p>Generating your personalised plan for <b>${location}</b>…</p>
        </div>`;

    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
}

// ── Close overlay ─────────────────────────────────────────────────
function closeOverlay() {
    const overlay = document.getElementById("overlay");
    overlay.classList.remove("active");
    document.body.style.overflow = "";
}

// ── ESC key closes overlay ────────────────────────────────────────
document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeOverlay();
});

// ── Generate plan ─────────────────────────────────────────────────
async function generatePlan() {
    const location = document.getElementById("destination").value.trim();
    const days     = parseInt(document.getElementById("days").value);
    const budget   = parseInt(document.getElementById("budget").value);
    const style    = document.getElementById("style").value;
    const interest = document.getElementById("interests").value;
    const start    = document.getElementById("start").value.trim() || "Not specified";

    if (!location || !days || !budget) {
        alert("Please fill in destination, days, and budget.");
        return;
    }

    const btn = document.getElementById("btn");
    btn.disabled    = true;
    btn.textContent = "⏳ Planning…";

    // ✅ Open overlay immediately with loading animation
    openOverlay(location);

    try {
        const res  = await fetch("/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ location, days, budget, style, interest, start })
        });
        const data = await res.json();
        const body = document.getElementById("overlayBody");

        if (data.error) {
            body.innerHTML = `<div style="color:#ff6b6b; padding:20px; text-align:center;">❌ ${data.error}</div>`;
            return;
        }

        body.innerHTML = formatReply(data.reply, location, days, budget);

    } catch (err) {
        document.getElementById("overlayBody").innerHTML =
            `<div style="color:#ff6b6b; padding:20px; text-align:center;">❌ Network error. Please try again.</div>`;
    } finally {
        btn.disabled    = false;
        btn.textContent = "✨ Generate Plan";
    }
}

// ── Format AI reply into rich HTML ───────────────────────────────
function formatReply(text, location, days, budget) {
    let html = `
        <div class="result-header">
            <span>📍</span>
            <span>${location}</span>
            <span style="opacity:0.35">·</span>
            <span>${days} Day${days > 1 ? "s" : ""}</span>
            <span style="opacity:0.35">·</span>
            <span>₹${budget.toLocaleString()}</span>
        </div>`;

    const lines = text.split("\n").filter(l => l.trim() !== "");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (/^(day\s*\d+|###\s*day)/i.test(line)) {
            html += `<div class="day-card"><div class="day-title">📅 ${line.replace(/^#+\s*/, "")}</div>`;
            while (i + 1 < lines.length && /^[-•*]/.test(lines[i + 1].trim())) {
                i++;
                html += `<div class="day-item">→ ${lines[i].trim().replace(/^[-•*]\s*/, "")}</div>`;
            }
            html += `</div>`;
        }
        else if (/^(##|#|\d+\.\s)/i.test(line)) {
            html += `<div class="section-title">${line.replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "")}</div>`;
        }
        else if (/tip|note|advice|remember|avoid|carry|book/i.test(line) && line.length < 160) {
            html += `<div class="tip-item">💡 ${line.replace(/^[-•*]\s*/, "")}</div>`;
        }
        else if (/₹|\brupee|\bcost|\bbudget|\bprice|\bfee/i.test(line)) {
            const parts = line.split(":");
            if (parts.length >= 2) {
                html += `<div class="budget-row">
                    <span>${parts[0].replace(/^[-•*\d.]\s*/, "").trim()}</span>
                    <span>${parts.slice(1).join(":").trim()}</span>
                </div>`;
            } else {
                html += `<div class="budget-row"><span>${line}</span></div>`;
            }
        }
        else if (/^[-•*]/.test(line)) {
            html += `<div class="bullet-line">→ ${line.replace(/^[-•*]\s*/, "")}</div>`;
        }
        else {
            html += `<div class="normal-line">${line}</div>`;
        }
    }

    return html;
}

// ── Reset form ────────────────────────────────────────────────────
function resetForm() {
    ["destination", "days", "budget", "start"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("style").selectedIndex     = 0;
    document.getElementById("interests").selectedIndex = 0;
    document.getElementById("budgetBreakdown").innerHTML = "";
    closeOverlay();
}
