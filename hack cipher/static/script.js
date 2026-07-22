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

// ── Autocomplete System ──────────────────────────────────────────
(function () {
    /**
     * Initializes autocomplete on a given input field.
     * @param {string} inputId - The input element's id
     * @param {string} dropdownId - The dropdown container's id
     */
    function initAutocomplete(inputId, dropdownId) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);
        if (!input || !dropdown) return;

        let acTimer = null;
        let activeIndex = -1;
        let currentSuggestions = [];
        let abortController = null;

        // ── Show Recent & Trending Destinations ──
        function showRecentAndTrending() {
            const recent = JSON.parse(localStorage.getItem("recent_searches")) || [];
            const trending = [
                { name: "Goa", type: "🏖️ Beach" },
                { name: "Manali", type: "🏔️ Mountains" },
                { name: "Paris", type: "🗼 Romance" },
                { name: "Tokyo", type: "🌸 Asia" },
                { name: "Jaipur", type: "🏯 Culture" }
            ];

            let html = "";
            if (recent.length > 0) {
                html += `<div style="font-size: 11px; color: #00c6ff; padding: 10px 14px 4px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">🕒 Recent Searches</div>`;
                html += recent.map((r, i) => `
                    <div class="ac-item" data-index="${i}" role="option">
                        <div class="ac-item-icon">🕒</div>
                        <div class="ac-item-text">
                            <div class="ac-item-primary">${escapeHtml(r)}</div>
                        </div>
                    </div>
                `).join("");
            }

            html += `<div style="font-size: 11px; color: #ff8c00; padding: 10px 14px 4px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">🔥 Trending Destinations</div>`;
            const trendStartIndex = recent.length;
            html += trending.map((t, i) => `
                <div class="ac-item" data-index="${trendStartIndex + i}" role="option">
                    <div class="ac-item-icon">✨</div>
                    <div class="ac-item-text">
                        <div class="ac-item-primary">${escapeHtml(t.name)}</div>
                        <div class="ac-item-secondary">${escapeHtml(t.type)}</div>
                    </div>
                </div>
            `).join("");

            html += `<div class="ac-footer">✨ Popular recommendations</div>`;
            dropdown.innerHTML = html;
            showDropdown();

            currentSuggestions = [
                ...recent.map(r => ({ value: r, icon: '🕒' })),
                ...trending.map(t => ({ value: t.name, icon: '✨', secondary: t.type }))
            ];
            activeIndex = -1;

            // Attach click listeners
            dropdown.querySelectorAll('.ac-item').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    const idx = parseInt(item.dataset.index);
                    selectSuggestion(idx);
                });
            });
        }

        // ── Fetch suggestions with debounce ──
        function fetchSuggestions(query) {
            if (abortController) abortController.abort();

            if (query.length < 2) {
                showRecentAndTrending();
                return;
            }

            showLoading();
            abortController = new AbortController();

            fetch(`/autocomplete?q=${encodeURIComponent(query)}`, {
                signal: abortController.signal
            })
            .then(res => res.json())
            .then(data => {
                currentSuggestions = data.suggestions || [];
                activeIndex = -1;
                if (currentSuggestions.length > 0) {
                    renderSuggestions(currentSuggestions, query);
                } else {
                    showNoResults(query);
                }
            })
            .catch(err => {
                if (err.name !== 'AbortError') {
                    hideDropdown();
                }
            });
        }

        // ── Render suggestion items ──
        function renderSuggestions(suggestions, query) {
            let html = suggestions.map((s, i) => {
                const primaryHighlighted = highlightMatch(s.value, query);
                const secondaryText = s.secondary || '';
                return `
                <div class="ac-item" data-index="${i}" role="option">
                    <div class="ac-item-icon">${s.icon || '📍'}</div>
                    <div class="ac-item-text">
                        <div class="ac-item-primary">${primaryHighlighted}</div>
                        ${secondaryText ? `<div class="ac-item-secondary">${secondaryText}</div>` : ''}
                    </div>
                </div>`;
            }).join('');

            html += `<div class="ac-footer">🌍 Powered by OpenStreetMap</div>`;

            dropdown.innerHTML = html;
            showDropdown();

            dropdown.querySelectorAll('.ac-item').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    const idx = parseInt(item.dataset.index);
                    selectSuggestion(idx);
                });
            });
        }

        function highlightMatch(text, query) {
            if (!query) return escapeHtml(text);
            const escaped = escapeHtml(text);
            const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
            return escaped.replace(regex, '<span class="ac-highlight">$1</span>');
        }

        function escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        function escapeRegex(str) {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function showLoading() {
            dropdown.innerHTML = `
                <div class="ac-loading">
                    <div class="ac-spinner"></div>
                    <span>Searching locations…</span>
                </div>`;
            showDropdown();
        }

        function showNoResults(query) {
            dropdown.innerHTML = `
                <div class="ac-no-results">
                    <span>🔍</span>
                    No locations found for "${escapeHtml(query)}"
                </div>`;
            showDropdown();
        }

        function showDropdown() {
            dropdown.style.display = 'block';
            void dropdown.offsetHeight;
            dropdown.classList.add('visible');
        }

        function hideDropdown() {
            dropdown.classList.remove('visible');
            dropdown.style.display = 'none';
            activeIndex = -1;
        }

        function selectSuggestion(index) {
            if (index < 0 || index >= currentSuggestions.length) return;
            const suggestion = currentSuggestions[index];
            input.value = suggestion.value;
            hideDropdown();
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        function updateActiveItem() {
            const items = dropdown.querySelectorAll('.ac-item');
            items.forEach((item, i) => {
                item.classList.toggle('ac-active', i === activeIndex);
            });
            if (activeIndex >= 0 && items[activeIndex]) {
                items[activeIndex].scrollIntoView({ block: 'nearest' });
            }
        }

        input.addEventListener('input', () => {
            clearTimeout(acTimer);
            const query = input.value.trim();
            if (query.length < 2) {
                showRecentAndTrending();
            } else {
                acTimer = setTimeout(() => fetchSuggestions(query), 300);
            }
        });

        input.addEventListener('keydown', (e) => {
            if (!dropdown.classList.contains('visible') || currentSuggestions.length === 0) {
                return;
            }

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    activeIndex = (activeIndex + 1) % currentSuggestions.length;
                    updateActiveItem();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    activeIndex = activeIndex <= 0 ? currentSuggestions.length - 1 : activeIndex - 1;
                    updateActiveItem();
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (activeIndex >= 0) {
                        selectSuggestion(activeIndex);
                    } else {
                        hideDropdown();
                    }
                    break;
                case 'Escape':
                    hideDropdown();
                    break;
            }
        });

        input.addEventListener('focus', () => {
            const query = input.value.trim();
            if (query.length >= 2) {
                fetchSuggestions(query);
            } else {
                showRecentAndTrending();
            }
        });

        input.addEventListener('blur', () => {
            setTimeout(() => hideDropdown(), 120);
        });
    }

    document.addEventListener('mousedown', (e) => {
        document.querySelectorAll('.ac-dropdown').forEach(dd => {
            if (!dd.parentElement.contains(e.target)) {
                dd.classList.remove('visible');
                dd.style.display = 'none';
            }
        });
    });

    initAutocomplete('destination', 'destination-dropdown');
    initAutocomplete('start', 'start-dropdown');
})();

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
    const title   = document.getElementById("heroTitle");
    title.textContent = location;
    
    // Set hero image
    const heroImage = document.getElementById("heroImage");
    heroImage.style.backgroundImage = `url('/image-proxy?q=${encodeURIComponent(location + ' travel banner scenic cinematic')}')`;
    
    const loadingTexts = [
        `Analyzing coordinates and local route pathways for ${location}...`,
        "Sourcing hotel recommendations and price tiers...",
        "Curating scenic morning, afternoon, and evening slots...",
        "Mapping geo-coordinates for interactive split-screen navigation...",
        "Synthesizing budget breakdowns and travel tips...",
        "Crafting packing list templates and emergency directories..."
    ];
    
    let textIdx = 0;
    
    body.innerHTML = `
        <div class="overlay-loading">
            <div class="plane-wrapper">
                <div class="loading-ring-outer"></div>
                <div class="loading-ring"></div>
                <div class="plane">✈️</div>
            </div>
            <p id="loadingStatusText">Generating your premium travel itinerary for <b>${location}</b>…</p>
            <div class="loading-progress-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        </div>`;
        
    // Change status text periodically
    if (window._loadingInterval) clearInterval(window._loadingInterval);
    window._loadingInterval = setInterval(() => {
        const textEl = document.getElementById("loadingStatusText");
        if (textEl) {
            textEl.innerHTML = loadingTexts[textIdx % loadingTexts.length];
            textIdx++;
        }
    }, 2500);
    
    switchTab("itinerary");
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeOverlay() {
    if (window._loadingInterval) { clearInterval(window._loadingInterval); window._loadingInterval = null; }
    document.getElementById("overlay").classList.remove("active");
    document.body.style.overflow = "";
    if (window._tripMap) { window._tripMap.remove(); window._tripMap = null; }
    sessionStorage.setItem("overlayOpen", "false");
}

