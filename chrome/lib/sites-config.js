"use strict";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const RATE_LIMIT_MS = 1100; // >1 s between Nominatim requests (policy)

const SITES = [
  {
    id: "forem",
    urlPattern: /leforem\.be/,
    selector: 'forem-formattedcard-list-element[icon="fal fa-map-marker-alt"]',
    getValue(el) {
      const attrVal = el.getAttribute("value");
      if (attrVal && attrVal.trim()) return attrVal.trim();
      const dd = el.querySelector("dd.refValue") || el.querySelector("dd");
      return dd ? dd.textContent.trim() : null;
    },
    getTarget(el) {
      return el.querySelector("dd.refValue") || el.querySelector("dd") || el;
    },
  },
  {
    id: "ictjob",
    urlPattern: /ictjob\.be/,
    selector: '[itemprop="jobLocation"]',
    getValue(el) {
      const loc = el.querySelector('[itemprop="addressLocality"]');
      return loc ? loc.textContent.trim() || null : null;
    },
    getTarget(el) {
      return el.querySelector('[itemprop="addressLocality"]') || el;
    },
  },
  {
    id: "stepstone",
    urlPattern: /stepstone\.be/,
    selector: '[data-at="job-item-location"]',
    getValue(el) {
      const text = el.querySelector('[data-genesis-element="TEXT"]');
      return text ? text.textContent.trim() || null : null;
    },
    getTarget(el) { return el; },
  },
  {
    id: "techjobs",
    urlPattern: /techjobs\.be/,
    selector: ".job-info-badge",
    getValue(el) {
      const icon = el.querySelector("i.fa-location-dot");
      if (!icon) return null;
      const span = icon.closest("span");
      // textContent contient \u00a0 (nbsp) avant la ville
      return span ? span.textContent.replace(/[\u00a0\s]+/g, " ").trim() || null : null;
    },
    getTarget(el) {
      const icon = el.querySelector("i.fa-location-dot");
      return (icon && icon.closest("span")) || el;
    },
  },
  {
    id: "linkedin",
    urlPattern: /linkedin\.com\/jobs/,
    selector: "ul.job-card-container__metadata-wrapper li:first-child",
    getValue(el) {
      const span = el.querySelector("span[dir='ltr']");
      if (!span) return null;
      // "Waregem, Région flamande, Belgique (Sur site)" → "Waregem, Région flamande, Belgique"
      return span.textContent.trim().replace(/\s*\([^)]*\)\s*$/, "").trim() || null;
    },
    getTarget(el) { return el; },
  },
  {
    id: "jobat",
    urlPattern: /jobat\.be/,
    selector: ".jobCard-location",
    getValue(el) { return el.textContent.trim() || null; },
    getTarget(el) { return el; },
  },
  {
    id: "brusselsjobs",
    urlPattern: /brusselsjobs\.com/,
    selector: ".location",
    getValue(el) { return el.textContent.trim() || null; },
    getTarget(el) { return el; },
  },
  {
    id: "monster",
    urlPattern: /monster\.be/,
    selector: ".search_company_info ul li:first-child",
    getValue(el) { return el.textContent.trim() || null; },
    getTarget(el) { return el; },
  },
  {
    id: "indeed",
    urlPattern: /indeed\.com/,
    selector: '[data-testid="text-location"]',
    getValue(el) {
      // Ex: "6040 Charleroi" ou "Travail hybride à 5101 Namur"
      const raw = el.textContent.trim();
      // Extraire après " à " si présent
      const afterA = raw.match(/à\s+(.+)$/i);
      if (afterA) return afterA[1].trim();
      return raw || null;
    },
    getTarget(el) { return el; },
  },
];

if (typeof module !== "undefined") module.exports = { SITES, NOMINATIM_URL, RATE_LIMIT_MS };
