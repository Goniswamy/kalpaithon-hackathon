import re
import urllib.parse
import requests
from config import USER_AGENT, IMAGE_CACHE_MAX

_image_cache = {}

# Curated high-resolution travel photography backups (guaranteed valid CDN URLs)
THEMATIC_FALLBACKS = {
    "beach": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    "mountain": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
    "nature": "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80",
    "heritage": "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80",
    "temple": "https://images.unsplash.com/photo-1590766940554-634a7ed41450?auto=format&fit=crop&w=1200&q=80",
    "city": "https://images.unsplash.com/photo-1477959858617-67f30bc75b82?auto=format&fit=crop&w=1200&q=80",
    "adventure": "https://images.unsplash.com/photo-1533240332313-0db49b459ad6?auto=format&fit=crop&w=1200&q=80",
    "food": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
    "hotel": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
    "default": "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80"
}


def get_thematic_fallback(query: str) -> str:
    """Returns a curated high-res travel image URL matching keywords in query."""
    q_lower = query.lower()
    for key, url in THEMATIC_FALLBACKS.items():
        if key in q_lower:
            return url
    if any(w in q_lower for w in ("resort", "stay", "inn", "lodge")):
        return THEMATIC_FALLBACKS["hotel"]
    if any(w in q_lower for w in ("sea", "ocean", "island", "coast")):
        return THEMATIC_FALLBACKS["beach"]
    if any(w in q_lower for w in ("hill", "trek", "himalaya", "valley")):
        return THEMATIC_FALLBACKS["mountain"]
    if any(w in q_lower for w in ("fort", "palace", "monument", "historic", "museum")):
        return THEMATIC_FALLBACKS["heritage"]
    return THEMATIC_FALLBACKS["default"]


def get_wikimedia_image(query: str) -> str:
    """
    Finds a verified, high-resolution photo for any place or attraction:
    1. Wikipedia Page Summary API (fastest, curated article image)
    2. Wikimedia Commons search API (commons image database)
    3. Curated Unsplash thematic photography fallback
    """
    clean_query = query.strip()
    if not clean_query:
        return THEMATIC_FALLBACKS["default"]

    query_key = clean_query.lower()
    if query_key in _image_cache:
        return _image_cache[query_key]

    headers = {"User-Agent": USER_AGENT}

    # Strategy 1: Wikipedia REST Page Summary API
    # Clean the title (e.g. remove "hotel", "travel banner scenic cinematic", etc.)
    cleaned_title = re.sub(
        r"\b(hotel|stays|travel|banner|scenic|cinematic|popular|spot|sightseeing)\b",
        "",
        clean_query,
        flags=re.IGNORECASE
    ).strip()
    cleaned_title = re.sub(r"\s+", " ", cleaned_title).strip()
    first_term = cleaned_title.split(",")[0].strip() if cleaned_title else clean_query

    for candidate in [first_term, clean_query.split(",")[0].strip()]:
        if not candidate:
            continue
        wiki_title = urllib.parse.quote(candidate.replace(" ", "_"))
        try:
            summary_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{wiki_title}"
            r = requests.get(summary_url, headers=headers, timeout=3.5)
            if r.status_code == 200:
                data = r.json()
                if "originalimage" in data and "source" in data["originalimage"]:
                    img_url = data["originalimage"]["source"]
                    _cache_image(query_key, img_url)
                    return img_url
                elif "thumbnail" in data and "source" in data["thumbnail"]:
                    # Upgrade thumbnail size if possible
                    thumb_url = data["thumbnail"]["source"]
                    high_res = re.sub(r"/\d+px-", "/1200px-", thumb_url)
                    _cache_image(query_key, high_res)
                    return high_res
        except Exception:
            pass

    # Strategy 2: Wikimedia Commons Search
    try:
        commons_url = "https://commons.wikimedia.org/w/api.php"
        search_query = first_term or clean_query
        params = {
            "action": "query",
            "generator": "search",
            "gsrnamespace": 6,
            "gsrsearch": search_query,
            "gsrlimit": 1,
            "prop": "imageinfo",
            "iiprop": "url",
            "format": "json"
        }
        r = requests.get(commons_url, params=params, headers=headers, timeout=3.5).json()
        pages = r.get("query", {}).get("pages", {})
        if pages:
            for page_id in pages:
                info = pages[page_id].get("imageinfo", [])
                if info and "url" in info[0]:
                    img_url = info[0]["url"]
                    # Ensure it is an image extension
                    if any(img_url.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp")):
                        _cache_image(query_key, img_url)
                        return img_url
    except Exception:
        pass

    # Strategy 3: Beautiful curated fallback
    fallback_url = get_thematic_fallback(clean_query)
    _cache_image(query_key, fallback_url)
    return fallback_url


def _cache_image(key: str, url: str):
    global _image_cache
    if len(_image_cache) > IMAGE_CACHE_MAX:
        # Keep recent half
        keys = list(_image_cache.keys())
        for k in keys[: IMAGE_CACHE_MAX // 2]:
            del _image_cache[k]
    _image_cache[key] = url
