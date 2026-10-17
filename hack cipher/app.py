from flask import Flask, request, jsonify, render_template, redirect
import requests
from config import PORT, DEBUG
from services.geo_service import autocomplete_locations, batch_fetch_places_info
from services.ai_service import (
    generate_itinerary,
    generate_budget_preview,
    generate_nearby_attractions,
    is_ai_available
)
from services.image_service import get_wikimedia_image

app = Flask(__name__)


@app.route("/")
def home():
    """Serves the main Travel Planner web application."""
    return render_template("index.html")


@app.route("/api/status", methods=["GET"])
def system_status():
    """Returns engine availability and system status."""
    ai_status = is_ai_available()
    return jsonify({
        "status": "online",
        "ai_engine": "online_llm" if ai_status else "smart_knowledge_engine",
        "ai_engine_label": "⚡ AI Model Connected" if ai_status else "📦 Smart Knowledge Engine Ready"
    })


@app.route("/autocomplete", methods=["GET"])
def autocomplete():
    """Returns geocoded location autocomplete suggestions with icons."""
    query = request.args.get("q", "").strip()
    suggestions = autocomplete_locations(query)
    return jsonify({"suggestions": suggestions})


@app.route("/plan", methods=["POST"])
def plan():
    """Generates day-wise travel itinerary, stays, budget, and safety info."""
    data = request.get_json() or {}
    location = data.get("location", "").strip()
    days = data.get("days", 1)
    budget = data.get("budget", 15000)
    style = data.get("style", "Mid-range")
    interest = data.get("interest", "Nature & Sightseeing")
    start = data.get("start", "Home")

    if not location:
        return jsonify({"error": "Destination location is required."}), 400

    try:
        payload = generate_itinerary(location, days, budget, style, interest, start)
        return jsonify(payload)
    except Exception as e:
        return jsonify({"error": f"Failed to generate travel plan: {str(e)}"}), 500


@app.route("/budget-preview", methods=["POST"])
def budget_preview():
    """Calculates live estimated budget distribution across 5 categories."""
    data = request.get_json() or {}
    location = data.get("location", "").strip()
    days = data.get("days", 1)
    budget = data.get("budget", 5000)
    style = data.get("style", "Mid-range")
    start = data.get("start", "Not specified")

    preview = generate_budget_preview(location, days, budget, style, start)
    return jsonify(preview)


@app.route("/geocode", methods=["POST"])
def geocode():
    """Geocodes a simple list of place names."""
    data = request.get_json() or {}
    places = data.get("places", [])
    results = []

    for place in places[:10]:
        try:
            resp = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": place, "format": "json", "limit": 1},
                headers={"User-Agent": "SmartTravelPlanner/2.0"},
                timeout=3.5
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


@app.route("/places-info", methods=["POST"])
def places_info():
    """Batch-fetches coordinates, Google Maps links, and high-res images in parallel."""
    data = request.get_json() or {}
    places = data.get("places", [])
    destination = data.get("destination", "")
    start = data.get("start", "")

    enriched = batch_fetch_places_info(places, destination, start)
    return jsonify({"places": enriched})


@app.route("/nearby-attractions", methods=["POST"])
def nearby_attractions():
    """Returns real attractions within 50 km of destination with distance and imagery."""
    data = request.get_json() or {}
    destination = data.get("destination", "").strip()
    start = data.get("start", "").strip()

    if not destination:
        return jsonify({"error": "Missing destination parameter"}), 400

    try:
        attractions = generate_nearby_attractions(destination, start)
        return jsonify({"places": attractions})
    except Exception as e:
        return jsonify({"error": f"Failed to fetch nearby attractions: {str(e)}"}), 500


@app.route("/image-proxy")
def image_proxy():
    """Fetches high-res Wikipedia/Wikimedia/thematic travel photo via 302 redirect."""
    query = request.args.get("q", "")
    image_url = get_wikimedia_image(query)
    return redirect(image_url)


if __name__ == "__main__":
    app.run(port=PORT, debug=DEBUG)
