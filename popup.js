"use strict";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const GITHUB_ISSUES_URL = "https://github.com/GoupilDevMaster/Forem_distance/issues/new?labels=bug&title=Bug+report";

// --- DOM references ---
const inputFrom = document.getElementById("city-from");
const btnSave = document.getElementById("btn-save");
const spinner = document.getElementById("spinner");
const feedbackEl = document.getElementById("feedback");
const currentCityName = document.getElementById("current-city-name");

const selectService = document.getElementById("routing-service");
const apiKeyGroup   = document.getElementById("api-key-group");
const inputApiKey   = document.getElementById("api-key");
const btnApiHelp    = document.getElementById("btn-api-help");
const btnSaveAdv      = document.getElementById("btn-save-advanced");
const feedbackAdv     = document.getElementById("feedback-advanced");
const selectWarnThreshold  = document.getElementById("warn-threshold");
const warnThresholdGroup   = document.getElementById("warn-threshold-group");

const progressSection = document.getElementById("progress-section");
const progressText    = document.getElementById("progress-text");

const errorCountBadge = document.getElementById("error-count-badge");
const btnBugReport    = document.getElementById("btn-bug-report");
const btnClearErrors  = document.getElementById("btn-clear-errors");

const usageSection      = document.getElementById("usage-section");
const gaugeServiceLabel = document.getElementById("gauge-service-label");
const gaugeFill         = document.getElementById("gauge-fill");
const gaugeCountText    = document.getElementById("gauge-count-text");
const gaugePctText      = document.getElementById("gauge-pct-text");
const gaugePeriodText   = document.getElementById("gauge-period-text");

// --- Progress counter ---

function updatePopupProgress(completed, total) {
  if (total === 0) {
    progressSection.classList.add("hidden");
    return;
  }
  progressSection.classList.remove("hidden");
  if (completed >= total) {
    progressText.textContent = `✓ ${completed} trajet(s) calculé(s)`;
    progressSection.classList.add("progress-done");
  } else {
    progressText.textContent = `🚗 Calcul des trajets : ${completed} / ${total}`;
    progressSection.classList.remove("progress-done");
  }
}

// --- Advanced options constants ---

const HELP_URLS = {
  openrouteservice: "https://openrouteservice.org/dev/#/signup",
  here:             "https://developer.here.com/sign-up",
  google:           "https://developers.google.com/maps/documentation/distance-matrix/get-api-key",
};

const QUOTAS = {
  openrouteservice: { max: 500,    resetPeriod: "day",   label: "OpenRouteService" },
  here:             { max: 250000, resetPeriod: "month", label: "HERE Routing" },
  google:           { max: 40000,  resetPeriod: "month", label: "Google Maps" },
};

// --- Helpers ---

function showSpinner() {
  spinner.classList.remove("hidden");
  feedbackEl.classList.add("hidden");
  btnSave.disabled = true;
}

function hideSpinner() {
  spinner.classList.add("hidden");
  btnSave.disabled = false;
}

function showFeedback(message, type) {
  feedbackEl.textContent = message;
  feedbackEl.className = `feedback ${type}`;
  feedbackEl.classList.remove("hidden");
}


// --- Error logging ---

async function logError(ctx, err) {
  const entry = { t: new Date().toISOString(), ctx, msg: (err && err.message) || String(err) };
  try {
    const s = await browser.storage.local.get("errorLog");
    const log = Array.isArray(s.errorLog) ? s.errorLog : [];
    log.unshift(entry); if (log.length > 20) log.length = 20;
    await browser.storage.local.set({ errorLog: log });
  } catch (_) {}
}

// --- API ---

