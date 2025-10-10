# ✈️ Travel Agent: Personalized Itinerary Planner 🇮🇳

**Travel Agent** is a smart, full-stack application that transforms simple travel inputs (destination, dates, travelers) into **highly personalized, day-by-day itineraries** for destinations within **India**.

It intelligently factors in **transport mode, distance, estimated costs, route logistics,** and **en-route points of interest** to give you the most comprehensive and optimized plan.

-----

## ✨ Project Status & Highlights

| Category | Status | Details |
| :--- | :--- | :--- |
| **Current Status** | 🟢 **Working Now** | Core feature (plan generation) is functional. |
| **Backend** | `Python` / `Flask` | API endpoint: `/api/generate-plan`. |
| **Core Integration** | **LLM-Driven** | The core intelligence for trip planning. |
| **UI Style** | **Glassmorphism** | Modern, responsive, and visually appealing UI. |
| **Key Feature** | **Transport-Aware** | Calculates distance, ETA, and suggests modes (Bus, Train, Plane, Car). |
| **Output** | **Structured JSON** | Clean, day-wise itinerary for easy parsing. |
| **Download** | **PDF Export** | One-click, print-optimized itinerary download. |

-----

## 💡 Core Features

### 🧠 Intelligent Trip Planning

  * **Contextual Logic:** Uses advanced reasoning to create a coherent plan based on your **Starting City, Transport Mode, and Destination**.
  * **Auto-Recommendation Mode:** Suggests the optimal transport mode (Bus/Train for $\le 200 \text{km}$; Plane for $> 200 \text{km}$), while always **honoring the user's explicit choice**.
  * **Regional Focus:** Currently limited to providing travel plans for destinations **within India** 🇮🇳.

### 🗺️ Logistics & Costs (Estimates)

  * **Comprehensive Overview:** The plan includes a **distance estimate**, **recommended mode**, **estimated pricing** (per person & total), **route summary**, and suggested **optional midway stays** for long journeys.
  * **Day-wise Detail:** Each day lists **themed places** with a **description, suggested activity, and best time to visit**.
  * **Corridor POIs:** Suggests relevant **en-route points of interest (POIs)** to enhance the travel experience.

### 💻 User Experience (UX)

  * **Progress Indicators:** Staged progress messages at **10s, 40s, and 70s** provide continuous feedback during generation.
  * **Error Handling:** Features a hard timeout at **100s** and an **Abort/Try Again** mechanism to ensure a reliable experience.
  * **PDF Download:** Easily save and share the generated itinerary with a single click.

-----

## ⚙️ Quick Start Guide

Follow these steps to get the **Travel Agent** running locally on your machine.

### 1\. Clone the Repository

```bash
git clone https://github.com/thammi-mhd/travel-agent.git
cd travel-agent
```

### 2\. Backend Setup (Flask + LLM Integration) 🐍

1.  **Environment Setup:** Create and activate a Python environment (e.g., `conda` or `venv`).

2.  **Install Dependencies:**

    ```bash
    pip install Flask flask-cors google-generativeai
    ```

3.  **Set API Key:** You must set your LLM API key (for the Gemini API) in an environment variable named `gen_ai`.

    | Shell | Command (Per-Session) |
    | :--- | :--- |
    | **PowerShell** | `$env:gen_ai="YOUR_API_KEY_HERE"` |
    | **CMD/Batch** | `set gen_ai="YOUR_API_KEY_HERE"` |
    | **Bash/Linux** | `export gen_ai="YOUR_API_KEY_HERE"` |

4.  **Run the Backend API:**

    ```bash
    python backend/backend.py
    ```

    *API endpoint: `http://127.0.0.1:5000`*

### 3\. Frontend Setup (Static Server) 🌐

Start a simple static web server from the **project root directory** (the folder containing `html/` and `images/`).

```bash
python -m http.server 8000
```

| Page | Link |
| :--- | :--- |
| **Home** | [http://127.0.0.1:8000/html/home.html](https://www.google.com/search?q=http://127.0.0.1:8000/html/home.html) |
| **Planner** | [http://127.0.0.1:8000/html/recommend.html](https://www.google.com/search?q=http://127.0.0.1:8000/html/recommend.html) |

-----

## 📂 Project Structure (Simplified)

```
travel-agent/
├── backend/
│   └── backend.py          # Flask API and LLM integration
├── html/
│   ├── home.html           # Landing page
│   └── recommend.html      # Main planning interface
├── images/                 # Icons, backgrounds, and assets
└── README.md               # You are here!
```

-----

## 🚧 Roadmap & To-Do

The project is continually evolving\! Contributions are welcome for these planned features:

| Priority | Feature | Description |
| :--- | :--- | :--- |
| **High** | **Real-Time Data** | Integrate with a Maps API (e.g., Google Maps) for **real distance and ETA**. |
| **High** | **Deterministic Pricing** | Implement server-side logic to calculate pricing based on distance and transport mode. |
| **Medium** | **POI Curation** | Smarter filtering and placement of en-route POIs. |
| **Low** | **Expand Content** | Prepare content and logic to expand destination support beyond India. |

-----

## 🔧 Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **Images 404** | Ensure your static server is running from the **project root** folder (`travel-agent/`), not inside `html/`. |
| **`"Failed to generate plan"`** | 1. Verify the backend is running (`python backend/backend.py`). 2. Check health: `GET http://127.0.0.1:5000/api/health` should show `"ready": true`. 3. Confirm `gen_ai` environment variable is correctly set and valid. |
| **Plan generation is slow** | Use the **Abort/Try Again** feature, or keep inputs concise. The UI has an automatic 100s timeout. |

-----

## 🤝 Contributing

We welcome all contributions\! Please open an issue first to discuss any major changes, and submit a Pull Request (PR) for bug fixes, UI improvements, or feature additions.
