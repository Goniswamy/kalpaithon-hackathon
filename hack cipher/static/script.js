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

// ── Budget listeners ─────────────────────────────────────────────
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

        if (!total || total <= 0 || location.length < 3) { box.innerHTML = ""; return; }

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

    let multiplier = style === "Budget" ? 0.8 : style === "Luxury" ? 1.8 : 1;
    let stay       = Math.floor(stayPerDay * days * multiplier);
    let food       = Math.floor(foodPerDay * days * multiplier);
    let activities = Math.floor(activityPerDay * days * multiplier);
    let transport  = Math.floor(transportBase + 200 * days);
    const scale    = total / (stay + food + activities + transport);
    stay = Math.floor(stay * scale); food = Math.floor(food * scale);
    activities = Math.floor(activities * scale); transport = Math.floor(transport * scale);

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

// ── Overlay controls ─────────────────────────────────────────────
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
    switchTab("itinerary");
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeOverlay() {
    document.getElementById("overlay").classList.remove("active");
    document.body.style.overflow = "";
    if (window._tripMap) { window._tripMap.remove(); window._tripMap = null; }
    sessionStorage.setItem("overlayOpen", "false");
}

document.addEventListener("keydown", e => { if (e.key === "Escape") closeOverlay(); });

// ── Tab switching ────────────────────────────────────────────────
function switchTab(tabName) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === `tab-${tabName}`));
    if (tabName === "map" && window._tripMap) {
        setTimeout(() => window._tripMap.invalidateSize(), 100);
    }
    sessionStorage.setItem("activeTab", tabName);
}

// ── Generate plan (ENHANCED) ─────────────────────────────────────
async function generatePlan() {
    const location = document.getElementById("destination").value.trim();
    const days     = parseInt(document.getElementById("days").value);
    const budget   = parseInt(document.getElementById("budget").value);
    const style    = document.getElementById("style").value;
    const interest = document.getElementById("interests").value;
    const start    = document.getElementById("start").value.trim() || "Not specified";

    if (!location || !days || !budget) { alert("Please fill in destination, days, and budget."); return; }

    const btn = document.getElementById("btn");
    btn.disabled = true; btn.textContent = "⏳ Planning…";
    openOverlay(location);

    // Show loading skeletons in other tabs
    showSkeletons();

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

        // Save state for persistence on refresh
        sessionStorage.setItem("tripForm", JSON.stringify({ location, days, budget, style, interest, start }));
        sessionStorage.setItem("tripPlan", JSON.stringify(data));
        sessionStorage.setItem("overlayOpen", "true");
        sessionStorage.removeItem("placesData"); // Clear previous cached places

        if (data.format === "json" && typeof data.reply === "object") {
            const plan = data.reply;
            body.innerHTML = formatStructuredReply(plan, location, days, budget);
            loadMapAndPlaces(plan.places || [], location, start);
            renderHotels(plan.hotels || [], location);
            renderGallery(plan.places || [], location);
        } else {
            // Fallback to legacy text format
            const text = typeof data.reply === "string" ? data.reply : JSON.stringify(data.reply);
            body.innerHTML = formatReplyLegacy(text, location, days, budget);
        }
    } catch (err) {
        document.getElementById("overlayBody").innerHTML =
            `<div style="color:#ff6b6b; padding:20px; text-align:center;">❌ Network error. Please try again.</div>`;
    } finally {
        btn.disabled = false; btn.textContent = "✨ Generate Plan";
    }
}

// ── Loading skeletons ────────────────────────────────────────────
function showSkeletons() {
    const skel = `<div class="skeleton-card"></div>`.repeat(4);
    document.getElementById("hotelsContainer").innerHTML = `<div class="skeleton-grid">${skel}</div>`;
    document.getElementById("galleryContainer").innerHTML = `<div class="skeleton-grid">${skel}</div>`;
    document.getElementById("mapLegend").innerHTML = "";
}

