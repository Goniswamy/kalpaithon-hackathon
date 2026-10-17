import os

# API Keys - prioritize environment variables, fallback to empty string
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()

# Server Configuration
PORT = int(os.environ.get("PORT", 5001))
DEBUG = os.environ.get("FLASK_DEBUG", "True").lower() in ("true", "1", "yes")

# Request Headers
USER_AGENT = "SmartTravelPlanner/2.0 (hackathon-ai-travel-planner)"

# Cache Limits
AUTOCOMPLETE_CACHE_MAX = 500
PLAN_CACHE_MAX = 200
GEOCODE_CACHE_MAX = 1000
IMAGE_CACHE_MAX = 1000
NEARBY_CACHE_MAX = 200
