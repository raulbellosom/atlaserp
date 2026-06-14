import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("files service allows GrowthLead assets", async () => {
  const source = await readFile(
    new URL("../files-service.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /ALLOWED_FILE_ENTITY_TYPES[\s\S]*"GrowthLead"/);
});
