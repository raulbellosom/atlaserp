#!/usr/bin/env node

const REQUIRED_VEHICLE_KEYS = [
  "vehicle_model_name",
  "vehicle_brand_name",
  "vehicle_type_name",
  "economic_number",
];

const CATALOG_PATHS = [
  "/fleet/catalogs/vehicle-types",
  "/fleet/catalogs/vehicle-brands",
  "/fleet/catalogs/maintenance-types",
  "/fleet/catalogs/vehicle-models",
];

const FEATURE_PATHS = [
  "/fleet/vehicles",
  "/fleet/drivers",
  "/fleet/maintenance",
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

async function expectStatus(pathname, expectedStatus, customToken) {
  const url = `${baseUrl}${pathname}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${customToken || token}`,
    },
  });
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected ${expectedStatus} for ${pathname}, got ${response.status}`,
    );
  }
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

  for (const path of CATALOG_PATHS) {
    await getJson(path);
    console.log(`OK ${path}`);
  }

  for (const path of FEATURE_PATHS) {
    await getJson(path);
    console.log(`OK ${path}`);
  }

  const vehiclesPayload = await getJson("/fleet/vehicles");
  console.log("OK /fleet/vehicles");

  const records = extractRecords(vehiclesPayload);
  if (records.length === 0) {
    console.log("WARN /fleet/vehicles empty; relational key validation skipped.");
  } else {
    validateVehicleKeys(records);
    console.log("OK /fleet/vehicles relational fields");
  }

  const tokenWithoutFleet = (process.env.ATLAS_TOKEN_NO_FLEET || "").trim();
  if (tokenWithoutFleet) {
    await expectStatus("/fleet/vehicles", 403, tokenWithoutFleet);
    console.log("OK RBAC 403 /fleet/vehicles (sin permisos fleet)");
  } else {
    console.log(
      "SKIP RBAC check (set ATLAS_TOKEN_NO_FLEET to validate 403 explicitly)",
    );
  }

  const tokenOtherCompany = (process.env.ATLAS_TOKEN_OTHER_COMPANY || "").trim();
  if (tokenOtherCompany) {
    const primary = await getJson("/fleet/vehicles");
    const secondaryResponse = await fetch(`${baseUrl}/fleet/vehicles`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenOtherCompany}`,
      },
    });
    if (secondaryResponse.status !== 200) {
      throw new Error(
        `Expected 200 for /fleet/vehicles with ATLAS_TOKEN_OTHER_COMPANY, got ${secondaryResponse.status}`,
      );
    }
    const secondary = await secondaryResponse.json();
    const primaryRows = extractRecords(primary).map((row) => row.id).filter(Boolean);
    const secondaryRows = extractRecords(secondary).map((row) => row.id).filter(Boolean);
    const overlap = secondaryRows.filter((id) => primaryRows.includes(id));
    if (overlap.length > 0) {
      throw new Error(
        `Company isolation failed: found shared vehicle ids across companies (${overlap.join(", ")})`,
      );
    }
    console.log("OK company isolation /fleet/vehicles");
  } else {
    console.log(
      "SKIP company isolation check (set ATLAS_TOKEN_OTHER_COMPANY to validate)",
    );
  }
}

main().catch((error) => {
  console.error(`Smoke failed: ${error.message}`);
  process.exit(1);
});