async function geocode(city) {
  const params = new URLSearchParams({ q: city, format: "json", limit: "1" });
  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { "Accept-Language": "fr" },
  });
  if (!response.ok) throw new Error(`Nominatim error ${response.status}`);
  const data = await response.json();
  if (!data || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

// --- Advanced options: service selector ---


function renderGauge(serviceId, counts) {
  const quota = QUOTAS[serviceId];
  if (!quota) { usageSection.classList.add("hidden"); return; }

  const count = (counts[serviceId] && counts[serviceId].count) || 0;
  const pct   = Math.min((count / quota.max) * 100, 100);
  const filled = ((pct / 100) * 188.496).toFixed(3);

  gaugeFill.setAttribute("stroke-dasharray", `${filled} 251.327`);
  gaugeFill.setAttribute("stroke", gaugeColor(pct));
  gaugeCountText.textContent  = `${count.toLocaleString("fr")} / ${quota.max.toLocaleString("fr")}`;
  gaugePctText.textContent    = `${Math.round(pct)}%`;
  gaugePeriodText.textContent = quota.resetPeriod === "day" ? "aujourd'hui" : "ce mois-ci";
  gaugeServiceLabel.textContent = quota.label;

  usageSection.classList.remove("hidden");
}

function onServiceChange(counts) {
  const service = selectService.value;
  if (service !== "osrm") {
    apiKeyGroup.classList.remove("hidden");
    warnThresholdGroup.classList.remove("hidden");
    btnApiHelp.title = "Comment obtenir une clé " + selectService.options[selectService.selectedIndex].text.split(" —")[0] + " ?";
    if (counts !== undefined) {
      renderGauge(service, counts);
    } else {
      browser.storage.local.get("requestCounts").then((s) =>
        renderGauge(service, s.requestCounts || {})
      );
    }
  } else {
    apiKeyGroup.classList.add("hidden");
    usageSection.classList.add("hidden");
    warnThresholdGroup.classList.add("hidden");
  }
}

function showFeedbackAdv(message, type) {
  feedbackAdv.textContent = message;
  feedbackAdv.className = `feedback ${type}`;
  feedbackAdv.classList.remove("hidden");
}

async function saveAdvanced() {
  const id = selectService.value;
  const apiKey = inputApiKey.value.trim();
  const warnThreshold = parseInt(selectWarnThreshold.value, 10);

  if (id !== "osrm" && !apiKey) {
    showFeedbackAdv("Clé API requise.", "error");
    return;
  }

  await browser.storage.local.set({ routingService: { id, apiKey }, warnThreshold });
  showFeedbackAdv("Options enregistrées ✓", "success");

  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0 && tabs[0].url && /leforem\.be|ictjob\.be|indeed\.com/.test(tabs[0].url)) {
    browser.tabs.sendMessage(tabs[0].id, { type: "refresh" }).catch(() => {});
  }
}

// --- Load saved city on open ---

async function loadSavedCity() {
  const result = await browser.storage.local.get(["departure", "routingService", "requestCounts", "warnThreshold"]);
  if (result.departure && result.departure.city) {
    currentCityName.textContent = result.departure.city;
    inputFrom.value = result.departure.city;
  }
  if (result.routingService) {
    selectService.value = result.routingService.id || "osrm";
    inputApiKey.value   = result.routingService.apiKey || "";
  }
  selectWarnThreshold.value = String(result.warnThreshold !== undefined ? result.warnThreshold : 50);
  onServiceChange(result.requestCounts || {});
}

// --- Save city ---

async function saveCity() {
  const city = inputFrom.value.trim();
  if (!city) {
    showFeedback("Veuillez entrer un nom de ville.", "error");
    return;
  }

  showSpinner();

  try {
    const coords = await geocode(city);
    if (!coords) {
      showFeedback(`Ville introuvable : "${city}". Vérifiez l'orthographe.`, "error");
      return;
    }

    await browser.storage.local.set({
      departure: { city, lat: coords.lat, lon: coords.lon },
    });

    currentCityName.textContent = city;
    showFeedback("Ville enregistrée ✓", "success");

    // Notify active leforem.be tab to refresh badges
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0 && tabs[0].url && /leforem\.be|ictjob\.be|indeed\.com/.test(tabs[0].url)) {
      browser.tabs.sendMessage(tabs[0].id, { type: "refresh" }).catch(() => {
        // Tab may not have the content script loaded yet — ignore silently
      });
    }
  } catch (err) {
    await logError("saveCity", err);
    const m = err.message && err.message.match(/\b(\d{3})\b/);
    const code = m ? parseInt(m[1]) : 0;
    const msg = code >= 500 ? `Erreur serveur Nominatim (${code}). Réessayez plus tard.`
               : code ? `Erreur ${code} lors de la géolocalisation.`
               : "Erreur réseau. Vérifiez votre connexion.";
    showFeedback(msg, "error");
    console.error(err);
  } finally {
    hideSpinner();
  }
}

