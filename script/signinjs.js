document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // Prevent default form reload

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
      alert("Please fill in both email and password.");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("Login successful!");
        // Save token if backend sends it
        if (data.token) {
          localStorage.setItem("authToken", data.token);
        }
        // Redirect to home page
        window.location.href = "home.html";
      } else {
        alert(data.message || "Invalid email or password");
      }
    } catch (error) {
      console.error("Error connecting to server:", error);
      alert("Could not connect to server. Please try again later.");
    }
  });
});