document.addEventListener("keydown", e => { if (e.key === "Escape") closeOverlay(); });

// ── Tab switching ────────────────────────────────────────────────
function switchTab(tabName) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
    document.querySelectorAll(".mob-nav-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === `tab-${tabName}`));
    
    if (tabName === "itinerary" && window._tripMap) {
        setTimeout(() => window._tripMap.invalidateSize(), 300);
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

    // Show loading skeletons
    showSkeletons();

    try {
        const res  = await fetch("/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ location, days, budget, style, interest, start })
        });
        const data = await res.json();
        const body = document.getElementById("overlayBody");

        if (window._loadingInterval) { clearInterval(window._loadingInterval); window._loadingInterval = null; }

        if (data.error) {
            body.innerHTML = `<div style="color:#ff6b6b; padding:20px; text-align:center;">❌ ${data.error}</div>`;
            return;
        }

        // Save state for persistence
        sessionStorage.setItem("tripForm", JSON.stringify({ location, days, budget, style, interest, start }));
        sessionStorage.setItem("tripPlan", JSON.stringify(data));
        sessionStorage.setItem("overlayOpen", "true");
        sessionStorage.removeItem("placesData"); // Clear previous cached places

        // Save to Recent Searches
        saveRecentSearch(location);

        if (data.format === "json" && typeof data.reply === "object") {
            const plan = data.reply;
            renderTripUI(plan, location, days, budget, style, start);
        } else {
            // Fallback to legacy text format
            const text = typeof data.reply === "string" ? data.reply : JSON.stringify(data.reply);
            body.innerHTML = formatReplyLegacy(text, location, days, budget);
            renderHeroBadges(days, budget, style, null);
        }

        // Fetch nearby attractions asynchronously
        loadNearbyAttractions(location, start);

    } catch (err) {
        if (window._loadingInterval) { clearInterval(window._loadingInterval); window._loadingInterval = null; }
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
    const nearbyContainer = document.getElementById("nearbyContainer");
    if (nearbyContainer) nearbyContainer.innerHTML = `<div class="skeleton-grid">${skel}</div>`;
    document.getElementById("mapLegend").innerHTML = "";
}

// ── Render Trip UI components ──
function renderTripUI(plan, location, days, budget, style, start) {
    const body = document.getElementById("overlayBody");
    
    // 1. Render Itinerary
    body.innerHTML = formatStructuredReply(plan, location, days, budget);
    
    // 2. Render Hero badges & weather
    renderHeroBadges(days, budget, style, plan.weather_summary);
    
    // 3. Load Map & Places
    loadMapAndPlaces(plan.places || [], location, start);
    
    // 4. Stays
    renderHotels(plan.hotels || [], location);
    
    // 5. Gallery
    renderGallery(plan.places || [], location);
    
    // 6. Tools panel widgets
    initSmartWidgets(plan, location, budget);
}

// ── Render Hero badges ──
function renderHeroBadges(days, budget, style, weatherText) {
    const container = document.getElementById("heroBadges");
    const weatherVal = weatherText || "Sunny, 24°C";
    container.innerHTML = `
        <div class="hero-badge highlight">📅 ${days} Days</div>
        <div class="hero-badge highlight">💰 ₹${budget.toLocaleString()}</div>
        <div class="hero-badge">🎒 ${style}</div>
        <div class="hero-badge">🌤️ ${weatherVal}</div>
    `;
}

// ── Accordion toggle ──
function toggleDayCard(cardElement, dayIndex) {
    const wasActive = cardElement.classList.contains("expanded");
    
    // Close other days (optional, accordion style)
    document.querySelectorAll(".day-timeline-card").forEach(card => {
        card.classList.remove("expanded");
    });
    
    if (!wasActive) {
        cardElement.classList.add("expanded");
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Highlight corresponding map marker for this day if map loaded
        focusDayOnMap(dayIndex);
    }
}

// ── Focus Day on Map ──
function focusDayOnMap(dayIndex) {
    if (!window._tripMap || !window._markers || !window._markers.length) return;
    
    // Simple logic: zoom to the marker matching this day index range
    // Each day morning/afternoon/evening might link to a place.
    // Let's open popup of the first marker of the day if possible.
    const markerIndex = (dayIndex - 1) % window._markers.length;
    const marker = window._markers[markerIndex];
    if (marker) {
        window._tripMap.setView(marker.getLatLng(), 14);
        marker.openPopup();
    }
}

// ── Format structured JSON reply (Immersive Cards) ────────────────
function formatStructuredReply(plan, location, days, budget) {
    let html = `
    <!-- Progress Tracker -->
    <div class="trip-progress-container">
        <div class="trip-progress-label">
            <span>Trip Progress</span>
            <span id="progressPercent">0% Completed</span>
        </div>
        <div class="trip-progress-bar-bg">
            <div class="trip-progress-bar-fill" id="progressBarFill"></div>
        </div>
    </div>`;

    if (plan.itinerary) {
        plan.itinerary.forEach((day, index) => {
            const hasDetailedSlots = day.morning && day.afternoon && day.evening;
            const dayDesc = day.description || "";
            const travelTip = day.travel_tip || "Stay hydrated and carry cash.";
            const transport = day.transport || "Taxi / Walking";
            const tags = day.tags || ["Explore", "Sightseeing"];
            const expense = day.day_expense || 1500;
            
            html += `
            <div class="day-timeline-card ${index === 0 ? 'expanded' : ''}" onclick="toggleDayCard(this, ${day.day})">
                <div class="day-card-header">
                    <div class="day-card-title-group">
                        <div class="day-card-number">Day ${day.day}</div>
                        <div class="day-card-title">${day.title}</div>
                    </div>
                    <div class="day-card-meta">
                        <span>₹${expense.toLocaleString()}</span>
                        <span class="day-card-chevron">▼</span>
                    </div>
                </div>
                <div class="day-card-detail">
                    <div class="day-card-body" onclick="event.stopPropagation()">
                        ${dayDesc ? `<p class="day-summary-text">${dayDesc}</p>` : ''}
                        
                        <div class="tod-slots">`;
            
            // Render Slots
            const slots = ["morning", "afternoon", "evening"];
            slots.forEach(slotKey => {
                const slot = day[slotKey];
                if (slot) {
                    const icon = slotKey === "morning" ? "🌅" : slotKey === "afternoon" ? "☀️" : "🌙";
                    const mapQuery = encodeURIComponent(`${slot.place} ${location}`);
                    html += `
                    <div class="tod-slot">
                        <div class="tod-time-tag">${slot.time || ''}</div>
                        <div class="tod-card ${slotKey}">
                            <div class="tod-info-group">
                                <div class="tod-icon">${icon}</div>
                                <div class="tod-text">
                                    <div class="tod-place-name">${slot.place}</div>
                                    <div class="tod-activity">${slot.activity}</div>
                                </div>
                            </div>
                            <div class="tod-meta-info">
                                <span class="tod-cost-badge">₹${slot.expense || 0}</span>
                                <a href="https://www.google.com/maps/search/?api=1&query=${mapQuery}" target="_blank" class="tod-maps-btn">
                                    📍 Map
                                </a>
                            </div>
                        </div>
                    </div>`;
                }
            });
            
            html += `
                        </div>
                        
                        <!-- Day Extra Info Footer -->
                        <div class="day-extras">
                            <div class="day-extra-item">
                                <div class="day-extra-label">🚗 Transport & Commute</div>
                                <div class="day-extra-content">${transport}</div>
                            </div>
                            <div class="day-extra-item">
                                <div class="day-extra-label">💡 Travel Tip</div>
                                <div class="day-extra-content">${travelTip}</div>
                            </div>
                            <div class="day-extra-item" style="grid-column: span 2;">
                                <div class="day-extra-label">🏷️ Tags</div>
                                <div class="day-tags">
                                    ${tags.map(t => `<span class="day-tag-pill">#${t}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        });
    }

    // Budget breakdown
    if (plan.budget_breakdown) {
        const bb = plan.budget_breakdown;
        html += `<div class="section-title">💰 Budget Breakdown</div>
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
        html += `<div class="section-title">💡 General Tips</div>`;
        plan.tips.forEach(tip => { html += `<div class="tip-item">💡 ${tip}</div>`; });
    }

    // Animate progress tracker fill after rendering
    setTimeout(() => {
        const fill = document.getElementById("progressBarFill");
        const text = document.getElementById("progressPercent");
        if (fill && text) {
            fill.style.width = "100%";
            text.textContent = "100% Ready";
        }
    }, 400);

    return html;
}

// ── Legacy text formatter ──────────────────
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
            html += `<div class="day-timeline-card expanded">
                <div class="day-card-header">
                    <div class="day-card-title-group">
                        <div class="day-card-number">📅</div>
                        <div class="day-card-title">${line.replace(/^#+\s*/, "")}</div>
                    </div>
                </div>
                <div class="day-card-body">`;
            while (i + 1 < lines.length && /^[-•*]/.test(lines[i + 1].trim())) {
                i++; 
                html += `<div class="bullet-line">→ ${lines[i].trim().replace(/^[-•*]\s*/, "")}</div>`;
            }
            html += `</div></div>`;
        } else if (/^(##|#|\d+\.\s)/i.test(line)) {
            html += `<div class="section-title">${line.replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "")}</div>`;
        } else if (/tip|note|advice/i.test(line) && line.length < 160) {
            html += `<div class="tip-item">💡 ${line.replace(/^[-•*]\s*/, "")}</div>`;
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
            window._placesData = data.places;
            sessionStorage.setItem("placesData", JSON.stringify(data.places));
            
            // Re-render favorites list & weather info now that coords exist
            const firstPlace = data.places.find(p => p.lat && p.lng);
            if (firstPlace) {
                fetchRealWeather(firstPlace.lat, firstPlace.lng);
            }
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
    window._markers = [];

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

        // Enrichment elements
        const placeImg = place.image_url || `/image-proxy?q=${encodeURIComponent(place.name + ' ' + destination)}`;
        const popupContent = `
            <div style="font-family:Inter,sans-serif;min-width:220px;color:#fff;background:#1a1d24;padding:4px;border-radius:8px;">
                <img src="${placeImg}" style="width:100%;height:110px;object-fit:cover;border-radius:6px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.08);">
                <h3 style="margin:0 0 4px;font-size:14px;color:#00c6ff;font-weight:700;">${place.name}</h3>
                <p style="margin:0 0 8px;font-size:12px;color:#cbd5e0;line-height:1.4;">${place.description || ''}</p>
                <div style="font-size:11px;color:#a0aec0;margin-bottom:8px;display:flex;flex-direction:column;gap:3px;">
                    ${place.timings ? `<span>🕒 <b>Timings:</b> ${place.timings}</span>` : ''}
                    ${place.time_spent ? `<span>⏳ <b>Duration:</b> ${place.time_spent}</span>` : ''}
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; border-top:1px solid rgba(255,255,255,0.08); padding-top:8px;">
                    <span style="background:rgba(0,198,255,0.15);color:#00c6ff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;text-transform:capitalize;">${place.category || 'attraction'}</span>
                    <button onclick="toggleFavorite('${place.name.replace(/'/g, "\\'")}')" style="background:none;border:none;color:#ff6b6b;cursor:pointer;font-size:16px;box-shadow:none;padding:0;width:auto;min-width:auto;" id="fav-${idx}">
                        ♡
                    </button>
                </div>
                <div style="margin-top:8px;display:flex;gap:6px;">
                    <a href="${place.maps_link || '#'}" target="_blank" style="background:#00c6ff;color:#0a0e17;padding:6px 12px;border-radius:6px;font-size:11px;text-decoration:none;font-weight:700;display:inline-block;text-align:center;width:100%;">🗺️ Open in Google Maps</a>
                </div>
            </div>`;

        const marker = L.marker([place.lat, place.lng], { icon }).addTo(map).bindPopup(popupContent);
        window._markers.push(marker);
        bounds.extend([place.lat, place.lng]);

        legendHtml.push(`<div class="legend-item" onclick="focusMarker(${idx})"><span class="legend-dot" style="background:${color}">${idx + 1}</span><span>${place.name}</span></div>`);
    });

    // Draw route between attractions (sequential polyline)
    const latlngs = validPlaces.map(p => [p.lat, p.lng]);
    if (latlngs.length > 1) {
        L.polyline(latlngs, {
            color: '#00c6ff',
            weight: 3.5,
            opacity: 0.8,
            dashArray: '6, 8',
            lineJoin: 'round'
        }).addTo(map);
    }

    // Calculate and show total route distance & travel time
    const totalDist = calculateTotalDistance(validPlaces);
    // Estimate transit duration based on avg 35km/h city driving speed + 15mins congestion buffer per spot
    const totalTimeHrs = (totalDist / 35) + (validPlaces.length * 0.25);

    const distEl = document.getElementById("routeDistance");
    const durEl = document.getElementById("routeDuration");
    if (distEl) distEl.textContent = `${totalDist.toFixed(1)} km`;
    if (durEl) durEl.textContent = `${totalTimeHrs.toFixed(1)} hrs`;

    map.fitBounds(bounds, { padding: [40, 40] });
    document.getElementById("mapLegend").innerHTML = legendHtml.join("");
}

// ── Geodesic distance calculators ──
function calculateTotalDistance(places) {
    let total = 0;
    for (let i = 0; i < places.length - 1; i++) {
        const p1 = places[i];
        const p2 = places[i+1];
        if (p1.lat && p1.lng && p2.lat && p2.lng) {
            total += getHaversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
        }
    }
    return total;
}

function getHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function focusMarker(idx) {
    if (window._markers && window._markers[idx]) {
        window._tripMap.setView(window._markers[idx].getLatLng(), 15);
        window._markers[idx].openPopup();
    }
}

// ── HOTELS: Render stays with Filter & Fallback ───────────────────
function renderHotels(hotelsData, destination) {
    let matching = [];
    let alternatives = [];
    
    if (Array.isArray(hotelsData)) {
        matching = hotelsData;
    } else if (hotelsData && typeof hotelsData === "object") {
        matching = hotelsData.matching || [];
        alternatives = hotelsData.alternatives || [];
    }
    
    window._allMatchingHotels = matching;
    window._allAlternativeHotels = alternatives;
    window._hotelsDestination = destination;
    
    renderFilteredHotels();
}

function renderFilteredHotels() {
    const container = document.getElementById("hotelsContainer");
    const matching = window._allMatchingHotels || [];
    const alternatives = window._allAlternativeHotels || [];
    const destination = window._hotelsDestination || "";
    
    // Read current filter selectors
    const priceFilter = document.getElementById("hotel-price-filter") ? document.getElementById("hotel-price-filter").value : "all";
    const ratingFilter = document.getElementById("hotel-rating-filter") ? parseFloat(document.getElementById("hotel-rating-filter").value) : 0;
    const distanceFilter = document.getElementById("hotel-distance-filter") ? parseFloat(document.getElementById("hotel-distance-filter").value) : 999;
    
    function matchesFilters(h) {
        // Price Range filter
        let minPrice = 0;
        const prices = (h.price_range || h.price || "").match(/\d+/g);
        if (prices && prices.length > 0) {
            minPrice = parseInt(prices[0].replace(/,/g, ""));
        }
        
        if (priceFilter === "budget" && minPrice > 2500) return false;
        if (priceFilter === "mid" && (minPrice < 2500 || minPrice > 6000)) return false;
        if (priceFilter === "luxury" && minPrice < 6000) return false;
        
        // Rating filter
        if (h.rating && h.rating < ratingFilter) return false;
        
        // Distance filter
        let distVal = 0;
        const dists = (h.distance || "").match(/[\d\.]+/);
        if (dists) {
            distVal = parseFloat(dists[0]);
        }
        if (distVal > distanceFilter) return false;
        
        return true;
    }
    
    const filteredMatching = matching.filter(matchesFilters);
    const filteredAlternatives = alternatives.filter(matchesFilters);
    
    let html = `
        <div class="hotels-header-section">
            <div class="hotels-header">
                <h3>🏨 Premium Recommended Stays</h3>
                <a href="https://www.google.com/maps/search/hotels+in+${encodeURIComponent(destination)}" target="_blank" class="view-all-btn">View All on Maps →</a>
            </div>
            
            <div class="hotels-filters">
                <div class="filter-group">
                    <label>Price:</label>
                    <select id="hotel-price-filter" onchange="renderFilteredHotels()">
                        <option value="all" ${priceFilter === 'all' ? 'selected' : ''}>All Prices</option>
                        <option value="budget" ${priceFilter === 'budget' ? 'selected' : ''}>Budget (Under ₹2.5k)</option>
                        <option value="mid" ${priceFilter === 'mid' ? 'selected' : ''}>Mid-Range (₹2.5k - ₹6k)</option>
                        <option value="luxury" ${priceFilter === 'luxury' ? 'selected' : ''}>Luxury (Above ₹6k)</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Rating:</label>
                    <select id="hotel-rating-filter" onchange="renderFilteredHotels()">
                        <option value="0" ${ratingFilter === 0 ? 'selected' : ''}>All Ratings</option>
                        <option value="4.5" ${ratingFilter === 4.5 ? 'selected' : ''}>4.5 ★ & above</option>
                        <option value="4.0" ${ratingFilter === 4.0 ? 'selected' : ''}>4.0 ★ & above</option>
                        <option value="3.5" ${ratingFilter === 3.5 ? 'selected' : ''}>3.5 ★ & above</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Distance:</label>
                    <select id="hotel-distance-filter" onchange="renderFilteredHotels()">
                        <option value="999" ${distanceFilter === 999 ? 'selected' : ''}>Any Distance</option>
                        <option value="2" ${distanceFilter === 2 ? 'selected' : ''}>Within 2 km</option>
                        <option value="5" ${distanceFilter === 5 ? 'selected' : ''}>Within 5 km</option>
                        <option value="10" ${distanceFilter === 10 ? 'selected' : ''}>Within 10 km</option>
                    </select>
                </div>
            </div>
        </div>
    `;
    
    if (matching.length === 0 && alternatives.length > 0) {
        html += `
        <div class="hotels-budget-warning">
            ⚠️ No hotels matching your budget were found within this area. Displaying closest alternative recommendations below.
        </div>
        <div class="hotels-grid">
            ${renderHotelsGrid(filteredAlternatives, destination)}
        </div>`;
    } else {
        if (filteredMatching.length === 0) {
            html += `<div class="empty-state">🏨 No hotels match the selected filter criteria.</div>`;
        } else {
            html += `
            <div class="hotels-grid">
                ${renderHotelsGrid(filteredMatching, destination)}
            </div>`;
        }
    }
    
    container.innerHTML = html;
}

function renderHotelsGrid(hotelsList, destination) {
    return hotelsList.map((h, i) => {
        const imgQuery = encodeURIComponent(`${h.name} hotel ${destination}`);
        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ' ' + destination)}`;
        const stars = '⭐'.repeat(Math.min(5, Math.floor(h.rating || 4)));
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
                <div class="hotel-price">${h.price_range || '₹2,500 - ₹5,000'}</div>
                <div class="hotel-distance">📍 ${h.distance || 'Close to attractions'}</div>
                <p class="hotel-desc">${h.description || ''}</p>
                <div class="hotel-actions">
                    <a href="${mapsLink}" target="_blank" class="hotel-btn maps-btn">🗺️ View Location</a>
                    <a href="https://www.google.com/search?q=${encodeURIComponent(h.name + ' ' + destination + ' booking')}" target="_blank" class="hotel-btn book-btn">✨ Stays Booking</a>
                </div>
            </div>
        </div>`;
    }).join("");
}

// ── GALLERY: Render place images ─────────────────────────────────
function renderGallery(places, destination) {
    const container = document.getElementById("galleryContainer");
    if (!places.length) {
        container.innerHTML = `<div class="empty-state">📸 No images available</div>`;
        return;
    }

    container.innerHTML = `
        <div class="gallery-header"><h3>📸 Explore Destination Highlights</h3></div>
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

// ── SMART FEATURES IMPLEMENTATION ────────────────────────────────

function initSmartWidgets(plan, location, totalBudget) {
    // 1. Budget Tracker widget
    const budgetBody = document.getElementById("budgetTrackerBody");
    const bb = plan.budget_breakdown || { stay: 35, food: 25, transport: 20, activities: 15, misc: 5 };
    
    let stayVal = bb.stay > 100 ? bb.stay : Math.round((bb.stay / 100) * totalBudget);
    let foodVal = bb.food > 100 ? bb.food : Math.round((bb.food / 100) * totalBudget);
    let transportVal = bb.transport > 100 ? bb.transport : Math.round((bb.transport / 100) * totalBudget);
    let activitiesVal = bb.activities > 100 ? bb.activities : Math.round((bb.activities / 100) * totalBudget);
    let miscVal = bb.misc > 100 ? bb.misc : Math.round((bb.misc / 100) * totalBudget);
    
    const maxVal = Math.max(stayVal, foodVal, transportVal, activitiesVal, miscVal, 1);
    
    budgetBody.innerHTML = `
        <div class="budget-bar-group">
            <div class="budget-bar-label"><span>🏨 Stay / Accomodation</span><span>₹${stayVal.toLocaleString()}</span></div>
            <div class="budget-bar-bg"><div class="budget-bar-fill" style="width: ${(stayVal/maxVal)*100}%"></div></div>
        </div>
        <div class="budget-bar-group">
            <div class="budget-bar-label"><span>🍜 Food & Restaurants</span><span>₹${foodVal.toLocaleString()}</span></div>
            <div class="budget-bar-bg"><div class="budget-bar-fill" style="width: ${(foodVal/maxVal)*100}%"></div></div>
        </div>
        <div class="budget-bar-group">
            <div class="budget-bar-label"><span>🚗 Local Transport</span><span>₹${transportVal.toLocaleString()}</span></div>
            <div class="budget-bar-bg"><div class="budget-bar-fill" style="width: ${(transportVal/maxVal)*100}%"></div></div>
        </div>
        <div class="budget-bar-group">
            <div class="budget-bar-label"><span>🎯 Activities & Sightseeing</span><span>₹${activitiesVal.toLocaleString()}</span></div>
            <div class="budget-bar-bg"><div class="budget-bar-fill" style="width: ${(activitiesVal/maxVal)*100}%"></div></div>
        </div>
        <div class="budget-bar-group">
            <div class="budget-bar-label"><span>🧾 Miscellaneous</span><span>₹${miscVal.toLocaleString()}</span></div>
            <div class="budget-bar-bg"><div class="budget-bar-fill" style="width: ${(miscVal/maxVal)*100}%"></div></div>
        </div>
    `;

    // 2. Notes
    loadTravelNotes(location);
    
    // 3. Packing checklist
    initPackingChecklist(location);
    
    // 4. Emergency Contacts
    const ec = plan.emergency_contacts || { police: "100", ambulance: "108", tourist_helpline: "1363" };
    document.getElementById("emergencyBody").innerHTML = `
        <div class="budget-row"><span>Police Dispatch</span><span>📞 ${ec.police}</span></div>
        <div class="budget-row"><span>Medical Emergency</span><span>📞 ${ec.ambulance}</span></div>
        <div class="budget-row"><span>Tourist Helpline</span><span>📞 ${ec.tourist_helpline || "1363"}</span></div>
        <div class="budget-row"><span>Local Emergency Services</span><span>📞 112 (Universal)</span></div>
    `;

    // 5. Travel Safety & Hospitals
    const safetyBody = document.getElementById("safetyBody");
    if (safetyBody) {
        if (plan.safety_info) {
            const si = plan.safety_info;
            let sHtml = `
                <div style="font-size:12.5px; line-height:1.5; color:#cbd5e0; margin-bottom:12px; background:rgba(255,255,255,0.03); border:1px dashed rgba(255,255,255,0.08); padding:8px; border-radius:6px;">
                    💡 <b>Local Advice:</b> ${si.local_info || 'Take standard precautions and use registered transport.'}
                </div>
                
                <div style="font-size:11px; color:#ff8c00; font-weight:700; margin-bottom:6px; text-transform:uppercase;">🚨 Safety Tips</div>
                <ul style="margin:0 0 14px 14px; padding:0; font-size:12.5px; color:#a0aec0; line-height:1.4;">
                    ${(si.safety_tips || ["Always carry a copy of your IDs.", "Keep emergency numbers on speed dial."]).map(tip => `<li style="margin-bottom:4px;">${tip}</li>`).join("")}
                </ul>
                
                <div style="font-size:11px; color:#00c6ff; font-weight:700; margin-bottom:6px; text-transform:uppercase;">🏥 Nearby Hospitals</div>
            `;
            if (si.hospitals && si.hospitals.length) {
                si.hospitals.forEach(h => {
                    sHtml += `
                        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; margin-bottom:6px; font-size:11.5px;">
                            <div style="font-weight:600; color:#fff;">🏢 ${h.name}</div>
                            <div style="color:#718096; margin-top:2px;">📍 ${h.address}</div>
                            <div style="color:#00ff96; margin-top:2px; font-weight:500;">📞 Call: ${h.contact}</div>
                        </div>
                    `;
                });
            } else {
                sHtml += `<div class="empty-state-small">No hospital details returned.</div>`;
            }
            safetyBody.innerHTML = sHtml;
        } else {
            safetyBody.innerHTML = `<div class="empty-state-small">No safety details available for this destination.</div>`;
        }
    }
    
    // Clear favorites UI
    document.getElementById("favoritesBody").innerHTML = `<div class="empty-state-small">No favorites yet. Click ♡ on places in the map popup!</div>`;
    window._favorites = [];
}

// Real Weather Widget using Open-Meteo API
async function fetchRealWeather(lat, lng) {
    try {
        const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`);
        const data = await resp.json();
        if (data.daily) {
            const tempsMax = data.daily.temperature_2m_max;
            const tempsMin = data.daily.temperature_2m_min;
            const dates = data.daily.time;
            const codes = data.daily.weathercode;
            
            const weatherBody = document.getElementById("weatherBody");
            let weatherHTML = `<div style="display:flex; flex-direction:column; gap:10px;">`;
            
            // Render first 4 days forecast
            for (let i = 0; i < Math.min(4, dates.length); i++) {
                const dateObj = new Date(dates[i]);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                const icon = getWeatherIcon(codes[i]);
                
                weatherHTML += `
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.04)">
                        <span>📅 ${dayName}</span>
                        <span>${icon}</span>
                        <span>${tempsMin[i]}° - ${tempsMax[i]}°C</span>
                    </div>
                `;
            }
            weatherHTML += `</div>`;
            weatherBody.innerHTML = weatherHTML;
        }
    } catch (e) {
        document.getElementById("weatherBody").innerHTML = `<div class="empty-state-small">Weather data unavailable offline</div>`;
    }
}

function getWeatherIcon(code) {
    if (code === 0) return "☀️ Clear";
    if (code >= 1 && code <= 3) return "🌤️ Cloudy";
    if (code >= 45 && code <= 48) return "🌫️ Foggy";
    if (code >= 51 && code <= 67) return "🌧️ Rain";
    if (code >= 71 && code <= 77) return "❄️ Snow";
    if (code >= 80 && code <= 82) return "🌧️ Showers";
    if (code >= 95) return "⛈️ Thunderstorm";
    return "🌤️ Variable";
}

// Notes localstorage
function loadTravelNotes(location) {
    const notesKey = `notes_${location.toLowerCase().replace(/\s+/g, '_')}`;
    const text = localStorage.getItem(notesKey) || "";
    document.getElementById("travelNotes").value = text;
}

function saveTravelNotes() {
    const location = document.getElementById("heroTitle").textContent;
    const notesKey = `notes_${location.toLowerCase().replace(/\s+/g, '_')}`;
    const text = document.getElementById("travelNotes").value;
    localStorage.setItem(notesKey, text);
    alert("Notes saved successfully! 📝");
}

// Checklist localstorage
function initPackingChecklist(location) {
    const listKey = `packing_${location.toLowerCase().replace(/\s+/g, '_')}`;
    let items = JSON.parse(localStorage.getItem(listKey));
    
    if (!items) {
        items = [
            { text: "Identity documents & Tickets", checked: false },
            { text: "Cash / Forex Cards", checked: false },
            { text: "Universal Charger & Powerbank", checked: false },
            { text: "Prescribed medicines", checked: false },
            { text: "Comfortable footwear", checked: false }
        ];
        localStorage.setItem(listKey, JSON.stringify(items));
    }
    renderPackingItems(items);
}

function renderPackingItems(items) {
    const listDiv = document.getElementById("packingList");
    if (!items.length) {
        listDiv.innerHTML = `<div class="empty-state-small">No packing items. Add some below!</div>`;
        return;
    }
    
    listDiv.innerHTML = items.map((item, index) => `
        <div class="packing-item">
            <input type="checkbox" id="chk-${index}" ${item.checked ? 'checked' : ''} onchange="togglePackingItem(${index})">
            <label for="chk-${index}">${item.text}</label>
            <button class="packing-delete-btn" onclick="deletePackingItem(${index})">✕</button>
        </div>
    `).join("");
}

function togglePackingItem(index) {
    const location = document.getElementById("heroTitle").textContent;
    const listKey = `packing_${location.toLowerCase().replace(/\s+/g, '_')}`;
    const items = JSON.parse(localStorage.getItem(listKey));
    items[index].checked = !items[index].checked;
    localStorage.setItem(listKey, JSON.stringify(items));
    renderPackingItems(items);
}

function addPackingItem() {
    const input = document.getElementById("newPackItem");
    const val = input.value.trim();
    if (!val) return;
    
    const location = document.getElementById("heroTitle").textContent;
    const listKey = `packing_${location.toLowerCase().replace(/\s+/g, '_')}`;
    const items = JSON.parse(localStorage.getItem(listKey)) || [];
    
    items.push({ text: val, checked: false });
    localStorage.setItem(listKey, JSON.stringify(items));
    renderPackingItems(items);
    input.value = "";
}

function deletePackingItem(index) {
    const location = document.getElementById("heroTitle").textContent;
    const listKey = `packing_${location.toLowerCase().replace(/\s+/g, '_')}`;
    const items = JSON.parse(localStorage.getItem(listKey));
    items.splice(index, 1);
    localStorage.setItem(listKey, JSON.stringify(items));
    renderPackingItems(items);
}

// Favorite places
window._favorites = [];
function toggleFavorite(placeName) {
    const index = window._favorites.indexOf(placeName);
    if (index === -1) {
        window._favorites.push(placeName);
        alert(`❤️ Added "${placeName}" to favorites!`);
    } else {
        window._favorites.splice(index, 1);
        alert(`💔 Removed "${placeName}" from favorites.`);
    }
    
    // Update favorites list panel
    const favBody = document.getElementById("favoritesBody");
    if (!window._favorites.length) {
        favBody.innerHTML = `<div class="empty-state-small">No favorites yet. Click ♡ on places in the map popup!</div>`;
    } else {
        favBody.innerHTML = window._favorites.map(fav => `
            <div class="budget-row" style="font-size:13.5px;">
                <span>📍 ${fav}</span>
                <span style="color:#ff6b6b; cursor:pointer;" onclick="toggleFavorite('${fav.replace(/'/g, "\\'")}')">❤️</span>
            </div>
        `).join("");
    }
}

// ── SAVED TRIPS HISTORY ──────────────────────────────────────────
function saveRecentSearch(city) {
    if (!city) return;
    let recent = JSON.parse(localStorage.getItem("recent_searches")) || [];
    recent = recent.filter(c => c.toLowerCase() !== city.toLowerCase());
    recent.unshift(city);
    recent = recent.slice(0, 5);
    localStorage.setItem("recent_searches", JSON.stringify(recent));
}

function updateSavedTripsCount() {
    const saved = JSON.parse(localStorage.getItem("saved_trips")) || [];
    const countEl = document.getElementById("savedTripsCount");
    if (countEl) countEl.textContent = saved.length;
}

function saveTripToHistory() {
    const savedPlan = sessionStorage.getItem("tripPlan");
    const savedForm = sessionStorage.getItem("tripForm");
    if (!savedPlan || !savedForm) return;

    const parsedPlan = JSON.parse(savedPlan);
    const parsedForm = JSON.parse(savedForm);

    const tripId = "trip_" + Date.now();
    const newTrip = {
        id: tripId,
        form: parsedForm,
        plan: parsedPlan,
        placesData: window._placesData || [],
        saved_at: new Date().toLocaleString()
    };

    let saved = JSON.parse(localStorage.getItem("saved_trips")) || [];
    // Remove if duplicate location
    saved = saved.filter(t => t.form.location.toLowerCase() !== parsedForm.location.toLowerCase());
    saved.unshift(newTrip);
    localStorage.setItem("saved_trips", JSON.stringify(saved));
    
    updateSavedTripsCount();
    alert("Trip saved to your local history successfully! 📂");
}

function openHistoryModal() {
    const modal = document.getElementById("historyOverlay");
    const list = document.getElementById("historyList");
    if (!modal || !list) return;

    const saved = JSON.parse(localStorage.getItem("saved_trips")) || [];
    if (saved.length === 0) {
        list.innerHTML = `<div class="empty-state">📂 No saved trips in history yet. Generate and save a trip to see it here!</div>`;
    } else {
        list.innerHTML = saved.map(t => `
            <div class="history-item">
                <div class="history-item-info">
                    <div class="history-item-dest">🌍 ${t.form.location}</div>
                    <div class="history-item-meta">
                        📅 ${t.form.days} Days &nbsp;·&nbsp; 💰 ₹${t.form.budget.toLocaleString()} (${t.form.style}) &nbsp;·&nbsp; 🎯 ${t.form.interest}
                    </div>
                    <div class="history-item-date">Saved at: ${t.saved_at}</div>
                </div>
                <div class="history-item-actions">
                    <button class="history-btn-view" onclick="loadTripFromHistory('${t.id}')">👁️ View</button>
                    <button class="history-btn-edit" onclick="editTripFromHistory('${t.id}')">✏️ Edit</button>
                    <button class="history-btn-delete" onclick="deleteTripFromHistory('${t.id}')">🗑️ Delete</button>
                </div>
            </div>
        `).join("");
    }

    modal.classList.add("active");
}

function closeHistoryModal() {
    const modal = document.getElementById("historyOverlay");
    if (modal) modal.classList.remove("active");
}

function loadTripFromHistory(id) {
    const saved = JSON.parse(localStorage.getItem("saved_trips")) || [];
    const trip = saved.find(t => t.id === id);
    if (!trip) return;

    // Save back to sessionStorage for refresh/DOM recovery
    sessionStorage.setItem("tripForm", JSON.stringify(trip.form));
    sessionStorage.setItem("tripPlan", JSON.stringify(trip.plan));
    sessionStorage.setItem("overlayOpen", "true");
    sessionStorage.setItem("placesData", JSON.stringify(trip.placesData));

    // Open overlay
    openOverlay(trip.form.location);
    
    // Render UI
    if (trip.plan.format === "json" && typeof trip.plan.reply === "object") {
        renderTripUI(trip.plan.reply, trip.form.location, trip.form.days, trip.form.budget, trip.form.style, trip.form.start);
        if (trip.placesData && trip.placesData.length) {
            initTripMap(trip.placesData, trip.form.location);
            window._placesData = trip.placesData;
            
            const firstPlace = trip.placesData.find(p => p.lat && p.lng);
            if (firstPlace) {
                fetchRealWeather(firstPlace.lat, firstPlace.lng);
            }
        }
    } else {
        const text = typeof trip.plan.reply === "string" ? trip.plan.reply : JSON.stringify(trip.plan.reply);
        document.getElementById("overlayBody").innerHTML = formatReplyLegacy(text, trip.form.location, trip.form.days, trip.form.budget);
        renderHeroBadges(trip.form.days, trip.form.budget, trip.form.style, null);
    }

    // Load nearby attractions asynchronously
    loadNearbyAttractions(trip.form.location, trip.form.start);

    closeHistoryModal();
}

function editTripFromHistory(id) {
    const saved = JSON.parse(localStorage.getItem("saved_trips")) || [];
    const trip = saved.find(t => t.id === id);
    if (!trip) return;

    document.getElementById("destination").value = trip.form.location;
    document.getElementById("start").value = trip.form.start;
    document.getElementById("days").value = trip.form.days;
    document.getElementById("budget").value = trip.form.budget;
    document.getElementById("style").value = trip.form.style;
    document.getElementById("interests").value = trip.form.interest;

    updateBudget();
    closeHistoryModal();
    alert("Loaded trip details back into form inputs! Click 'Generate Plan' to customize and regenerate.");
}

function deleteTripFromHistory(id) {
    if (!confirm("Are you sure you want to delete this trip from history?")) return;
    let saved = JSON.parse(localStorage.getItem("saved_trips")) || [];
    saved = saved.filter(t => t.id !== id);
    localStorage.setItem("saved_trips", JSON.stringify(saved));
    
    updateSavedTripsCount();
    openHistoryModal(); // Refresh modal
}

// ── NEARBY ATTRACTIONS DISCOVERY ──────────────────────────────────
async function loadNearbyAttractions(destination, start) {
    const container = document.getElementById("nearbyContainer");
    if (!container) return;
    
    container.innerHTML = `
        <div class="skeleton-grid">
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        </div>`;
        
    try {
        const res = await fetch("/nearby-attractions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ destination, start })
        });
        const data = await res.json();
        if (data.places && data.places.length) {
            window._nearbyPlaces = data.places;
            renderNearbyGrid(data.places);
        } else {
            container.innerHTML = `<div class="empty-state">📍 No nearby attractions found within 50 km.</div>`;
        }
    } catch (e) {
        container.innerHTML = `<div class="empty-state">⚠️ Failed to load nearby attractions.</div>`;
    }
}

function renderNearbyGrid(places) {
    const container = document.getElementById("nearbyContainer");
    
    // Read current filter selectors
    const distFilter = document.getElementById("nearby-distance-filter") ? parseFloat(document.getElementById("nearby-distance-filter").value) : 50;
    const catFilter = document.getElementById("nearby-category-filter") ? document.getElementById("nearby-category-filter").value : "all";
    
    const filtered = places.filter(p => {
        if (p.distance_km && p.distance_km > distFilter) return false;
        if (catFilter !== "all" && p.category && p.category.toLowerCase() !== catFilter.toLowerCase()) return false;
        return true;
    });
    
    let html = `
        <div class="nearby-header-section">
            <div class="nearby-header">
                <h3>📍 Attractions Near ${window._hotelsDestination || 'Destination'}</h3>
            </div>
            
            <div class="nearby-filters">
                <div class="filter-group">
                    <label>Radius:</label>
                    <select id="nearby-distance-filter" onchange="renderNearbyGrid(window._nearbyPlaces)">
                        <option value="50" ${distFilter === 50 ? 'selected' : ''}>Within 50 km (Default)</option>
                        <option value="25" ${distFilter === 25 ? 'selected' : ''}>Within 25 km</option>
                        <option value="10" ${distFilter === 10 ? 'selected' : ''}>Within 10 km</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Category:</label>
                    <select id="nearby-category-filter" onchange="renderNearbyGrid(window._nearbyPlaces)">
                        <option value="all" ${catFilter === 'all' ? 'selected' : ''}>All Categories</option>
                        <option value="nature" ${catFilter === 'nature' ? 'selected' : ''}>Nature</option>
                        <option value="adventure" ${catFilter === 'adventure' ? 'selected' : ''}>Adventure</option>
                        <option value="historical" ${catFilter === 'historical' ? 'selected' : ''}>Historical</option>
                        <option value="religious" ${catFilter === 'religious' ? 'selected' : ''}>Religious</option>
                        <option value="food" ${catFilter === 'food' ? 'selected' : ''}>Food</option>
                        <option value="relaxation" ${catFilter === 'relaxation' ? 'selected' : ''}>Relaxation</option>
                    </select>
                </div>
            </div>
        </div>
    `;
    
    if (filtered.length === 0) {
        html += `<div class="empty-state">📍 No attractions match the filter criteria.</div>`;
    } else {
        html += `
        <div class="nearby-grid">
            ${filtered.map((p, i) => {
                const stars = '★'.repeat(Math.min(5, Math.floor(p.rating || 4))) + '☆'.repeat(5 - Math.min(5, Math.floor(p.rating || 4)));
                const mapLink = p.maps_link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}`;
                return `
                <div class="nearby-card" style="animation-delay:${i * 0.08}s">
                    <div class="nearby-img-wrapper">
                        <img src="${p.image_url || '/static/placeholder.jpg'}" alt="${p.name}" loading="lazy">
                        <span class="nearby-distance-badge">🚗 ${p.distance_km ? p.distance_km.toFixed(1) + ' km' : '--'} (${p.travel_time || '--'})</span>
                    </div>
                    <div class="nearby-info">
                        <div class="nearby-category-tag">${p.category || 'Sightseeing'}</div>
                        <div class="nearby-name">${p.name}</div>
                        <div class="nearby-rating">${stars} <span>${p.rating || '4.0'}</span></div>
                        <div class="nearby-best-time">⏳ Best Time: <b>${p.best_time || 'Daytime'}</b></div>
                        <p class="nearby-desc">${p.description || ''}</p>
                        <div class="nearby-actions">
                            <a href="${mapLink}" target="_blank" class="nearby-btn maps-btn">🗺️ Open in Maps</a>
                            <button onclick="addNearbyToItinerary('${p.name.replace(/'/g, "\\'")}', ${p.lat}, ${p.lng})" class="nearby-btn add-btn">➕ Add to Map</button>
                        </div>
                    </div>
                </div>`;
            }).join("")}
        </div>`;
    }
    
    container.innerHTML = html;
}

function addNearbyToItinerary(name, lat, lng) {
    if (!lat || !lng || !window._tripMap) {
        alert("Cannot place this location on the map.");
        return;
    }
    
    const exists = (window._placesData || []).some(p => p.name === name);
    if (exists) {
        alert("This place is already on your map!");
        return;
    }
    
    const newPlace = {
        name: name,
        description: "Added from Nearby Attractions list.",
        category: "default",
        lat: lat,
        lng: lng,
        maps_link: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,
        image_url: `/image-proxy?q=${encodeURIComponent(name)}`
    };
    
    if (!window._placesData) window._placesData = [];
    window._placesData.push(newPlace);
    sessionStorage.setItem("placesData", JSON.stringify(window._placesData));
    
    // Reinit map
    initTripMap(window._placesData, window._hotelsDestination);
    alert(`Added "${name}" to map! check the Map in the Itinerary tab.`);
}

// Save trip as JSON file + History Save
function saveItinerary() {
    const savedPlan = sessionStorage.getItem("tripPlan");
    const savedForm = sessionStorage.getItem("tripForm");
    if (!savedPlan || !savedForm) return;
    
    // 1. Save to History
    saveTripToHistory();
    
    // 2. Download JSON File
    const combined = {
        form: JSON.parse(savedForm),
        plan: JSON.parse(savedPlan)
    };
    
    const blob = new Blob([JSON.stringify(combined, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `itinerary_${combined.form.location.toLowerCase().replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Share plan via clipboard link
function shareTrip() {
    const location = document.getElementById("heroTitle").textContent;
    const shareText = `Check out my travel plan for ${location} generated with AI Travel Planner! ✈️🌍`;
    navigator.clipboard.writeText(shareText).then(() => {
        alert("Trip link copied to clipboard! 📤");
    }).catch(err => {
        alert("Failed to copy link. Please manually copy the URL.");
    });
}

// Export as PDF using browser printing
function exportPDF() {
    window.print();
}

// Reset form
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
    // Update Saved Trips Badge
    updateSavedTripsCount();

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
                
                if (data.format === "json" && typeof data.reply === "object") {
                    const plan = data.reply;
                    renderTripUI(plan, form.location, form.days, form.budget, form.style, form.start);
                    
                    const cachedPlaces = sessionStorage.getItem("placesData");
                    if (cachedPlaces) {
                        const placesData = JSON.parse(cachedPlaces);
                        initTripMap(placesData, form.location);
                        window._placesData = placesData;
                        
                        const firstPlace = placesData.find(p => p.lat && p.lng);
                        if (firstPlace) {
                            fetchRealWeather(firstPlace.lat, firstPlace.lng);
                        }
                    }
                } else {
                    const text = typeof data.reply === "string" ? data.reply : JSON.stringify(data.reply);
                    document.getElementById("overlayBody").innerHTML = formatReplyLegacy(text, form.location, form.days, form.budget);
                    renderHeroBadges(form.days, form.budget, form.style, null);
                }
                
                // Fetch nearby attractions asynchronously
                loadNearbyAttractions(form.location, form.start);
                
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

