// --- Section 1: Hard guards to block accidental submits or Enter key submits ---
document.addEventListener("submit", (e) => {
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const el = document.activeElement;
    const isTextLike =
      el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
    if (isTextLike) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
});

let verificationToken = null;

// --- Section 2: Setup MutationObserver and logging ---
const container = document.getElementById("otp-container");
if (container) {
  const observer = new MutationObserver((mutations) => {
    console.log("[MutationObserver] Changes in otp-container:", mutations);
  });
  observer.observe(container, { childList: true, subtree: true });
}

window.addEventListener("beforeunload", () =>
  console.log("beforeunload fired")
);
document.addEventListener("click", (e) => {
  if (e.target && e.target.tagName) {
    console.log(
      "[Click]",
      e.target.tagName,
      e.target.className || e.target.id || ""
    );
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // Hook form elements
  const sendOtpBtn = document.querySelector(".otp-btn");
  if (sendOtpBtn) {
    sendOtpBtn.type = "button"; // Make sure button doesn't submit form
    sendOtpBtn.addEventListener("click", handleSendOtp);
  }

  // form submit disabled globally by hard guard above

  // Add initial log
  console.log("DOMContentLoaded: Signup form script initialized");
});

async function handleSendOtp(e) {
  e.preventDefault();
  console.log("handleSendOtp() start");

  const emailInput = document.getElementById("email");
  const errorDiv = document.getElementById("email-error");
  errorDiv.textContent = "";

  const email = (emailInput?.value || "").trim();
  if (!email) {
    errorDiv.textContent = "* required";
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/api/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.ok) {
      console.log("handleSendOtp() success, calling addInput()");
      errorDiv.textContent =
        "OTP sent. Check your email (or server console in dev).";
      addInput();
      startOtpGuard(); // Start periodic OTP UI guard
    } else {
      errorDiv.textContent = data.message || "Could not send OTP";
    }
  } catch (err) {
    console.error(err);
    errorDiv.textContent = "Error sending OTP. Check server.";
  }
}

function addInput() {
  console.log("addInput(): rendering OTP UI");
  const container = document.getElementById("otp-container");
  if (!container) {
    console.warn("addInput(): otp-container not found");
    return;
  }
  container.innerHTML = "";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Enter OTP";
  input.maxLength = 6;
  input.className = "input-otp";
  input.inputMode = "numeric";
  input.style.display = "block";

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Verify OTP";
  button.className = "vfy-btn";
  button.style.display = "block";
  button.addEventListener("click", verifyOtp);

  container.appendChild(input);
  container.appendChild(button);
}

// Section 6: OTP UI guard logic
let otpGuardTimer = null;
function mountOtpUIIfMissing() {
  const container = document.getElementById("otp-container");
  if (container && !container.querySelector(".input-otp")) {
    console.warn("OTP UI missing — remounting.");
    addInput();
  }
}
function startOtpGuard() {
  stopOtpGuard();
  otpGuardTimer = setInterval(mountOtpUIIfMissing, 300);
}
function stopOtpGuard() {
  if (otpGuardTimer) clearInterval(otpGuardTimer);
  otpGuardTimer = null;
}

async function verifyOtp(e) {
  e.preventDefault();
  console.log("verifyOtp() start");

  const input = document.querySelector(".input-otp");
  const enteredValue = (input?.value || "").trim();
  const email = (document.getElementById("email")?.value || "").trim();

  if (!enteredValue) {
    alert("Enter OTP");
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/api/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp: enteredValue }),
    });
    const data = await res.json();
    if (res.ok) {
      verificationToken = data.verification_token;
      stopOtpGuard(); // Stop OTP guard on success
      showPasswordInputs();
    } else {
      alert(data.message || "OTP verification failed");
    }
  } catch (err) {
    console.error(err);
    alert("Error verifying OTP");
  }
}

