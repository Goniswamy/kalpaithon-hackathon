from flask import Flask, request, jsonify, render_template
import requests
import json
import re

app = Flask(__name__)
# In-memory caches for performance
_autocomplete_cache = {}
_plan_cache = {}
_geocode_cache = {}
_nearby_cache = {}
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

    if not location or not days or not budget:
        return jsonify({"error": "Missing required fields"}), 400

    # Check cache first
    cache_key = f"{location.lower().strip()}_{days}_{budget}_{style.lower().strip()}_{interest.lower().strip()}_{start.lower().strip()}"
    if cache_key in _plan_cache:
        return jsonify(_plan_cache[cache_key])

    prompt = f"""
Create an intelligent, highly optimized {days}-day travel itinerary for {location}.
Starting from: {start}
Budget: ₹{budget} ({style} style)
Interests: {interest}

Ensure the itinerary is realistic, avoiding overload. Group nearby places together to optimize travel distance and time.
Specifically select activities and sights aligned with user interests: {interest} (e.g. if Nature, prioritize parks/beaches; if Historical, focus on monuments; if Family trip, select family-safe/comfortable activities; if Food, prioritize culinary spots).

Return ONLY valid JSON (no markdown block, no explanation) with this exact structure:
{{
  "itinerary": [
    {{
      "day": 1,
      "title": "Day Title (e.g., Heritage Walks & Local Eats)",
      "description": "Brief 2-3 sentence overview of what the day covers.",
      "morning": {{
        "place": "Name of Attraction",
        "activity": "What to do there",
        "time": "Suggested time range (e.g., 9:00 AM - 11:30 AM)",
        "expense": 200,
        "timings": "Opening/closing hours (e.g., 8:00 AM - 6:00 PM)",
        "time_spent": "Estimated duration (e.g., 2.5 hours)",
        "travel_to_next": "Travel duration & distance to next spot (e.g., 15 mins (4 km))"
      }},
      "afternoon": {{
        "place": "Name of Restaurant / Attraction",
        "activity": "Lunch suggestion & explore surrounding area",
        "time": "12:30 PM - 3:30 PM",
        "expense": 350,
        "timings": "11:00 AM - 11:00 PM",
        "time_spent": "3 hours",
        "travel_to_next": "20 mins (6 km)"
      }},
      "evening": {{
        "place": "Name of Sightseeing / Relaxing Spot",
        "activity": "Evening stroll or sunset relaxation",
        "time": "4:30 PM - 7:30 PM",
        "expense": 150,
        "timings": "24/7 or 6:00 AM - 9:00 PM",
        "time_spent": "3 hours",
        "travel_to_next": "10 mins (2 km) to hotel"
      }},
      "food_suggestions": ["Lunch at specific recommended place", "Dinner at specific recommended spot"],
      "transport": "Recommended local transit mode (e.g., Auto-rickshaw / Metro)",
      "tags": ["heritage", "culture", "streetfood"],
      "day_expense": 700,
      "travel_tip": "Wear comfortable walking shoes."
    }}
  ],
  "places": [
    {{
      "name": "Attraction Name",
      "description": "Short 1-sentence description.",
      "category": "nature/adventure/historical/religious/food/relaxation"
    }}
  ],
  "hotels": {{
    "matching": [
      {{
        "name": "Hotel Name",
        "price_range": "₹Price per night (e.g., ₹2500 - ₹3500)",
        "rating": 4.2,
        "description": "Real hotel in {location} matching budget & style.",
        "distance": "Distance from center (e.g., 1.5 km)",
        "type": "budget/mid-range/luxury",
        "location": "Area name, {location}"
      }}
    ],
    "alternatives": [
      {{
        "name": "Cheap Alternative Hotel Name",
        "price_range": "₹Price per night (e.g., ₹1200 - ₹1800)",
        "rating": 3.9,
        "description": "Fallback budget-friendly hotel suggestion.",
        "distance": "Distance from center (e.g., 2.0 km)",
        "type": "budget",
        "location": "Area name, {location}"
      }}
    ]
  }},
  "budget_breakdown": {{
    "stay": 4000,
    "food": 3000,
    "transport": 2000,
    "activities": 1500,
    "misc": 1000
  }},
  "route_summary": {{
    "total_distance_km": 42,
    "total_duration_hours": 3.5,
    "optimized_order_explanation": "Attractions are ordered sequentially to avoid backtracking and minimize transit times."
  }},
  "safety_info": {{
    "hospitals": [
      {{
        "name": "Hospital Name",
        "contact": "Local phone number",
        "address": "Hospital street address"
      }}
    ],
    "safety_tips": [
      "Keep emergency contacts handy.",
      "Use official transport options rather than unregistered taxis."
    ],
    "local_info": "General local safety note: e.g., Auto drivers charge by meter, water is safe at certified restaurants."
  }},
  "tips": [
    "General useful trip tip 1",
    "General useful trip tip 2"
  ],
  "weather_summary": "Weather conditions in {location}",
  "emergency_contacts": {{
    "police": "100",
    "ambulance": "108",
    "tourist_helpline": "1363"
  }}
}}

Budget Rules:
- Calculate stay, food, transport, activities, misc breakdown based on total budget ₹{budget} and travel style '{style}'.
- The sum of stay + food + transport + activities + misc in budget_breakdown must sum up to EXACTLY ₹{budget}.
- In the "hotels" section, if the stay budget per night fits real hotels in {location}, list 3-5 real matching hotels in the "matching" array, and leave "alternatives" empty.
- If the stay budget per night is too low for matching hotels in {location}, list 0 hotels in "matching", and list 3 cheap fallback alternatives in the "alternatives" array.
- Make all descriptions, timings, and names realistic. Do not invent fake hotel names; use real ones.
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
            timeout=35
        )
        result = response.json()
        
        if "error" in result:
            return jsonify({"error": result["error"]["message"]}), 500

        raw = result["choices"][0]["message"]["content"].strip()

        # Clean markdown fences if present
        raw = re.sub(r"```json|```", "", raw).strip()
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            raw = match.group(0)

        parsed = json.loads(raw)
        
        # Structure payload
        payload = {"reply": parsed, "format": "json"}
        
        # Cache
        if len(_plan_cache) > 200:
            _plan_cache.clear()
        _plan_cache[cache_key] = payload

        return jsonify(payload)

    except json.JSONDecodeError:
        return jsonify({"reply": raw, "format": "text"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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

    search_query_key = search_query.lower().strip()
    if search_query_key in _geocode_cache:
        lat, lng = _geocode_cache[search_query_key]
    else:
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
                if len(_geocode_cache) > 1000:
                    _geocode_cache.clear()
                _geocode_cache[search_query_key] = (lat, lng)
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


@app.route("/nearby-attractions", methods=["POST"])
def nearby_attractions():
    data = request.get_json()
    destination = data.get("destination", "")
    start = data.get("start", "")
    
    if not destination:
        return jsonify({"error": "Missing destination"}), 400

    cache_key = destination.lower().strip()
    if cache_key in _nearby_cache:
        return jsonify({"places": _nearby_cache[cache_key]})

    prompt = f"""
