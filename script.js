// ---- CONFIG ----
// Fill these in after deploying (see README.md).
const CONFIG = {
  // The Google Apps Script Web App URL (ends in /exec).
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxKOpxNO7Yu00MLrFN8JiGWN7OcPpDbh8gFpOKEh-nZ-kKmmSNfPbgL8xsqhjMVxSlGzw/exec",
  // Optional: a 2GIS link to the venue (open 2gis.kg, find the place, Share → copy
  // the link). Leave as-is to hide the "Open in 2GIS" button.
  MAP_URL: "https://2gis.kg/bishkek/search/Diyar%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%20%D0%9F%D0%BE%D0%B1%D0%B5%D0%B4%D1%8B%20327",
  // The event date. Set these numbers to your real date; the month + weekday NAMES
  // are shown from translations.js, so the calendar + big date update automatically.
  // month is 1-12 (e.g. 8 = August).
  EVENT_DATE: { year: 2026, month: 8, day: 21 }
};

// ---- STATE ----
const currentLang = "ru";
let guestToken = null;
let guestName = null;
let guestAttending = "";
let noteKey = null;
let alreadyKey = null;
let confirmedAttending = null;

// ---- TRANSLATION HELPERS ----
function t(path) {
  const parts = path.split(".");
  let node = TRANSLATIONS[currentLang];
  for (const p of parts) node = node && node[p];
  return node != null ? node : path;
}

function renderText() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });

  refreshDynamic();
}

// Re-render everything that isn't a plain static data-i18n string.
function refreshDynamic() {
  const greetingEl = document.getElementById("rsvp-greeting");
  if (greetingEl && guestName) {
    greetingEl.textContent = t("rsvp.greeting").replace("{name}", guestName);
  }

  const noteEl = document.getElementById("rsvp-message");
  if (noteEl && noteKey) noteEl.textContent = t(noteKey);

  const alreadyEl = document.getElementById("rsvp-already");
  if (alreadyEl && alreadyKey) alreadyEl.textContent = t(alreadyKey);

  const confMsg = document.getElementById("confirmation-message");
  if (confMsg && confirmedAttending) {
    confMsg.textContent = confirmedAttending === "yes"
      ? t("confirmation.messageYes")
      : t("confirmation.messageNo");
  }

  updateDateText();
  updateCalendarHeaders();
  updateTimelineText();
}

// ---- DATE + CALENDAR ----
function updateDateText() {
  const d = CONFIG.EVENT_DATE;
  const months = t("months");
  const monthEl = document.getElementById("date-month");
  const dayEl = document.getElementById("date-day");
  const yearEl = document.getElementById("date-year");
  if (monthEl) monthEl.textContent = Array.isArray(months) ? months[d.month - 1] : "";
  if (dayEl) dayEl.textContent = d.day;
  if (yearEl) yearEl.textContent = d.year;
}

function updateCalendarHeaders() {
  const wrap = document.getElementById("cal-weekdays");
  if (!wrap) return;
  const names = t("weekdays");
  if (!Array.isArray(names)) return;
  wrap.innerHTML = "";
  names.forEach((n) => {
    const span = document.createElement("span");
    span.textContent = n;
    wrap.appendChild(span);
  });
}