function showPasswordInputs() {
  const form = document.getElementById("login-form");
  form.innerHTML = ""; // Clear existing content

  const div = document.getElementById("div-form");
  div.innerHTML = ""; // Clear existing content
  div.value =
    "Congratulations! OTP verified successfully. Please set your password.";

  const passwordDiv = document.createElement("div");
  passwordDiv.className = "form-group";
  passwordDiv.innerHTML = `
    <label for="new-pass">New Password</label>
    <input type="password" id="new-pass" class="form-control" placeholder="Enter new password" required>
  `;

  const confirmDiv = document.createElement("div");
  confirmDiv.className = "form-group";
  confirmDiv.innerHTML = `
    <label for="confirm-pass">Confirm Password</label>
    <input type="password" id="confirm-pass" class="form-control" placeholder="Confirm password" required>
  `;

  const confirmButton = document.createElement("button");
  confirmButton.type = "button";
  confirmButton.addEventListener("click", verifyPassword);
  confirmButton.className = "signup-btn";
  confirmButton.textContent = "Create Account";
}

function verifyPassword() {
  const newPass = (document.getElementById("new-pass")?.value || "").trim();
  const confirmPass = (
    document.getElementById("confirm-pass")?.value || ""
  ).trim();

  if (!newPass || !confirmPass) {
    alert("Please enter both password fields");
    return;
  }
  if (newPass !== confirmPass) {
    alert("Passwords do not match");
    return;
  }

  // If valid, proceed with account creation
  createAccount(new Event("submit"));
}

async function createAccount(e) {
  e.preventDefault();

  const selectedPhoto = document.querySelector(".photo-container img.selected");
  if (!selectedPhoto) {
    alert("Please select a profile photo");
    return;
  }

  const username = (document.getElementById("username")?.value || "").trim();
  if (!username) {
    alert("Enter a username");
    return;
  }
  if (username.length < 6) {
    alert("Username must be at least 6 characters");
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    alert("Username can only contain letters, numbers, and underscores");
    return;
  }
  if (username.length > 20) {
    alert("Username cannot exceed 20 characters");
    return;
  }
  if (!/^[a-zA-Z]/.test(username)) {
    alert("Username must start with a letter");
    return;
  }
  if (username.includes(" ")) {
    alert("Username cannot contain spaces");
    return;
  }

  const password = (document.getElementById("new-pass")?.value || "").trim();
  const confirm = (document.getElementById("confirm-pass")?.value || "").trim();
  const email = (document.getElementById("email")?.value || "").trim();

  if (!password || !confirm) {
    alert("Enter password and confirmation");
    return;
  }
  if (password !== confirm) {
    alert("Passwords do not match");
    return;
  }
  if (password.length < 6) {
    alert("Password must be at least 6 chars");
    return;
  }
  if (!verificationToken) {
    alert("No verification token found. Please verify OTP first.");
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_photo: selectedPhoto.src,
        username,
        email,
        password,
        verification_token: verificationToken,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      clearFormAndShowLoader(email, username, true);
    } else {
      alert(data.message || "Signup failed");
    }
  } catch (err) {
    console.error(err);
    alert("Error creating account");
  }
}

function clearFormAndShowLoader(emailval, usernameVal, success = false) {
  const form = document.querySelector("form");
  form.innerHTML = "";

  const loader = document.createElement("div");
  loader.className = "loader";
  loader.style.textAlign = "center";
  loader.textContent = "Creating account...";

  form.appendChild(loader);

  setTimeout(() => {
    form.innerHTML = "";

    if (success) {
      const h2 = document.createElement("h2");
      h2.textContent = "Congratulations!";
      h2.style.textAlign = "center";
      h2.style.color = "green";

      const profile_photo = document.createElement("img");
      profile_photo.src = "../images/success.png";
      profile_photo.style.display = "block";

      const p = document.createElement("p");
      p.innerHTML = `Your profile has been successfully created for ${usernameVal} with the email <strong>${emailval}</strong>.<br>Thank you.`;
      p.style.textAlign = "center";
      p.style.color = "#fff";

      const loginBtn = document.createElement("input");
      loginBtn.type = "button";
      loginBtn.value = "Login";
      loginBtn.className = "login-btn";
      loginBtn.onclick = () => (window.location.href = "signin.html");

      form.appendChild(h2);
      form.appendChild(p);
      form.appendChild(loginBtn);
    } else {
      const p = document.createElement("p");
      p.textContent = "Something went wrong, please try again.";
      p.style.color = "red";
      p.style.textAlign = "center";
      form.appendChild(p);
    }
  }, 1500);
}
