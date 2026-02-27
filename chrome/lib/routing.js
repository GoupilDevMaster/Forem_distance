"use strict";

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

async function getRouteOSRM(from, to) {
  const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  const response = await fetch(`${OSRM_URL}/${coords}?overview=false`);
  if (!response.ok) throw new Error(`OSRM ${response.status}`);
  const data = await response.json();
  if (data.code !== "Ok" || !data.routes || data.routes.length === 0) return null;
  return { distance: data.routes[0].distance, duration: data.routes[0].duration };
}

if (typeof module !== "undefined") module.exports = { getRouteOSRM, OSRM_URL };
