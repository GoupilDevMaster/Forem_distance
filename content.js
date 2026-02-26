"use strict";


let currentSite = null;

// ─── Error logging ────────────────────────────────────────────────────────────

const MAX_ERROR_LOG = 20;

async function logError(ctx, err, extra) {
  const entry = { t: new Date().toISOString(), ctx, msg: (err && err.message) || String(err) };
  if (extra && extra.city) entry.city = extra.city;
  try {
    const s = await browser.storage.local.get("errorLog");
    const log = Array.isArray(s.errorLog) ? s.errorLog : [];
    log.unshift(entry);
    if (log.length > MAX_ERROR_LOG) log.length = MAX_ERROR_LOG;
    await browser.storage.local.set({ errorLog: log });
  } catch (_) {}
  browser.runtime.sendMessage({ type: "errorLogged" }).catch(() => {});
}


// ─── State ────────────────────────────────────────────────────────────────────

let departure = null;           // { city, lat, lon }
let routingService = { id: "osrm", apiKey: "" };
const geocodeCache = new Map(); // cityName → { lat, lon } | null
const routeCache   = new Map(); // cityName → { distance, duration } | null
let queue = [];                 // Array of { cityName, badgeEl }
let processing = false;
let bannerInjected = false;
let observer = null;
let totalJobs = 0;
let completedJobs = 0;

// ─── CSS injection ────────────────────────────────────────────────────────────

(function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .fdist-badge {
      display: inline-block;
      margin-left: 6px;
      padding: 1px 6px;
      background: #e8f4fd;
      border: 1px solid #4a90d9;
      border-radius: 10px;
      font-size: 0.82em;
      color: #1a5276;
      vertical-align: middle;
      white-space: nowrap;
    }
    .fdist-badge.fdist-loading {
      animation: fdist-pulse 1.2s ease-in-out infinite;
      border-color: #aac8e8;
      color: #5a85a8;
    }
    .fdist-badge.fdist-error {
      background: #fff5f5;
      border-color: #ffc9c9;
      color: #c0392b;
    }
    .fdist-banner {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #fff3cd;
      border-bottom: 1px solid #ffc107;
      padding: 8px 16px;
      font-size: 13px;
      color: #856404;
      text-align: center;
    }
    @keyframes fdist-pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.45; }
    }
    .fdist-progress-banner {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #e8f4fd;
      border-bottom: 1px solid #4a90d9;
      padding: 8px 16px;
      font-size: 13px;
      color: #1a5276;
      text-align: center;
    }
    .fdist-progress-banner.fdist-progress-done {
      background: #f0fff4;
      border-bottom-color: #27ae60;
      color: #276749;
    }
  `;
  document.head.appendChild(style);
})();

// ─── Helpers ──────────────────────────────────────────────────────────────────


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function geocode(cityName) {
  if (geocodeCache.has(cityName)) return geocodeCache.get(cityName);

  const params = new URLSearchParams({ q: cityName, format: "json", limit: "1" });
  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { "Accept-Language": "fr" },
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const data = await response.json();
  const result = data && data.length > 0
    ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
    : null;
  geocodeCache.set(cityName, result);
  return result;
}

async function geocodeWithFallback(rawValue) {
  // Try the full string first, then each ", "-separated part
  const candidates = [rawValue, ...rawValue.split(",").map((s) => s.trim())];
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!candidate) continue;
    // Rate-limit: wait before each actual Nominatim request if not cached
    if (!geocodeCache.has(candidate) && i > 0) await sleep(RATE_LIMIT_MS);
    const coords = await geocode(candidate);
    if (coords) return coords;
  }
  return null;
}


async function getRouteORS(from, to, key) {
  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${key}&start=${from.lon},${from.lat}&end=${to.lon},${to.lat}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ORS ${response.status}`);
  const data = await response.json();
  const summary = data.features[0].properties.summary;
  return { distance: summary.distance, duration: summary.duration };
}

