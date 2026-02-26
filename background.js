"use strict";

const QUOTAS = {
  openrouteservice: { max: 500,    resetPeriod: "day",   label: "OpenRouteService" },
  here:             { max: 250000, resetPeriod: "month", label: "HERE Routing" },
  google:           { max: 40000,  resetPeriod: "month", label: "Google Maps" },
};
const THRESHOLDS = [50, 75, 90, 100];

function currentPeriodKey(resetPeriod) {
  const iso = new Date().toISOString();
  return resetPeriod === "day" ? iso.slice(0, 10) : iso.slice(0, 7);
}

async function trackRequest(serviceId) {
  const quota = QUOTAS[serviceId];
  if (!quota) return;

  const stored = await browser.storage.local.get(["requestCounts", "warnThreshold"]);
  const counts = stored.requestCounts || {};
  const minThreshold = stored.warnThreshold !== undefined ? stored.warnThreshold : 50;
  const nowKey = currentPeriodKey(quota.resetPeriod);

  const entry = counts[serviceId] || { count: 0, periodKey: nowKey, notifiedThresholds: [] };
  if (entry.periodKey !== nowKey) {
    entry.count = 0;
    entry.periodKey = nowKey;
    entry.notifiedThresholds = [];
  }

  entry.count += 1;
  const pct = (entry.count / quota.max) * 100;

  const newThresholds = THRESHOLDS.filter(
    (t) => t >= minThreshold && pct >= t && !entry.notifiedThresholds.includes(t)
  );
  entry.notifiedThresholds = entry.notifiedThresholds.concat(newThresholds);
  counts[serviceId] = entry;
  await browser.storage.local.set({ requestCounts: counts });

  const periodLabel = quota.resetPeriod === "day" ? "aujourd'hui" : "ce mois-ci";
  for (const t of newThresholds) {
    const remaining = quota.max - entry.count;
    const msg = t === 100
      ? `Quota ${quota.label} épuisé ${periodLabel} (${quota.max} req).`
      : `${t}% du quota ${quota.label} utilisé ${periodLabel} — ${remaining} req restantes.`;
    browser.notifications.create({
      type: "basic",
      iconUrl: "icons/icon-48.png",
      title: "Forem Distance — Quota API",
      message: msg,
    });
  }

  browser.runtime.sendMessage({
    type: "countUpdated", serviceId, count: entry.count, periodKey: entry.periodKey,
  }).catch(() => {});
}

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "trackRequest") trackRequest(message.serviceId);
});
