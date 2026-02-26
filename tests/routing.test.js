"use strict";

const { getRouteOSRM, OSRM_URL } = require("../lib/routing");

function mockFetch(data, ok = true, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => data,
  });
}

describe("getRouteOSRM", () => {
  afterEach(() => jest.resetAllMocks());

  test("même ville (distance 0)", async () => {
    mockFetch({ code: "Ok", routes: [{ distance: 0, duration: 0 }] });
    const coords = { lat: 50.4014, lon: 4.4041 };
    const result = await getRouteOSRM(coords, coords);
    expect(result).toEqual({ distance: 0, duration: 0 });
    // Vérifier ordre lon,lat dans l'URL
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("4.4041,50.4014;4.4041,50.4014"),
    );
  });

  test("trajet normal", async () => {
    mockFetch({ code: "Ok", routes: [{ distance: 18000, duration: 1380 }] });
    const from = { lat: 50.4014, lon: 4.4041 };
    const to   = { lat: 50.6292, lon: 5.5797 };
    const result = await getRouteOSRM(from, to);
    expect(result).toEqual({ distance: 18000, duration: 1380 });
  });

  test("réponse HTTP 500 → throw Error('OSRM 500')", async () => {
    mockFetch({}, false, 500);
    const coords = { lat: 50.4014, lon: 4.4041 };
    await expect(getRouteOSRM(coords, coords)).rejects.toThrow("OSRM 500");
  });

  test("code NoRoute → null", async () => {
    mockFetch({ code: "NoRoute", routes: [] });
    const coords = { lat: 50.4014, lon: 4.4041 };
    const result = await getRouteOSRM(coords, coords);
    expect(result).toBeNull();
  });
});
