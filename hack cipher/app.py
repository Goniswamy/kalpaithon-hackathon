from flask import Flask, request, jsonify, render_template
import requests

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/plan", methods=["POST"])
def plan():
    data = request.json

    location = data["location"]
    days = data["days"]
    budget = data["budget"]
    interest = data["interest"]

    prompt = f"""
    Create a {days}-day travel plan for {location}.
    Budget: ₹{budget}
    Interest: {interest}

    Give:
    Day-wise itinerary
    Top places
    Budget breakdown
    """

    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "llama3",
            "prompt": prompt,
            "stream": False
        }
    )

    result = response.json()
    return jsonify({"reply": result["response"]})

if __name__ == "__main__":
    app.run(port=5001, debug=True)