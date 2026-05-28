from flask import Flask, request, jsonify, render_template
import requests
import json
import re

app = Flask(__name__)
OPENROUTER_API_KEY = "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"

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/autocomplete", methods=["GET"])
def autocomplete():
    """
    City/location autocomplete using Photon (OpenStreetMap-based geocoder).
    Free, no API key needed, fast responses, global coverage.
    """
    query = request.args.get("q", "").strip()
    if len(query) < 2:
        return jsonify({"suggestions": []})

    # Check cache first
    cache_key = query.lower()
    if cache_key in _autocomplete_cache:
        return jsonify({"suggestions": _autocomplete_cache[cache_key]})

    try:
        resp = requests.get(
            "https://photon.komoot.io/api/",
            params={
                "q": query,
                "limit": 7,
                "lang": "en",
            },
            headers={"User-Agent": "TripPlannerApp/1.0"},
            timeout=4,
        )
        data = resp.json()
        suggestions = []
        seen = set()

        for feature in data.get("features", []):
            props = feature.get("properties", {})
            coords = feature.get("geometry", {}).get("coordinates", [None, None])

            name = props.get("name", "")
            city = props.get("city", "")
            state = props.get("state", "")
            country = props.get("country", "")
            osm_type = props.get("type", "")

            # Build display text
            primary = name or city
            if not primary:
                continue

            parts = [primary]
            if state and state != primary:
                parts.append(state)
            if country:
                parts.append(country)
            display = ", ".join(parts)

            # Deduplicate
            dedup_key = display.lower()
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            # Determine icon based on type
            icon = "📍"
            if osm_type in ("city", "town", "village"):
                icon = "🏙️"
            elif osm_type in ("state", "region"):
                icon = "🗺️"
            elif osm_type in ("country"):
                icon = "🌍"

            suggestions.append({
                "display": display,
                "value": primary,
                "secondary": ", ".join(parts[1:]) if len(parts) > 1 else "",
                "icon": icon,
                "lat": coords[1] if len(coords) > 1 else None,
                "lng": coords[0] if len(coords) > 0 else None,
            })

        # Cache results (limit cache size)
        if len(_autocomplete_cache) > 500:
            _autocomplete_cache.clear()
        _autocomplete_cache[cache_key] = suggestions

        return jsonify({"suggestions": suggestions})

    except Exception as e:
        return jsonify({"suggestions": [], "error": str(e)})

@app.route("/plan", methods=["POST"])
def plan():
    data = request.get_json()
    location = data.get("location")
    days = data.get("days")
    budget = data.get("budget")
    style = data.get("style")
    interest = data.get("interest")
    start = data.get("start", "not specified")

    prompt = f"""
    Create a {days}-day travel plan for {location}.
    Starting from: {start}
    Budget: ₹{budget} ({style} style)
    Interests: {interest}
    Give:
    1. Day-wise itinerary
    2. Top places to visit
    3. Budget breakdown
    4. Tips for the traveler
    """
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "openai/gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.4
            },
            timeout=30
        )
        result = response.json()
        raw = result["choices"][0]["message"]["content"].strip()

        # Clean markdown fences if present
        raw = re.sub(r"```json|```", "", raw).strip()
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            raw = match.group(0)

        parsed = json.loads(raw)
        return jsonify({"reply": parsed, "format": "json"})

    except json.JSONDecodeError:
        # Fallback: return raw text if JSON parsing fails
        return jsonify({"reply": raw, "format": "text"})
    except Exception as e:
        return jsonify({"error": str(e)})


@app.route("/budget-preview", methods=["POST"])
def budget_preview():
    data = request.get_json()
    location = data.get("location", "")
    days     = int(data.get("days", 1))
    budget   = int(data.get("budget", 5000))
    style    = data.get("style", "Mid-range")
    start    = data.get("start", "Not specified")

    prompt = f"""
You are a travel budget estimator for Indian travelers.

Trip: {location} | From: {start} | Days: {days} | Budget: ₹{budget} | Style: {style}

Rules:
- Stay cost scales with number of nights (x{days}). Higher for metros/international, lower for Tier-2 cities.
- Food scales with days (x{days}). Street food cities like Varanasi are cheaper.
- Transport depends on distance from {start} to {location}. International = very high.
- Activities depend on destination type (nature, culture, beach, etc).
- Misc = 5-8% of total budget.
- All five values must add up to exactly ₹{budget}.

Return ONLY valid JSON, no explanation, no markdown:
{{
  "stay": 0,
  "food": 0,
  "transport": 0,
  "activities": 0,
  "misc": 0,
  "location_type": "e.g. Tier-2 Heritage City"
}}
"""
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "openai/gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3
            },
            timeout=15
        )
        result = response.json()

        if "error" in result:
            return jsonify({"error": result["error"]["message"]})

        raw = result["choices"][0]["message"]["content"].strip()
        raw = re.sub(r"```json|```", "", raw).strip()

        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            raw = match.group(0)

        parsed = json.loads(raw)
        return jsonify(parsed)

    except Exception as e:
        return jsonify({"error": str(e)})


if __name__ == "__main__":
    app.run(port=5001, debug=True)
