#!/usr/bin/env node

const REQUIRED_VEHICLE_KEYS = [
  "vehicle_model_name",
  "vehicle_brand_name",
  "vehicle_type_name",
  "economic_number",
];

const baseUrl = (process.env.ATLAS_API_URL || "http://localhost:4010").replace(
  /\/+$/,
  "",
);
const token = (process.env.ATLAS_TOKEN || "").trim();

if (!token) {
  console.error(
    "Missing ATLAS_TOKEN. Export a valid user token before running this smoke test.",
  );
  process.exit(1);
}

async function getJson(pathname) {
  const url = `${baseUrl}${pathname}`;
  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    throw new Error(`Request failed for ${pathname}: ${error.message}`);
  }

  if (response.status !== 200) {
    throw new Error(`Expected 200 for ${pathname}, got ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Expected JSON response for ${pathname}`);
  }

  return response.json();
}

function extractRecords(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

function validateVehicleKeys(records) {
  for (const record of records) {
    for (const key of REQUIRED_VEHICLE_KEYS) {
      if (!(key in record)) {
        throw new Error(`Missing required key in /fleet/vehicles response: ${key}`);
      }
    }
  }
}

async function main() {
  await getJson("/health");
  console.log("OK /health");

  await getJson("/fleet/catalogs/vehicle-models");
  console.log("OK /fleet/catalogs/vehicle-models");

  const vehiclesPayload = await getJson("/fleet/vehicles");
  console.log("OK /fleet/vehicles");

  const records = extractRecords(vehiclesPayload);
  if (records.length === 0) {
    console.log("No vehicles found; response shape verified at endpoint level only.");
    return;
  }

  validateVehicleKeys(records);
  console.log("OK /fleet/vehicles relational fields");
}

main().catch((error) => {
  console.error(`Smoke failed: ${error.message}`);
  process.exit(1);
});
