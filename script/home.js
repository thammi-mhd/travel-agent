const btn = document.getElementById("dropdownButton");
const menu = document.getElementById("dropdownMenu");
const help_btn = document.getElementById("help-btn");
const trvl_agnt_btn = document.getElementById("trvl-agnt-btn");
const deals_btn = document.getElementById("deals-btn");

btn.addEventListener("click", () => {
  menu.style.display = menu.style.display === "block" ? "none" : "block";
});

document.addEventListener("click", (e) => {
  if (!btn.contains(e.target) && !menu.contains(e.target)) {
    menu.style.display = "none";
  }
});

function redirectToHelp() {
  window.location.href = "../html/help.html";
}

function redirectToTravelAgent() {
  window.location.href = "../html/recommend.html";
}

function redirectToDeals() {
  window.location.href = "../html/deals.html";
}

console.log("Home page script loaded");
