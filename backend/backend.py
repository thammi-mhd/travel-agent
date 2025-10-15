from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import google.generativeai as genai

# ---------- Config ----------
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

def initialize_gemini():
    #set the api key in the environment as environment variable named as gen_ai
    api_key = os.environ.get("gen_ai") 
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(GEMINI_MODEL)

app = Flask(__name__)

# ---------- CORS ----------
CORS(
    app,
    resources={r"/api/*": {"origins": "*"}},
    supports_credentials=False,
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

@app.after_request
def add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp

# ---------- Gemini init ----------
try:
    gemini_model = initialize_gemini()
except Exception as e:
    print("Gemini init failed:", e)
    gemini_model = None

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": GEMINI_MODEL, "ready": gemini_model is not None}), 200

@app.route("/api/generate-plan", methods=["OPTIONS"])
def generate_plan_options():
    return ("", 204)

@app.route("/api/generate-plan", methods=["POST"])
def generate_plan():
    if not gemini_model:
        return jsonify({"error": "Gemini model not initialized"}), 500

    data = request.get_json() or {}
    required_fields = ["destination", "departureDate", "returnDate", "travelers"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    starting_city = data.get("startingCity", "Unknown")
    transport = data.get("transport", "auto")  # auto | bus | train | plane | personal

    prompt = f"""
You are a travel planner AI. First, decide transport from a starting city in India to the destination, then generate a day-wise itinerary.

User details:
- Starting City: {starting_city}
- Destination: {data['destination']}
- Departure Date: {data['departureDate']}
- Return Date: {data['returnDate']}
- Number of Travelers: {data['travelers']}
- Preferred Transport (optional): {transport}
- Special Preferences: {data.get('preferences', 'None')}

Transport rules (India):
- If straight-line or driving distance ≤ 200 km: recommend bus/train over plane unless user explicitly prefers plane.
- If distance > 200 km: recommend plane for time efficiency; bus/train can be secondary options.
- Personal vehicle is valid anytime; if chosen, include driving route hints and safe stopovers for long drives.

Pricing guidance (estimates, INR, per person one-way unless noted):
- bus: ₹3–₹5 per km
- train: ₹0.8–₹2 per km (2S/SL approx)
- plane: ₹2500–₹7000 typical domestic (city-pair dependent)
- personal_vehicle: ₹7–₹12 per km fuel estimate (total fuel = rate × distance; optionally divide by occupants if sharing)

Road-trip logic:
- If personal vehicle or a long bus/train leg, include a brief route summary (NH/expressway names where applicable).
- If drive time for a day segment > 8–10 hours, recommend a safe midway stay with a city/town and a budget accommodation hint.
- If notable POIs lie near the corridor, suggest a quick stop (max 1–2) on the way.

Output format: Return only JSON, no extra text. Keep strings concise and route.summary under 120 characters; corridor_pois as short names.
{{
  "trip_meta": {{
    "start": "{starting_city}",
    "destination": "{data['destination']}",
    "distance_km_estimate": 0,
    "recommended_transport": "train",
    "user_transport_choice": "{transport}",
    "pricing": {{
      "mode": "train",
      "avg_price_per_person_one_way_inr": 0,
      "round_trip": true,
      "travelers": {data['travelers']},
      "total_estimated_inr": 0
    }},
    "route": {{
      "summary": "",
      "drive_hours_estimate": 0,
      "midway_stay_recommendation": "",
      "corridor_pois": []
    }}
  }},
  "days": [
    {{
      "day": "1",
      "theme": "Theme for day 1",
      "places": [
        {{
          "place_no": "1",
          "place_name": "Place name",
          "description": "Short description",
          "activity": "Suggested activity",
          "best_time_to_visit": "Time window"
        }}
      ]
    }}
  ]
}}

Rules:
- Calculate trip length from dates (max 14 days). If > 14, respond with: "For trips longer than 14 days, consider exploring nearby cities or regions to make the most of your travel experience. as we are currently only recommend for only  for four days sorry for the inconvenience"
- Reject destinations outside India: "Sorry, I currently only provide travel plans for destinations within India."
- Reject celestial bodies: "Sorry, I don't have information on that destination."
- If start date > end date: "Trip duration must be at least 1 day."
- If Preferred Transport is provided and not "auto", use it as user_transport_choice; still set recommended_transport per rules.
- Keep numbers realistic; distance_km_estimate can be approximate. Use round_trip = true if a return is implied.
- Do not include any text outside the JSON.
"""

    try:
        chat = gemini_model.start_chat()
        result = chat.send_message(prompt)
        text = getattr(result, "text", str(result))
        return jsonify({"plan": text}), 200
    except Exception as e:
        print("Gemini API error:", e)
        return jsonify({"error": "Failed to generate plan"}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