async function getRouteHERE(from, to, key) {
  const url = `https://router.hereapi.com/v8/routes?transportMode=car&origin=${from.lat},${from.lon}&destination=${to.lat},${to.lon}&return=summary&apikey=${key}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HERE ${response.status}`);
  const data = await response.json();
  const summary = data.routes[0].sections[0].summary;
  return { distance: summary.length, duration: summary.duration };
}

async function getRouteGoogle(from, to, key) {
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${from.lat},${from.lon}&destinations=${to.lat},${to.lon}&mode=driving&key=${key}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google ${response.status}`);
  const data = await response.json();
  const element = data.rows[0].elements[0];
  if (element.status !== "OK") return null;
  return { distance: element.distance.value, duration: element.duration.value };
}

async function getRoute(from, to) {
  switch (routingService.id) {
    case "openrouteservice": return getRouteORS(from, to, routingService.apiKey);
    case "here":             return getRouteHERE(from, to, routingService.apiKey);
    case "google":           return getRouteGoogle(from, to, routingService.apiKey);
    default:                 return getRouteOSRM(from, to);
  }
}

// ─── Progress (bannière in-page + popup) ──────────────────────────────────────

function updateProgress() {
  // In-page banner
  if (totalJobs > 0) {
    const done = completedJobs >= totalJobs;
    let banner = document.getElementById("fdist-progress-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "fdist-progress-banner";
      banner.className = "fdist-progress-banner";
      document.body.insertBefore(banner, document.body.firstChild);
    }
    if (done) {
      banner.textContent = `✓ ${completedJobs} trajet(s) calculé(s)`;
      banner.classList.add("fdist-progress-done");
      setTimeout(() => banner.remove(), 3000);
    } else {
      banner.textContent = `🚗 Calcul des trajets : ${completedJobs} / ${totalJobs}`;
      banner.classList.remove("fdist-progress-done");
    }
  }
  // Popup notification
  browser.runtime.sendMessage({
    type: "progressUpdate",
    completed: completedJobs,
    total: totalJobs,
  }).catch(() => {});
}

// ─── Queue processor ──────────────────────────────────────────────────────────

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const { cityName, badgeEl } = queue.shift();

    // Skip if badge was removed from DOM (card disappeared)
    if (!badgeEl.isConnected) { completedJobs++; updateProgress(); continue; }

    try {
      // Rate-limit before first uncached geocode attempt
      if (!geocodeCache.has(cityName)) await sleep(RATE_LIMIT_MS);

      const destCoords = await geocodeWithFallback(cityName);
      if (!destCoords) {
        badgeEl.textContent = "⚠";
        badgeEl.title = "Ville introuvable";
        badgeEl.classList.remove("fdist-loading");
        badgeEl.classList.add("fdist-error");
        completedJobs++; updateProgress();
        continue;
      }

      const isCached = routeCache.has(cityName);
      let route;
      if (isCached) {
        route = routeCache.get(cityName);
      } else {
        route = await getRoute(departure, destCoords);
        routeCache.set(cityName, route);
      }

      if (!route) {
        badgeEl.textContent = "⚠";
        badgeEl.title = "Trajet impossible";
        badgeEl.classList.remove("fdist-loading");
        badgeEl.classList.add("fdist-error");
        completedJobs++; updateProgress();
        continue;
      }

      // Track API usage for quota-limited services (real requests only)
      if (!isCached && routingService.id !== "osrm") {
        browser.runtime.sendMessage({ type: "trackRequest", serviceId: routingService.id })
          .catch(() => {});
      }

      badgeEl.textContent = `🚗 ${formatDuration(route.duration)} · ${formatDistance(route.distance)}`;
      badgeEl.title = `Depuis ${departure.city}`;
      badgeEl.classList.remove("fdist-loading");
      completedJobs++; updateProgress();
    } catch (err) {
      console.error("[Forem Distance]", err);
      logError(routingService.id, err, { city: cityName }); // fire-and-forget
      badgeEl.textContent = "⚠";
      badgeEl.title = classifyError(err);
      badgeEl.classList.remove("fdist-loading");
      badgeEl.classList.add("fdist-error");
      completedJobs++; updateProgress();
    }
  }

  processing = false;
}

// ─── Badge injection ──────────────────────────────────────────────────────────

function getLocationValue(el) {
  return currentSite.getValue(el);
}

function injectBadge(locationEl) {
  // Avoid double-injection
  if (locationEl.dataset.fdistDone) return;
  locationEl.dataset.fdistDone = "1";

  const cityName = getLocationValue(locationEl);
  if (!cityName) return;

  const target = currentSite.getTarget(locationEl);

  const badge = document.createElement("span");
  badge.className = "fdist-badge fdist-loading";
  badge.textContent = "⏳";
  badge.title = "Calcul en cours…";
  target.appendChild(badge);

  queue.push({ cityName, badgeEl: badge });
  totalJobs++;
  updateProgress();
}

function processNewElements(root) {
  if (!departure) return;
  const elements = (root || document).querySelectorAll(currentSite.selector);
  elements.forEach(injectBadge);
  processQueue();
}

// ─── No-config banner ─────────────────────────────────────────────────────────

function showNoBanner() {
  if (bannerInjected) return;
  bannerInjected = true;
  const banner = document.createElement("div");
  banner.className = "fdist-banner";
  banner.id = "fdist-no-config-banner";
  banner.textContent = "Configurez votre ville de départ dans l'extension Trajet Emploi pour voir les temps de trajet.";
  document.body.insertBefore(banner, document.body.firstChild);
}

function removeNoBanner() {
  const banner = document.getElementById("fdist-no-config-banner");
  if (banner) banner.remove();
  bannerInjected = false;
}

// ─── MutationObserver ─────────────────────────────────────────────────────────

function startObserver() {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        // Check if the added node itself or its descendants match
        if (node.matches && node.matches(currentSite.selector)) {
          injectBadge(node);
          processQueue();
        } else {
          const found = node.querySelectorAll ? node.querySelectorAll(currentSite.selector) : [];
          if (found.length > 0) {
            found.forEach(injectBadge);
            processQueue();
          }
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ─── Reset (for refresh) ──────────────────────────────────────────────────────

function resetAllBadges() {
  queue = [];
  totalJobs = 0;
  completedJobs = 0;
  document.getElementById("fdist-progress-banner")?.remove();
  browser.runtime.sendMessage({ type: "progressUpdate", completed: 0, total: 0 }).catch(() => {});
  // Remove all existing badges so they can be re-injected
  document.querySelectorAll(".fdist-badge").forEach((b) => b.remove());
  document.querySelectorAll(`[data-fdist-done]`).forEach((el) => {
    delete el.dataset.fdistDone;
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  currentSite = SITES.find((s) => s.urlPattern.test(location.hostname)) || null;
  if (!currentSite) return;

  const result = await browser.storage.local.get(["departure", "routingService"]);
  departure = result.departure || null;
  routingService = result.routingService || { id: "osrm", apiKey: "" };

  if (!departure) {
    showNoBanner();
  } else {
    removeNoBanner();
    processNewElements();
    startObserver();
  }
}

// ─── Message listener (refresh from popup) ────────────────────────────────────

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "getProgress") {
    return Promise.resolve({ completed: completedJobs, total: totalJobs });
  }
  if (message.type === "refresh") {
    browser.storage.local.get(["departure", "routingService"]).then((result) => {
      departure = result.departure || null;
      routingService = result.routingService || { id: "osrm", apiKey: "" };
      if (!departure) {
        showNoBanner();
        return;
      }
      removeNoBanner();
      resetAllBadges();
      geocodeCache.clear(); // departure changed, dest cache still valid but clear to be safe
      routeCache.clear();
      processNewElements();
      startObserver();
    });
  }
});

// ─── Back-forward cache (bfcache) ─────────────────────────────────────────────

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    // Page restaurée depuis le bfcache — remettre à zéro et rescanner
    resetAllBadges();
    processing = false;
    init();
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

init();