// ── Format structured JSON reply (STYLISH TIMELINE) ────────────────
function formatStructuredReply(plan, location, days, budget) {
    let html = `
    <div class="result-header">
        <span>📍</span><span>${location}</span>
        <span style="opacity:0.35">·</span><span>${days} Day${days > 1 ? "s" : ""}</span>
        <span style="opacity:0.35">·</span><span>₹${budget.toLocaleString()}</span>
    </div>`;

    // Itinerary Timeline
    if (plan.itinerary) {
        html += `<div class="timeline-container">`;
        plan.itinerary.forEach((day, index) => {
            const imgQuery = encodeURIComponent(`${day.title} ${location} travel`);
            html += `
            <div class="timeline-item" style="animation-delay:${index * 0.15}s">
                <div class="timeline-marker">Day ${day.day}</div>
                <div class="timeline-content">
                    <div class="timeline-img-wrapper">
                        <img src="/image-proxy?q=${imgQuery}" alt="Day ${day.day}" loading="lazy">
                    </div>
                    <div class="timeline-text">
                        <h4 class="timeline-title">${day.title}</h4>
                        <p class="timeline-desc">
                            ${day.description || (day.activities || []).join(". ")}
                        </p>
                    </div>
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    // Budget breakdown
    if (plan.budget_breakdown) {
        const bb = plan.budget_breakdown;
        html += `<div class="section-title" style="margin-top:40px;">💰 Budget Breakdown</div>
        <div class="budget-grid">`;
        const items = [
            ["🏨 Stay", bb.stay], ["🍜 Food", bb.food], ["🚗 Transport", bb.transport],
            ["🎯 Activities", bb.activities], ["🧾 Misc", bb.misc]
        ];
        items.forEach(([label, val]) => {
            if (val) html += `<div class="budget-card">
                <div class="budget-label">${label}</div>
                <div class="budget-val">₹${val.toLocaleString()}</div>
            </div>`;
        });
        html += `</div>`;
    }

    // Tips
    if (plan.tips && plan.tips.length) {
        html += `<div class="section-title">💡 Travel Tips</div>`;
        plan.tips.forEach(tip => { html += `<div class="tip-item">💡 ${tip}</div>`; });
    }

    return html;
}

// ── Legacy text formatter (backward compatible) ──────────────────
function formatReplyLegacy(text, location, days, budget) {
    let html = `<div class="result-header">
        <span>📍</span><span>${location}</span>
        <span style="opacity:0.35">·</span><span>${days} Day${days > 1 ? "s" : ""}</span>
        <span style="opacity:0.35">·</span><span>₹${budget.toLocaleString()}</span>
    </div>`;
    const lines = text.split("\n").filter(l => l.trim() !== "");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (/^(day\s*\d+|###\s*day)/i.test(line)) {
            html += `<div class="day-card"><div class="day-title">📅 ${line.replace(/^#+\s*/, "")}</div>`;
            while (i + 1 < lines.length && /^[-•*]/.test(lines[i + 1].trim())) {
                i++; html += `<div class="day-item">→ ${lines[i].trim().replace(/^[-•*]\s*/, "")}</div>`;
            }
            html += `</div>`;
        } else if (/^(##|#|\d+\.\s)/i.test(line)) {
            html += `<div class="section-title">${line.replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "")}</div>`;
        } else if (/tip|note|advice/i.test(line) && line.length < 160) {
            html += `<div class="tip-item">💡 ${line.replace(/^[-•*]\s*/, "")}</div>`;
        } else if (/₹|\brupee|\bcost|\bbudget/i.test(line)) {
            const parts = line.split(":");
            if (parts.length >= 2) {
                html += `<div class="budget-row"><span>${parts[0].replace(/^[-•*\d.]\s*/, "").trim()}</span><span>${parts.slice(1).join(":").trim()}</span></div>`;
            } else { html += `<div class="budget-row"><span>${line}</span></div>`; }
        } else if (/^[-•*]/.test(line)) {
            html += `<div class="bullet-line">→ ${line.replace(/^[-•*]\s*/, "")}</div>`;
        } else {
            html += `<div class="normal-line">${line}</div>`;
        }
    }
    return html;
}

// ── MAP: Load places and render Leaflet map ──────────────────────
async function loadMapAndPlaces(places, destination, start) {
    try {
        const res = await fetch("/places-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ places, destination, start })
        });
        const data = await res.json();
        if (data.places && data.places.length) {
            initTripMap(data.places, destination);
            // Store for gallery
            window._placesData = data.places;
            sessionStorage.setItem("placesData", JSON.stringify(data.places));
        }
    } catch (err) {
        console.error("Map load error:", err);
    }
}

function initTripMap(places, destination) {
    if (window._tripMap) { window._tripMap.remove(); window._tripMap = null; }

    const validPlaces = places.filter(p => p.lat && p.lng);
    if (!validPlaces.length) {
        document.getElementById("tripMap").innerHTML = `<div style="padding:40px;text-align:center;opacity:0.5;">📍 No map data available</div>`;
        return;
    }

    const map = L.map("tripMap", { scrollWheelZoom: true, zoomControl: true });
    window._tripMap = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap',
        maxZoom: 18
    }).addTo(map);

    const bounds = L.latLngBounds();
    const legendHtml = [];

    const categoryColors = {
        temple: "#ff6b6b", beach: "#00c6ff", nature: "#00ff96", market: "#ffa726",
        monument: "#ce93d8", park: "#66bb6a", museum: "#42a5f5", default: "#00c6ff"
    };

    validPlaces.forEach((place, idx) => {
        const color = categoryColors[place.category] || categoryColors.default;
        const icon = L.divIcon({
            className: "custom-marker",
            html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${idx + 1}</div>`,
            iconSize: [32, 32], iconAnchor: [16, 16]
        });

        const popupContent = `
            <div style="font-family:Poppins,sans-serif;min-width:200px;">
                <h3 style="margin:0 0 6px;font-size:15px;color:#0072ff;">${place.name}</h3>
                <p style="margin:0 0 8px;font-size:12px;color:#555;">${place.description || ''}</p>
                <span style="background:#e3f2fd;color:#0072ff;padding:2px 8px;border-radius:10px;font-size:11px;">${place.category || 'attraction'}</span>
                <div style="margin-top:10px;display:flex;gap:6px;">
                    <a href="${place.maps_link}" target="_blank" style="background:#4285f4;color:#fff;padding:6px 12px;border-radius:6px;font-size:11px;text-decoration:none;">🗺️ Open in Maps</a>
                    ${place.directions_link ? `<a href="${place.directions_link}" target="_blank" style="background:#34a853;color:#fff;padding:6px 12px;border-radius:6px;font-size:11px;text-decoration:none;">🧭 Directions</a>` : ''}
                </div>
            </div>`;

        L.marker([place.lat, place.lng], { icon }).addTo(map).bindPopup(popupContent);
        bounds.extend([place.lat, place.lng]);

        legendHtml.push(`<div class="legend-item"><span class="legend-dot" style="background:${color}">${idx + 1}</span><span>${place.name}</span></div>`);
    });

    map.fitBounds(bounds, { padding: [40, 40] });
    document.getElementById("mapLegend").innerHTML = legendHtml.join("");
}

// ── HOTELS: Render hotel cards ───────────────────────────────────
function renderHotels(hotels, destination) {
    const container = document.getElementById("hotelsContainer");
    if (!hotels.length) {
        container.innerHTML = `<div class="empty-state">🏨 No hotel recommendations available</div>`;
        return;
    }

    const encodedDest = encodeURIComponent(destination);
    container.innerHTML = `
        <div class="hotels-header">
            <h3>🏨 Recommended Hotels in ${destination}</h3>
            <a href="https://www.google.com/maps/search/hotels+in+${encodedDest}" target="_blank" class="view-all-btn">View All on Google Maps →</a>
        </div>
        <div class="hotels-grid">
            ${hotels.map((h, i) => {
                const imgQuery = encodeURIComponent(`${h.name} hotel ${destination}`);
                const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ' ' + destination)}`;
                const stars = '⭐'.repeat(Math.floor(h.rating || 4));
                const typeClass = (h.type || 'mid-range').toLowerCase().replace(/\s+/g, '-');
                return `
                <div class="hotel-card" style="animation-delay:${i * 0.1}s">
                    <div class="hotel-img-wrapper">
                        <img src="/image-proxy?q=${imgQuery}" alt="${h.name}" loading="lazy">
                        <span class="hotel-type-badge ${typeClass}">${h.type || 'Mid-range'}</span>
                    </div>
                    <div class="hotel-info">
                        <div class="hotel-name">${h.name}</div>
                        <div class="hotel-rating">${stars} <span>${h.rating || '4.0'}</span></div>
                        <div class="hotel-price">${h.price_range || '₹1,500 - ₹3,000'}</div>
                        <div class="hotel-distance">📍 ${h.distance || 'Near city center'}</div>
                        <p class="hotel-desc">${h.description || ''}</p>
                        <div class="hotel-actions">
                            <a href="${mapsLink}" target="_blank" class="hotel-btn maps-btn">🗺️ View on Maps</a>
                            <a href="https://www.google.com/search?q=${encodeURIComponent(h.name + ' ' + destination + ' booking')}" target="_blank" class="hotel-btn book-btn">📋 Book Now</a>
                        </div>
                    </div>
                </div>`;
            }).join("")}
        </div>`;
}

// ── GALLERY: Render place images ─────────────────────────────────
function renderGallery(places, destination) {
    const container = document.getElementById("galleryContainer");
    if (!places.length) {
        container.innerHTML = `<div class="empty-state">📸 No images available</div>`;
        return;
    }

    container.innerHTML = `
        <div class="gallery-header"><h3>📸 ${destination} — Places Gallery</h3></div>
        <div class="gallery-grid">
            ${places.map((p, i) => {
                const name = typeof p === "string" ? p : p.name;
                const cat = typeof p === "string" ? "" : (p.category || "");
                const imgQuery = encodeURIComponent(`${name} ${cat} ${destination} travel`);
                return `
                <div class="gallery-card" style="animation-delay:${i * 0.08}s">
                    <img src="/image-proxy?q=${imgQuery}" alt="${name}" loading="lazy">
                    <div class="gallery-overlay">
                        <span class="gallery-name">${name}</span>
                        ${cat ? `<span class="gallery-cat">${cat}</span>` : ''}
                    </div>
                </div>`;
            }).join("")}
        </div>`;
}

// ── Google Maps link helper ──────────────────────────────────────
function openInGoogleMaps(query) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank");
}

// ── Reset form ────────────────────────────────────────────────────
function resetForm() {
    ["destination", "days", "budget", "start"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("style").selectedIndex     = 0;
    document.getElementById("interests").selectedIndex = 0;
    document.getElementById("budgetBreakdown").innerHTML = "";
    sessionStorage.removeItem("tripForm");
    sessionStorage.removeItem("tripPlan");
    sessionStorage.setItem("overlayOpen", "false");
    sessionStorage.removeItem("activeTab");
    sessionStorage.removeItem("placesData");
    closeOverlay();
}

// ── State Persistence ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    // Restore form values
    const savedForm = sessionStorage.getItem("tripForm");
    if (savedForm) {
        try {
            const form = JSON.parse(savedForm);
            if (form.location) document.getElementById("destination").value = form.location;
            if (form.start) document.getElementById("start").value = form.start;
            if (form.days) document.getElementById("days").value = form.days;
            if (form.budget) document.getElementById("budget").value = form.budget;
            if (form.style) document.getElementById("style").value = form.style;
            if (form.interest) document.getElementById("interests").value = form.interest;
            updateBudget();
        } catch (e) {
            console.error("Error restoring form:", e);
        }
    }

    // Restore overlay and plan
    const isOverlayOpen = sessionStorage.getItem("overlayOpen") === "true";
    if (isOverlayOpen && savedForm) {
        const savedPlanStr = sessionStorage.getItem("tripPlan");
        if (savedPlanStr) {
            try {
                const data = JSON.parse(savedPlanStr);
                const form = JSON.parse(savedForm);
                
                openOverlay(form.location);
                showSkeletons();
                
                const body = document.getElementById("overlayBody");
                
                if (data.format === "json" && typeof data.reply === "object") {
                    const plan = data.reply;
                    body.innerHTML = formatStructuredReply(plan, form.location, form.days, form.budget);
                    
                    const cachedPlaces = sessionStorage.getItem("placesData");
                    if (cachedPlaces) {
                        const placesData = JSON.parse(cachedPlaces);
                        initTripMap(placesData, form.location);
                        window._placesData = placesData;
                    } else {
                        loadMapAndPlaces(plan.places || [], form.location, form.start);
                    }
                    
                    renderHotels(plan.hotels || [], form.location);
                    renderGallery(plan.places || [], form.location);
                } else {
                    const text = typeof data.reply === "string" ? data.reply : JSON.stringify(data.reply);
                    body.innerHTML = formatReplyLegacy(text, form.location, form.days, form.budget);
                }
                
                // Restore active tab
                const activeTab = sessionStorage.getItem("activeTab");
                if (activeTab) {
                    switchTab(activeTab);
                }
            } catch (e) {
                console.error("Error restoring plan:", e);
            }
        }
    }
});
