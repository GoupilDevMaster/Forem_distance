"use strict";

const { currentPeriodKey } = require("../background");

describe("currentPeriodKey", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("day — 2026-02-26T10:30:00Z → '2026-02-26'", () => {
    jest.setSystemTime(new Date("2026-02-26T10:30:00Z"));
    expect(currentPeriodKey("day")).toBe("2026-02-26");
  });

  test("month — 2026-02-26T10:30:00Z → '2026-02'", () => {
    jest.setSystemTime(new Date("2026-02-26T10:30:00Z"));
    expect(currentPeriodKey("month")).toBe("2026-02");
  });

  test("day — 2025-12-31T23:59:59Z → '2025-12-31'", () => {
    jest.setSystemTime(new Date("2025-12-31T23:59:59Z"));
    expect(currentPeriodKey("day")).toBe("2025-12-31");
  });

  test("month — 2025-12-31T23:59:59Z → '2025-12'", () => {
    jest.setSystemTime(new Date("2025-12-31T23:59:59Z"));
    expect(currentPeriodKey("month")).toBe("2025-12");
  });
});
