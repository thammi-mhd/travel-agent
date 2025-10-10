document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("bookingForm");
  const planSection = document.getElementById("planSection");
  const planOutput = document.getElementById("planOutput");
  const loader = document.getElementById("loader");

  // Styles for cards/list
  const style = document.createElement("style");
  style.textContent = `
    #planOutput .itinerary-title { margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #0f172a; }
    #planOutput .day-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
    #planOutput .day-heading { font-weight: 700; margin: 0 0 8px 0; color: #111827; }
    #planOutput .activity-list { margin: 0; padding-left: 18px; }
    #planOutput .activity-list li { margin: 4px 0; }
    #planOutput .msg { padding: 12px 14px; border-radius: 8px; white-space: pre-wrap; }
    #planOutput .msg.info { background: #f5f7fb; border: 1px solid #e3e7ef; color: #1e293b; }
    #planOutput .msg.error { background: #ffe6e6; color: #a40000; border: 1px solid #ffb3b3; }
  `;
  document.head.appendChild(style);

  function showSection() {
    planSection.classList.remove("hidden");
  }
  function hideLoader() {
    loader.classList.add("hidden");
  }
  function showLoader() {
    loader.classList.remove("hidden");
  }
  function renderMessage(msg, type = "info") {
    planOutput.innerHTML = "";
    const box = document.createElement("div");
    box.className = `msg ${type}`;
    box.textContent = msg;
    planOutput.appendChild(box);
  }

  function normalizeDayValue(value) {
    if (value == null) return [];
    if (typeof value === "string") {
      const lines = value
        .split(/\n|;|\.(?=\s|$)/g)
        .map((s) => s.trim())
        .filter(Boolean);
      return lines.length ? lines : [value.trim()];
    }
    if (Array.isArray(value)) {
      return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v)));
    }
    if (typeof value === "object") {
      const keysInOrder = [
        "activities",
        "places",
        "stops",
        "steps",
        "plan",
        "highlights",
      ];
      for (const k of keysInOrder) {
        if (Array.isArray(value[k]))
          return value[k].map((v) =>
            typeof v === "string" ? v : JSON.stringify(v)
          );
        if (typeof value[k] === "string") return normalizeDayValue(value[k]);
      }
      return [JSON.stringify(value)];
    }
    return [String(value)];
  }

  function renderPlanObject(planObj) {
    planOutput.innerHTML = "";
    const title = document.createElement("div");
    title.className = "itinerary-title";
    title.textContent = "Your Itinerary";
    planOutput.appendChild(title);

    const dayKeys = Object.keys(planObj).sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ""), 10);
      const nb = parseInt(b.replace(/\D/g, ""), 10);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b);
    });

    dayKeys.forEach((key) => {
      const dayCard = document.createElement("div");
      dayCard.className = "day-card";

      const heading = document.createElement("div");
      heading.className = "day-heading";
      heading.textContent = key.replace(/day(\d+)/i, "Day $1");

      const list = document.createElement("ol");
      list.className = "activity-list";

      const activities = normalizeDayValue(planObj[key]);
      activities.forEach((activity) => {
        const li = document.createElement("li");
        li.textContent = activity;
        list.appendChild(li);
      });

      dayCard.appendChild(heading);
      dayCard.appendChild(list);
      planOutput.appendChild(dayCard);
    });
  }

  function coercePlanToDays(objOrArrayOrString) {
    if (objOrArrayOrString == null) return null;
    if (typeof objOrArrayOrString === "string") {
      const t = objOrArrayOrString.trim();
      if (
        (t.startsWith("{") && t.endsWith("}")) ||
        (t.startsWith("[") && t.endsWith("]"))
      ) {
        try {
          return coercePlanToDays(JSON.parse(t));
        } catch {
          return null;
        }
      }
      return null;
    }
    if (Array.isArray(objOrArrayOrString)) return { day1: objOrArrayOrString };
    if (typeof objOrArrayOrString === "object") {
      const hasDayKeys = Object.keys(objOrArrayOrString).some((k) =>
        /^day\d+$/i.test(k)
      );
      if (hasDayKeys) return objOrArrayOrString;
      const singleDayKeys = [
        "activities",
        "places",
        "stops",
        "steps",
        "plan",
        "highlights",
      ];
      if (singleDayKeys.some((k) => k in objOrArrayOrString))
        return { day1: objOrArrayOrString };
    }
    return null;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showSection();
    showLoader();

    const destination = document.getElementById("destination").value.trim();
    const departureDate = document.getElementById("departureDate").value;
    const returnDate = document.getElementById("returnDate").value;
    const travelers = document.getElementById("travelers").value;
    const preferences = document.getElementById("preferences").value.trim();

    if (!destination || !departureDate || !returnDate || !travelers) {
      hideLoader();
      renderMessage("Please fill all required fields.", "error");
      return;
    }

    const bookingData = {
      destination,
      departureDate,
      returnDate,
      travelers: Number(travelers),
      preferences,
    };

    try {
      const response = await fetch("http://127.0.0.1:5000/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });

      if (!response.ok) {
        let errText = "Failed to generate plan";
        try {
          const errJson = await response.json();
          if (errJson && errJson.error) errText = errJson.error;
        } catch {}
        throw new Error(errText);
      }

      const data = await response.json();
      let planPayload = data.plan;

      if (typeof planPayload === "string") {
        const trimmed = planPayload.trim();
        const special = [
          "Sorry, I don't have information on that destination.",
          "Trip duration must be at least 1 day.",
          "There must be at least one traveler.",
          "Please provide all required trip details.",
        ];
        if (special.includes(trimmed)) {
          hideLoader();
          renderMessage(trimmed, "error");
          return;
        }
        if (
          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("[") && trimmed.endsWith("]"))
        ) {
          try {
            planPayload = JSON.parse(trimmed);
          } catch {}
        }
      }

      const dayWise = coercePlanToDays(planPayload);
      hideLoader();

      if (dayWise && typeof dayWise === "object") {
        renderPlanObject(dayWise);
      } else {
        renderMessage(
          typeof planPayload === "string"
            ? planPayload
            : JSON.stringify(planPayload, null, 2),
          "info"
        );
      }
    } catch (err) {
      hideLoader();
      renderMessage(`Error: ${err.message}`, "error");
    }
  });
});
