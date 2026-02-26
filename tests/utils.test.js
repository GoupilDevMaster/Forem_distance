"use strict";

const { formatDistance, formatDuration, classifyError, gaugeColor } = require("../lib/utils");

describe("formatDistance", () => {
  test("0 m → '0 km'",   () => expect(formatDistance(0)).toBe("0 km"));
  test("1000 m → '1 km'", () => expect(formatDistance(1000)).toBe("1 km"));
  test("18000 m → '18 km'", () => expect(formatDistance(18000)).toBe("18 km"));
});

describe("formatDuration", () => {
  test("0 s → '0 min'",     () => expect(formatDuration(0)).toBe("0 min"));
  test("600 s → '10 min'",  () => expect(formatDuration(600)).toBe("10 min"));
  test("3600 s → '1h'",     () => expect(formatDuration(3600)).toBe("1h"));
  test("5460 s → '1h 31min'", () => expect(formatDuration(5460)).toBe("1h 31min"));
  test("7200 s → '2h'",     () => expect(formatDuration(7200)).toBe("2h"));
});

describe("classifyError", () => {
  test("null → 'Erreur inconnue'",                  () => expect(classifyError(null)).toBe("Erreur inconnue"));
  test("Network → 'Erreur réseau'",                 () => expect(classifyError({ message: "Network" })).toBe("Erreur réseau"));
  test("OSRM 401 → 'Clé API invalide'",             () => expect(classifyError({ message: "OSRM 401" })).toBe("Clé API invalide"));
  test("ORS 403 → 'Clé API invalide'",              () => expect(classifyError({ message: "ORS 403" })).toBe("Clé API invalide"));
  test("HERE 429 → 'Quota API dépassé'",            () => expect(classifyError({ message: "HERE 429" })).toBe("Quota API dépassé"));
  test("OSRM 500 → 'Erreur serveur (500)'",         () => expect(classifyError({ message: "OSRM 500" })).toBe("Erreur serveur (500)"));
  test("OSRM 404 → 'Erreur HTTP 404'",              () => expect(classifyError({ message: "OSRM 404" })).toBe("Erreur HTTP 404"));
});

describe("gaugeColor", () => {
  test("0 → '#27ae60'",   () => expect(gaugeColor(0)).toBe("#27ae60"));
  test("49 → '#27ae60'",  () => expect(gaugeColor(49)).toBe("#27ae60"));
  test("50 → '#f1c40f'",  () => expect(gaugeColor(50)).toBe("#f1c40f"));
  test("75 → '#e67e22'",  () => expect(gaugeColor(75)).toBe("#e67e22"));
  test("90 → '#e74c3c'",  () => expect(gaugeColor(90)).toBe("#e74c3c"));
  test("100 → '#e74c3c'", () => expect(gaugeColor(100)).toBe("#e74c3c"));
});
