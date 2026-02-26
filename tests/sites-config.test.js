"use strict";

const { SITES } = require("../lib/sites-config");

const forem   = SITES.find((s) => s.id === "forem");
const ictjob  = SITES.find((s) => s.id === "ictjob");
const indeed  = SITES.find((s) => s.id === "indeed");

// ─── SITES[forem].getValue ────────────────────────────────────────────────────

describe("SITES[forem].getValue", () => {
  test("attribut value présent → retourne sa valeur", () => {
    const el = document.createElement("div");
    el.setAttribute("value", "Liège");
    expect(forem.getValue(el)).toBe("Liège");
  });

  test("pas d'attribut, dd.refValue présent → textContent du dd", () => {
    const el = document.createElement("div");
    const dd = document.createElement("dd");
    dd.className = "refValue";
    dd.textContent = "Namur";
    el.appendChild(dd);
    expect(forem.getValue(el)).toBe("Namur");
  });

  test("pas d'attribut, dd simple → textContent du dd", () => {
    const el = document.createElement("div");
    const dd = document.createElement("dd");
    dd.textContent = "Bruxelles";
    el.appendChild(dd);
    expect(forem.getValue(el)).toBe("Bruxelles");
  });

  test("élément vide → null", () => {
    const el = document.createElement("div");
    expect(forem.getValue(el)).toBeNull();
  });
});

// ─── SITES[forem].getTarget ───────────────────────────────────────────────────

describe("SITES[forem].getTarget", () => {
  test("dd.refValue présent → retourne ce dd", () => {
    const el = document.createElement("div");
    const dd = document.createElement("dd");
    dd.className = "refValue";
    el.appendChild(dd);
    expect(forem.getTarget(el)).toBe(dd);
  });

  test("dd simple → retourne ce dd", () => {
    const el = document.createElement("div");
    const dd = document.createElement("dd");
    el.appendChild(dd);
    expect(forem.getTarget(el)).toBe(dd);
  });

  test("élément vide → retourne el", () => {
    const el = document.createElement("div");
    expect(forem.getTarget(el)).toBe(el);
  });
});

// ─── SITES[indeed].getValue ───────────────────────────────────────────────────

describe("SITES[indeed].getValue", () => {
  test("ville simple → inchangé", () => {
    const el = document.createElement("div");
    el.textContent = "Charleroi";
    expect(indeed.getValue(el)).toBe("Charleroi");
  });

  test("'Travail hybride à Namur' → 'Namur'", () => {
    const el = document.createElement("div");
    el.textContent = "Travail hybride à Namur";
    expect(indeed.getValue(el)).toBe("Namur");
  });

  test("'Travail hybride à 5101 Namur' → '5101 Namur'", () => {
    const el = document.createElement("div");
    el.textContent = "Travail hybride à 5101 Namur";
    expect(indeed.getValue(el)).toBe("5101 Namur");
  });

  test("whitespace seul → null", () => {
    const el = document.createElement("div");
    el.textContent = "   ";
    expect(indeed.getValue(el)).toBeNull();
  });
});

// ─── SITES[indeed].getTarget ─────────────────────────────────────────────────

describe("SITES[indeed].getTarget", () => {
  test("retourne toujours el", () => {
    const el = document.createElement("div");
    expect(indeed.getTarget(el)).toBe(el);
  });
});

// ─── SITES[ictjob].getValue ───────────────────────────────────────────────────

describe("SITES[ictjob].getValue", () => {
  function makeJobLocation(city) {
    const outer = document.createElement("span");
    outer.setAttribute("itemprop", "jobLocation");
    const addr = document.createElement("span");
    addr.setAttribute("itemprop", "address");
    const loc = document.createElement("span");
    loc.setAttribute("itemprop", "addressLocality");
    loc.textContent = city;
    addr.appendChild(loc);
    outer.appendChild(addr);
    return outer;
  }

  test("ville présente → retourne le textContent", () => {
    expect(ictjob.getValue(makeJobLocation("Machelen"))).toBe("Machelen");
  });

  test("whitespace seul → null", () => {
    expect(ictjob.getValue(makeJobLocation("   "))).toBeNull();
  });

  test("sans addressLocality → null", () => {
    const el = document.createElement("span");
    el.setAttribute("itemprop", "jobLocation");
    expect(ictjob.getValue(el)).toBeNull();
  });
});

// ─── SITES[ictjob].getTarget ─────────────────────────────────────────────────

describe("SITES[ictjob].getTarget", () => {
  test("retourne le span addressLocality quand présent", () => {
    const outer = document.createElement("span");
    const loc = document.createElement("span");
    loc.setAttribute("itemprop", "addressLocality");
    outer.appendChild(loc);
    expect(ictjob.getTarget(outer)).toBe(loc);
  });

  test("retourne el si pas de addressLocality", () => {
    const el = document.createElement("span");
    expect(ictjob.getTarget(el)).toBe(el);
  });
});

// ─── urlPattern ──────────────────────────────────────────────────────────────

describe("urlPattern", () => {
  test("forem matche leforem.be",       () => expect(forem.urlPattern.test("www.leforem.be")).toBe(true));
  test("forem ne matche pas ictjob",    () => expect(forem.urlPattern.test("ictjob.be")).toBe(false));
  test("ictjob matche www.ictjob.be",   () => expect(ictjob.urlPattern.test("www.ictjob.be")).toBe(true));
  test("ictjob ne matche pas indeed",   () => expect(ictjob.urlPattern.test("indeed.com")).toBe(false));
  test("indeed matche be.indeed.com",   () => expect(indeed.urlPattern.test("be.indeed.com")).toBe(true));
  test("indeed ne matche pas forem",    () => expect(indeed.urlPattern.test("leforem.be")).toBe(false));
});