// --- Bug report ---

async function loadErrorReport() {
  const s = await browser.storage.local.get("errorLog");
  const count = Array.isArray(s.errorLog) ? s.errorLog.length : 0;
  errorCountBadge.textContent = count > 0 ? `${count} erreur(s) enregistrée(s)` : "";
  errorCountBadge.classList.toggle("hidden", count === 0);
  btnClearErrors.classList.toggle("hidden", count === 0);
}

async function buildReportMarkdown() {
  const s = await browser.storage.local.get(["departure", "routingService", "errorLog"]);
  const dep = s.departure;
  const svc = s.routingService || { id: "osrm", apiKey: "" };
  const log = Array.isArray(s.errorLog) ? s.errorLog : [];

  const svcLabels = {
    osrm: "OSRM (gratuit, sans clé)",
    openrouteservice: "OpenRouteService",
    here: "HERE Routing",
    google: "Google Maps",
  };
  const svcLabel  = svcLabels[svc.id] || svc.id;
  const apiKeyInfo = svc.apiKey ? "clé API configurée" : "sans clé API";
  const depCity   = dep ? dep.city : "Non configurée";

  const lines = [
    `## Rapport automatique — Trajet Emploi v2.0`,
    `**Date :** ${new Date().toUTCString()}`,
    `**Service :** ${svcLabel} (${apiKeyInfo})`,
    `**Ville de départ :** ${depCity}`,
    `**Navigateur :** ${navigator.userAgent}`,
    ``,
  ];

  if (log.length > 0) {
    lines.push(`### Journal d'erreurs (${log.length})`);
    lines.push(`| Heure | Contexte | Message |`);
    lines.push(`|-------|----------|---------|`);
    for (const e of log) {
      const heure = e.t ? e.t.substring(11, 19) : "?";
      const ctx   = e.ctx || "";
      const msg   = (e.msg || "").replace(/\|/g, "\\|");
      lines.push(`| ${heure} | ${ctx} | ${msg} |`);
    }
  } else {
    lines.push(`*Aucune erreur enregistrée.*`);
  }

  lines.push(``, `---`, `**Décrivez votre problème ci-dessous :**`, ``);
  return lines.join("\n");
}

async function sendBugReport() {
  const text = await buildReportMarkdown();
  await navigator.clipboard.writeText(text);
  browser.tabs.create({ url: GITHUB_ISSUES_URL });
  btnBugReport.textContent = "Copié + onglet ouvert ✓";
  setTimeout(() => { btnBugReport.textContent = "🐛 Signaler un bug"; }, 3000);
}

async function clearErrors() {
  await browser.storage.local.remove("errorLog");
  loadErrorReport();
}

// --- Live update listener ---

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "progressUpdate") {
    updatePopupProgress(message.completed, message.total);
  }
  if (message.type === "countUpdated" && selectService.value === message.serviceId) {
    browser.storage.local.get("requestCounts").then((s) =>
      renderGauge(message.serviceId, s.requestCounts || {})
    );
  }
  if (message.type === "errorLogged") {
    loadErrorReport();
  }
});

// --- Event listeners ---

btnSave.addEventListener("click", saveCity);

inputFrom.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveCity();
});

selectService.addEventListener("change", onServiceChange);

btnApiHelp.addEventListener("click", () => {
  const url = HELP_URLS[selectService.value];
  if (url) browser.tabs.create({ url });
});

btnSaveAdv.addEventListener("click", saveAdvanced);

btnBugReport.addEventListener("click", sendBugReport);
btnClearErrors.addEventListener("click", clearErrors);

// --- Init ---

loadSavedCity();
loadErrorReport();

browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
  if (tabs.length > 0 && tabs[0].url && /leforem\.be|ictjob\.be|indeed\.com/.test(tabs[0].url)) {
    browser.tabs.sendMessage(tabs[0].id, { type: "getProgress" })
      .then((r) => { if (r) updatePopupProgress(r.completed, r.total); })
      .catch(() => {});
  }
});
