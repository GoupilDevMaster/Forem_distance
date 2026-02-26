"use strict";

function formatDistance(meters) {
  return (meters / 1000).toFixed(0) + " km";
}

function formatDuration(seconds) {
  const totalMin = Math.round(seconds / 60);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

function classifyError(err) {
  if (!err || !err.message) return "Erreur inconnue";
  const m = err.message.match(/\b(\d{3})\b/);
  if (!m) return "Erreur réseau";
  const code = parseInt(m[1]);
  if (code === 401 || code === 403) return "Clé API invalide";
  if (code === 429) return "Quota API dépassé";
  if (code >= 500) return `Erreur serveur (${code})`;
  return `Erreur HTTP ${code}`;
}

function gaugeColor(pct) {
  if (pct >= 90) return "#e74c3c";
  if (pct >= 75) return "#e67e22";
  if (pct >= 50) return "#f1c40f";
  return "#27ae60";
}

if (typeof module !== "undefined") module.exports = { formatDistance, formatDuration, classifyError, gaugeColor };
