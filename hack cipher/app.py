from flask import Flask, request, jsonify, render_template
import requests
import json
import re

app = Flask(__name__)
# In-memory cache for autocomplete results (simple TTL-less cache for performance)
_autocomplete_cache = {}
OPENROUTER_API_KEY = ""

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

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{{
  "itinerary": [
    {{
      "day": 1,
      "title": "Arrival & Exploration",
      "description": "A brief 2-3 sentence summary of the entire day.",
      "morning": {{
        "activity": "Visit the famous temple complex",
        "place": "Place Name",
        "time": "9:00 AM - 12:00 PM",
        "expense": 500
      }},
      "afternoon": {{
        "activity": "Explore the local markets and have lunch",
        "place": "Place Name",
        "time": "12:30 PM - 4:00 PM",
        "expense": 800
      }},
      "evening": {{
        "activity": "Sunset views and dinner at a rooftop restaurant",
        "place": "Place Name",
        "time": "5:00 PM - 9:00 PM",
        "expense": 600
      }},
      "food_suggestions": ["Street food at Market", "Lunch at Restaurant"],
      "transport": "Auto-rickshaw / walking",
      "tags": ["heritage", "food", "culture"],
      "day_expense": 1900,
      "travel_tip": "Wear comfortable shoes for narrow lanes"
    }}
  ],
  "places": [
    {{
      "name": "Place Name",
      "description": "Brief 1-line description",
      "category": "temple/beach/nature/market/monument/park/museum"
    }}
  ],
  "hotels": [
    {{
      "name": "Hotel Name",
      "price_range": "₹1500 - ₹3000 per night",
      "rating": 4.2,
      "description": "Brief 1-line description of the hotel",
      "distance": "2 km from city center",
      "type": "budget/mid-range/luxury"
    }}
  ],
  "budget_breakdown": {{
    "stay": 0,
    "food": 0,
    "transport": 0,
    "activities": 0,
    "misc": 0
  }},
  "tips": [
    "Useful travel tip 1",
    "Useful travel tip 2"
  ],
  "weather_summary": "Hot and humid, 32-38°C, partly cloudy",
  "emergency_contacts": {{
    "police": "100",
    "ambulance": "108",
    "tourist_helpline": "1363"
  }}
}}

Rules:
- Include 5-8 places in the places array
- Include 3-5 hotels matching the {style} travel style
- Budget breakdown must add up to ₹{budget}
- All arrays must have at least 2 items
- Each itinerary day MUST have morning, afternoon, evening objects with activity, place, time, expense
- Each day MUST have food_suggestions (2 items), transport, tags (2-3 items), day_expense, travel_tip
- Return ONLY the JSON object, nothing else
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


@app.route("/geocode", methods=["POST"])
def geocode():
    data = request.get_json()
    places = data.get("places", [])
    results = []

    for place in places[:10]:  # limit to 10 places
        try:
            resp = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": place, "format": "json", "limit": 1},
                headers={"User-Agent": "TripPlannerApp/1.0"},
                timeout=5
            )
            geo = resp.json()
            if geo:
                results.append({
                    "name": place,
                    "lat": float(geo[0]["lat"]),
                    "lng": float(geo[0]["lon"])
                })
        except Exception:
            continue

    return jsonify({"locations": results})


_image_cache = {}

def get_wikimedia_image(query):
    query_key = query.lower().strip()
    if query_key in _image_cache:
        return _image_cache[query_key]

    url = "https://commons.wikimedia.org/w/api.php"
    params = {
        "action": "query",
        "generator": "search",
        "gsrnamespace": 6,
        "gsrsearch": query,
        "gsrlimit": 1,
        "prop": "imageinfo",
        "iiprop": "url",
        "format": "json"
    }
    headers = {"User-Agent": "TripPlannerApp/1.0"}
    try:
        r = requests.get(url, params=params, headers=headers, timeout=5).json()
        pages = r.get("query", {}).get("pages", {})
        if pages:
            for page_id in pages:
                img_url = pages[page_id]["imageinfo"][0]["url"]
                # Bounded cache
                if len(_image_cache) > 1000:
                    _image_cache.clear()
                _image_cache[query_key] = img_url
                return img_url
    except Exception:
        pass
    
    fallback = "https://loremflickr.com/800/600/travel/all"
    _image_cache[query_key] = fallback
    return fallback


def fetch_single_place_info(place_obj, destination, start):
    name = place_obj if isinstance(place_obj, str) else place_obj.get("name", "")
    desc = "" if isinstance(place_obj, str) else place_obj.get("description", "")
    category = "" if isinstance(place_obj, str) else place_obj.get("category", "")

    search_query = f"{name}, {destination}" if destination else name

    # Geocode via Photon (faster, no sleep)
    lat, lng = None, None
    try:
        resp = requests.get(
            "https://photon.komoot.io/api/",
            params={"q": search_query, "limit": 1},
            headers={"User-Agent": "TripPlannerApp/1.0"},
            timeout=4
        )
        geo = resp.json()
        if geo.get("features"):
            coords = geo["features"][0]["geometry"]["coordinates"]
            lat = coords[1]
            lng = coords[0]
    except Exception:
        pass

    # Build Maps links
    encoded_name = requests.utils.quote(search_query)
    maps_link = f"https://www.google.com/maps/search/?api=1&query={encoded_name}"
    directions_link = ""
    if start:
        encoded_start = requests.utils.quote(start)
        directions_link = f"https://www.google.com/maps/dir/?api=1&origin={encoded_start}&destination={encoded_name}"

    # Wikimedia image
    image_url = get_wikimedia_image(f"{name} {destination}")

    return {
        "name": name,
        "description": desc,
        "category": category,
        "lat": lat,
        "lng": lng,
        "maps_link": maps_link,
        "directions_link": directions_link,
        "image_url": image_url
    }


@app.route("/places-info", methods=["POST"])
def places_info():
    """
    Takes a list of place names + destination context.
    Returns geocoded coords, REAL Wikimedia image URLs, and Google Maps links.
    All fetched in parallel using a thread pool.
    """
    data = request.get_json()
    places = data.get("places", [])
    destination = data.get("destination", "")
    start = data.get("start", "")
    
    from concurrent.futures import ThreadPoolExecutor
    
    results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(fetch_single_place_info, p, destination, start) for p in places[:10]]
        for f in futures:
            try:
                res = f.result(timeout=8)
                results.append(res)
            except Exception:
                continue

    return jsonify({"places": results})


from flask import redirect

@app.route("/image-proxy")
def image_proxy():
    """Returns a real Wikimedia image for a query via 302 redirect."""
    query = request.args.get("q", "")
    image_url = get_wikimedia_image(query)
    return redirect(image_url)


if __name__ == "__main__":
    app.run(port=5001, debug=True)
