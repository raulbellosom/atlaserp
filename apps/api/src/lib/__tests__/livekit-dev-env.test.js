import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { loadInstallerLiveKitDevEnv } from "../livekit-dev-env.js";

async function fixture(content) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-livekit-env-"));
  const currentDir = path.join(root, "apps", "api", "src");
  const installerDir = path.join(root, "infra", "installer");
  await fs.mkdir(currentDir, { recursive: true });
  await fs.mkdir(installerDir, { recursive: true });
  await fs.writeFile(path.join(installerDir, ".env.local"), content, "utf8");
  return { root, currentDir };
}

describe("LiveKit development env fallback", () => {
  it("loads only LiveKit values and maps the container hostname to localhost", async () => {
    const { root, currentDir } = await fixture([
      "LIVEKIT_MODE=embedded",
      "LIVEKIT_URL=ws://localhost:7880",
      "LIVEKIT_INTERNAL_URL=http://livekit:7880",
      "LIVEKIT_API_KEY=dev-key",
      "LIVEKIT_API_SECRET=dev-secret",
      "DATABASE_URL=must-not-leak",
    ].join("\n"));
    const env = {};
    try {
      assert.equal(loadInstallerLiveKitDevEnv({ currentDir, env }), true);
      assert.equal(env.LIVEKIT_INTERNAL_URL, "http://localhost:7880");
      assert.equal(env.LIVEKIT_API_SECRET, "dev-secret");
      assert.equal(env.DATABASE_URL, undefined);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("preserves explicit values and does nothing in production", async () => {
    const { root, currentDir } = await fixture("LIVEKIT_API_KEY=installer-key\n");
    try {
      const explicit = { LIVEKIT_API_KEY: "explicit-key" };
      assert.equal(loadInstallerLiveKitDevEnv({ currentDir, env: explicit }), false);
      assert.equal(explicit.LIVEKIT_API_KEY, "explicit-key");

      const production = { NODE_ENV: "production" };
      assert.equal(loadInstallerLiveKitDevEnv({ currentDir, env: production }), false);
      assert.equal(production.LIVEKIT_API_KEY, undefined);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
