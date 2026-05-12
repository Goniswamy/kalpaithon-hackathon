from flask import Flask, request, jsonify, render_template
import requests
import json
import re

app = Flask(__name__)
OPENROUTER_API_KEY = "API_KEY"

@app.route("/")
def home():
    return render_template("index.html")

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
      "activities": [
        "Morning: Arrive and check in to hotel",
        "Afternoon: Visit local market",
        "Evening: Dinner at popular restaurant"
      ]
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
  ]
}}

Rules:
- Include 5-8 places in the places array
- Include 3-5 hotels matching the {style} travel style
- Budget breakdown must add up to ₹{budget}
- All arrays must have at least 2 items
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


def get_wikimedia_image(query):
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
                return pages[page_id]["imageinfo"][0]["url"]
    except Exception:
        pass
    return "https://loremflickr.com/800/600/travel/all"  # Fallback

@app.route("/places-info", methods=["POST"])
def places_info():
    """
    Takes a list of place names + destination context.
    Returns geocoded coords, REAL Wikimedia image URLs, and Google Maps links.
    """
    data = request.get_json()
    places = data.get("places", [])
    destination = data.get("destination", "")
    start = data.get("start", "")
    results = []

    for place_obj in places[:10]:
        name = place_obj if isinstance(place_obj, str) else place_obj.get("name", "")
        desc = "" if isinstance(place_obj, str) else place_obj.get("description", "")
        category = "" if isinstance(place_obj, str) else place_obj.get("category", "")

        search_query = f"{name}, {destination}" if destination else name

        # Geocode via Nominatim
        lat, lng = None, None
        try:
            import time
            time.sleep(1) # Respect Nominatim rate limit
            resp = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": search_query, "format": "json", "limit": 1},
                headers={"User-Agent": "TripPlannerApp/1.0"},
                timeout=5
            )
            geo = resp.json()
            if geo:
                lat = float(geo[0]["lat"])
                lng = float(geo[0]["lon"])
        except Exception:
            pass

        # Build Google Maps links
        encoded_name = requests.utils.quote(search_query)
        maps_link = f"https://www.google.com/maps/search/?api=1&query={encoded_name}"
        directions_link = ""
        if start:
            encoded_start = requests.utils.quote(start)
            directions_link = f"https://www.google.com/maps/dir/?api=1&origin={encoded_start}&destination={encoded_name}"

        # Real Image via Wikimedia
        image_url = get_wikimedia_image(f"{name} {destination}")

        results.append({
            "name": name,
            "description": desc,
            "category": category,
            "lat": lat,
            "lng": lng,
            "maps_link": maps_link,
            "directions_link": directions_link,
            "image_url": image_url
        })

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
