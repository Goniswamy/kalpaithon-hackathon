import requests
from concurrent.futures import ThreadPoolExecutor
from config import USER_AGENT, AUTOCOMPLETE_CACHE_MAX, GEOCODE_CACHE_MAX
from services.image_service import get_wikimedia_image

_autocomplete_cache = {}
_geocode_cache = {}


def autocomplete_locations(query: str):
    """
    Location autocomplete using Photon (OpenStreetMap geocoder).
    Returns list of suggestion dictionaries with coordinates, icons, and formatted labels.
    """
    clean_query = query.strip()
    if len(clean_query) < 2:
        return []

    cache_key = clean_query.lower()
    if cache_key in _autocomplete_cache:
        return _autocomplete_cache[cache_key]

    try:
        resp = requests.get(
            "https://photon.komoot.io/api/",
            params={"q": clean_query, "limit": 7, "lang": "en"},
            headers={"User-Agent": USER_AGENT},
            timeout=4
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

            primary = name or city
            if not primary:
                continue

            parts = [primary]
            if state and state != primary:
                parts.append(state)
            if country:
                parts.append(country)
            display = ", ".join(parts)

            dedup_key = display.lower()
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            icon = "📍"
            if osm_type in ("city", "town", "village"):
                icon = "🏙️"
            elif osm_type in ("state", "region"):
                icon = "🗺️"
            elif osm_type == "country":
                icon = "🌍"

            suggestions.append({
                "display": display,
                "value": primary,
                "secondary": ", ".join(parts[1:]) if len(parts) > 1 else "",
                "icon": icon,
                "lat": coords[1] if len(coords) > 1 else None,
                "lng": coords[0] if len(coords) > 0 else None,
            })

        # Cache with LRU-style trim
        if len(_autocomplete_cache) > AUTOCOMPLETE_CACHE_MAX:
            keys = list(_autocomplete_cache.keys())
            for k in keys[: AUTOCOMPLETE_CACHE_MAX // 2]:
                del _autocomplete_cache[k]
        _autocomplete_cache[cache_key] = suggestions
        return suggestions

    except Exception:
        return []


def fetch_single_place_info(place_obj, destination="", start=""):
    """
    Enriches a place object with coordinates, Google Maps links, and high-res imagery.
    Guarantees no UnboundLocalError by strictly initializing lat/lng.
    """
    name = place_obj if isinstance(place_obj, str) else place_obj.get("name", "")
    desc = "" if isinstance(place_obj, str) else place_obj.get("description", "")
    category = "" if isinstance(place_obj, str) else place_obj.get("category", "")
    timings = "" if isinstance(place_obj, str) else place_obj.get("timings", "")
    time_spent = "" if isinstance(place_obj, str) else place_obj.get("time_spent", "")

    search_query = f"{name}, {destination}" if destination else name
    search_query_key = search_query.lower().strip()

    # Safely initialize coordinates
    lat = None
    lng = None

    if search_query_key in _geocode_cache:
        lat, lng = _geocode_cache[search_query_key]
    else:
        # Attempt 1: Photon geocoder
        try:
            resp = requests.get(
                "https://photon.komoot.io/api/",
                params={"q": search_query, "limit": 1},
                headers={"User-Agent": USER_AGENT},
                timeout=3.5
            )
            geo = resp.json()
            if geo.get("features"):
                coords = geo["features"][0]["geometry"]["coordinates"]
                lng = coords[0]
                lat = coords[1]
                _save_geocode_cache(search_query_key, lat, lng)
        except Exception:
            pass

        # Attempt 2: Nominatim fallback if Photon had no features
        if lat is None or lng is None:
            try:
                resp = requests.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": search_query, "format": "json", "limit": 1},
                    headers={"User-Agent": USER_AGENT},
                    timeout=3.0
                )
                geo_list = resp.json()
                if geo_list:
                    lat = float(geo_list[0]["lat"])
                    lng = float(geo_list[0]["lon"])
                    _save_geocode_cache(search_query_key, lat, lng)
            except Exception:
                pass

    # Build Maps links
    encoded_name = requests.utils.quote(search_query)
    maps_link = f"https://www.google.com/maps/search/?api=1&query={encoded_name}"
    directions_link = ""
    if start:
        encoded_start = requests.utils.quote(start)
        directions_link = f"https://www.google.com/maps/dir/?api=1&origin={encoded_start}&destination={encoded_name}"

    # Fetch high-res image
    image_url = get_wikimedia_image(f"{name} {destination}")

    return {
        "name": name,
        "description": desc,
        "category": category,
        "lat": lat,
        "lng": lng,
        "maps_link": maps_link,
        "directions_link": directions_link,
        "image_url": image_url,
        "timings": timings,
        "time_spent": time_spent
    }


def _save_geocode_cache(key: str, lat, lng):
    global _geocode_cache
    if len(_geocode_cache) > GEOCODE_CACHE_MAX:
        keys = list(_geocode_cache.keys())
        for k in keys[: GEOCODE_CACHE_MAX // 2]:
            del _geocode_cache[k]
    _geocode_cache[key] = (lat, lng)


def batch_fetch_places_info(places, destination="", start="", max_workers=10):
    """Fetches geocode, image, and maps details concurrently using a ThreadPoolExecutor."""
    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(fetch_single_place_info, p, destination, start) for p in places[:15]]
        for f in futures:
            try:
                res = f.result(timeout=6.0)
                if res:
                    results.append(res)
            except Exception:
                continue
    return results