Find 12 real, popular tourist attractions within 50 km of the center of {destination}.
For each attraction, return only real, verified places that actually exist.
Categorize each into exactly one of: nature, adventure, historical, religious, food, relaxation.
Calculate or estimate their actual distance in km from the center of {destination} (e.g., 5.4 or 22.1).
Provide the estimated travel time from the center of {destination} (e.g., "15 mins", "45 mins").
Provide a realistic rating out of 5 (e.g., 4.5).
Provide the best visiting time (e.g., "October to March", "Evening", "Monsoon season").
Provide a short 1-line description.

Return ONLY a JSON array of objects with this structure (no explanation, no markdown):
[
  {{
    "name": "Attraction Name",
    "description": "Short description.",
    "category": "nature/adventure/historical/religious/food/relaxation",
    "distance_km": 12.5,
    "travel_time": "30 mins",
    "rating": 4.6,
    "best_time": "October to March"
  }}
]
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
            timeout=25
        )
        result = response.json()
        if "error" in result:
            return jsonify({"error": result["error"]["message"]}), 500

        raw = result["choices"][0]["message"]["content"].strip()
        raw = re.sub(r"```json|```", "", raw).strip()
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            raw = match.group(0)

        attractions = json.loads(raw)
        
        # Geocode and enrich in parallel
        from concurrent.futures import ThreadPoolExecutor
        enriched = []
        
        def enrich_item(item):
            info = fetch_single_place_info(item, destination, start)
            merged = {**item, **info}
            return merged

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(enrich_item, item) for item in attractions[:15]]
            for f in futures:
                try:
                    res = f.result(timeout=8)
                    enriched.append(res)
                except Exception:
                    continue

        if len(_nearby_cache) > 200:
            _nearby_cache.clear()
        _nearby_cache[cache_key] = enriched

        return jsonify({"places": enriched})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


from flask import redirect

@app.route("/image-proxy")
def image_proxy():
    """Returns a real Wikimedia image for a query via 302 redirect."""
    query = request.args.get("q", "")
    image_url = get_wikimedia_image(query)
    return redirect(image_url)


if __name__ == "__main__":
    app.run(port=5001, debug=True)