// Day numbers don't change with language, so build the grid once.
function buildCalendarGrid() {
  const grid = document.getElementById("cal-grid");
  if (!grid) return;
  const d = CONFIG.EVENT_DATE;
  const firstWeekday = new Date(d.year, d.month - 1, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(d.year, d.month, 0).getDate();

  grid.innerHTML = "";
  for (let i = 0; i < firstWeekday; i++) {
    grid.appendChild(document.createElement("div"));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    const num = document.createElement("span");
    num.className = "cal-num";
    if (day === d.day) num.classList.add("cal-today");
    num.textContent = day;
    cell.appendChild(num);
    grid.appendChild(cell);
  }
}

// ---- TIMELINE ----
const TIMELINE_COUNT = 5;

function buildTimeline() {
  const wrap = document.getElementById("timeline");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (let i = 0; i < TIMELINE_COUNT; i++) {
    const item = document.createElement("div");
    item.className = "tl-item reveal";
    item.style.transitionDelay = (i * 80) + "ms";
    item.innerHTML =
      '<div class="tl-media">' +
        '<span class="tl-ph" aria-hidden="true">🧸</span>' +
        '<img src="photos/t' + (i + 1) + '.jpg" alt="" loading="lazy" onerror="this.remove()">' +
      '</div>' +
      '<div class="tl-body">' +
        '<span class="tl-date"></span>' +
        '<h3 class="tl-title"></h3>' +
        '<p class="tl-text"></p>' +
      '</div>';
    wrap.appendChild(item);
  }
}

function updateTimelineText() {
  const items = t("timeline.items");
  if (!Array.isArray(items)) return;
  const nodes = document.querySelectorAll("#timeline .tl-item");
  nodes.forEach((node, i) => {
    const data = items[i];
    if (!data) return;
    node.querySelector(".tl-date").textContent = data.date;
    node.querySelector(".tl-title").textContent = data.title;
    node.querySelector(".tl-text").textContent = data.text;
  });
}

// ---- RSVP SECTION STATE MACHINE ----
function setRsvpState(state) {
  const loading = document.getElementById("rsvp-loading");
  const message = document.getElementById("rsvp-message");
  const controls = document.getElementById("rsvp-controls");
  const confirmation = document.getElementById("confirmation");
  const rsvpSection = document.getElementById("rsvp-section");

  loading.hidden = state !== "loading";
  message.hidden = !(state === "noLink" || state === "notFound");
  controls.hidden = state !== "controls";
  confirmation.hidden = state !== "confirmed";
  rsvpSection.hidden = state === "confirmed";

  if (state === "noLink") noteKey = "rsvp.noLink";
  else if (state === "notFound") noteKey = "rsvp.notFound";

  refreshDynamic();
}

// ---- JSONP (Apps Script Web Apps don't send CORS headers, so a plain fetch
// can't read the response. A <script> tag can, via a callback param.) ----
function jsonp(params) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
    const script = document.createElement("script");

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, 15000);

    function cleanup() {
      clearTimeout(timer);
      delete window[cb];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };

    const qs = new URLSearchParams(Object.assign({}, params, { callback: cb, _: Date.now() }));
    script.src = CONFIG.SCRIPT_URL + "?" + qs.toString();
    script.onerror = () => {
      cleanup();
      reject(new Error("network"));
    };
    document.body.appendChild(script);
  });
}

// ---- LOOK UP THE GUEST BY TOKEN ----
async function loadGuest() {
  setRsvpState("loading");
  try {
    const res = await jsonp({ action: "lookup", g: guestToken });
    if (res && res.ok) {
      guestName = res.name || "";
      guestAttending = res.attending || "";

      const alreadyEl = document.getElementById("rsvp-already");
      if (guestAttending === "yes" || guestAttending === "no") {
        alreadyKey = guestAttending === "yes" ? "rsvp.alreadyYes" : "rsvp.alreadyNo";
        alreadyEl.hidden = false;
      } else {
        alreadyKey = null;
        alreadyEl.hidden = true;
      }

      setRsvpState("controls");
    } else {
      setRsvpState("notFound");
    }
  } catch (err) {
    setRsvpState("notFound");
  }
}

// ---- SUBMIT AN RSVP ----
document.querySelectorAll(".rsvp-btn").forEach((btn) => {
  btn.addEventListener("click", () => submitRsvp(btn));
});

async function submitRsvp(btn) {
  const attending = btn.getAttribute("data-value");
  const buttons = document.querySelectorAll(".rsvp-btn");
  const errorEl = document.getElementById("rsvp-error");
  const label = btn.querySelector("span");
  const originalLabel = label.textContent;

  errorEl.hidden = true;
  buttons.forEach((b) => (b.disabled = true));
  label.textContent = t("rsvp.sending");

  try {
    const res = await jsonp({
      action: "rsvp",
      g: guestToken,
      attending: attending,
      lang: currentLang
    });

    if (res && res.ok) {
      confirmedAttending = attending;
      setRsvpState("confirmed");
    } else {
      throw new Error(res && res.error ? res.error : "save_failed");
    }
  } catch (err) {
    errorEl.hidden = false;
  } finally {
    buttons.forEach((b) => (b.disabled = false));
    label.textContent = originalLabel;
  }
}

