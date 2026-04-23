from flask import Flask, request, jsonify, render_template
import requests

app = Flask(__name__)

OPENROUTER_API_KEY = "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"  # ← paste your key

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
                "messages": [{"role": "user", "content": prompt}]
            }
        )

        result = response.json()
        reply = result["choices"][0]["message"]["content"]

    except Exception as e:
        reply = f"Error: {str(e)}"

    return jsonify({"reply": reply})

if __name__ == "__main__":
    app.run(port=5016, debug=True)