// ---- RSVP CTA (scrolls to the RSVP section) ----
function setupCTA() {
  const cta = document.getElementById("cta-rsvp");
  if (!cta) return;
  cta.addEventListener("click", () => {
    const target = document.getElementById("rsvp-section");
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  });
}

// ---- MAP BUTTON ----
function setupMapButton() {
  const mapBtn = document.getElementById("map-btn");
  const url = CONFIG.MAP_URL;
  if (url && url.indexOf("PASTE_") !== 0) {
    mapBtn.href = url;
    mapBtn.hidden = false;
  } else {
    mapBtn.hidden = true;
  }
}

// ---- COPY ADDRESS ----
function setupCopyAddress() {
  const btn = document.getElementById("copy-addr-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const addrEl = document.querySelector('[data-i18n="event.address"]');
    const addr = addrEl ? addrEl.textContent.trim() : "";
    try {
      await navigator.clipboard.writeText(addr);
    } catch (err) {
      // Clipboard API can be unavailable (e.g. non-HTTPS); fail quietly.
    }
    btn.textContent = t("event.copied");
    setTimeout(() => { btn.textContent = t("event.copyAddress"); }, 1500);
  });
}

// ---- BACKGROUND MUSIC ----
// The button only appears once the audio file (music/song.mp3) actually loads,
// so there's no broken control before you add a track. Browsers block autoplay
// with sound, so we also start it on the guest's first tap anywhere on the page.
function setupMusic() {
  const audio = document.getElementById("bg-music");
  const btn = document.getElementById("music-btn");
  if (!audio || !btn) return;

  // Show the control only once a real audio file has loaded.
  audio.addEventListener("canplay", () => { btn.hidden = false; }, { once: true });
  audio.addEventListener("error", () => { btn.hidden = true; });

  const sync = () => btn.classList.toggle("playing", !audio.paused);
  audio.addEventListener("play", sync);
  audio.addEventListener("pause", sync);

  // Autoplay with sound is blocked until the guest interacts, so kick it off on
  // their first tap anywhere (except the button, which manages itself).
  function startOnce(e) {
    if (btn.contains(e.target)) return;
    audio.play().catch(() => {});
    stopAutoStart();
  }
  function stopAutoStart() {
    document.removeEventListener("pointerdown", startOnce);
  }
  document.addEventListener("pointerdown", startOnce);

  // Once the guest uses the button, they're in control — stop auto-starting.
  btn.addEventListener("click", () => {
    stopAutoStart();
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });
}

// ---- FALLING CHERRY-BLOSSOM PETALS ----
function setupPetals() {
  const wrap = document.getElementById("petals");
  if (!wrap) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const colors = ["#f6c9d4", "#f3d9e0", "#efb6c4", "#fbe6ea", "#f7dfe4"];
  const COUNT = 14;

  for (let i = 0; i < COUNT; i++) {
    const petal = document.createElement("span");
    petal.className = "petal";
    petal.style.left = (Math.random() * 100).toFixed(2) + "%";
    petal.style.animationDuration = (7 + Math.random() * 9).toFixed(1) + "s";
    // negative delay so petals are already spread down the screen on load
    petal.style.animationDelay = (-Math.random() * 12).toFixed(1) + "s";

    const inner = document.createElement("span");
    inner.className = "petal-inner";
    const size = (8 + Math.random() * 8).toFixed(1);
    inner.style.width = size + "px";
    inner.style.height = size + "px";
    inner.style.background = colors[i % colors.length];
    inner.style.opacity = (0.55 + Math.random() * 0.35).toFixed(2);
    inner.style.animationDuration = (2 + Math.random() * 3).toFixed(1) + "s";

    petal.appendChild(inner);
    wrap.appendChild(petal);
  }
}

// ---- SCROLL REVEAL ----
function setupReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("in-view"));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach((el) => obs.observe(el));
}

// ---- INIT ----
(function init() {
  const params = new URLSearchParams(window.location.search);
  guestToken = params.get("g");

  buildCalendarGrid();
  buildTimeline();

  renderText();
  setupMapButton();
  setupCopyAddress();
  setupCTA();
  setupMusic();
  setupPetals();
  setupReveal();

  if (guestToken) {
    loadGuest();
  } else {
    setRsvpState("noLink");
  }
})();
