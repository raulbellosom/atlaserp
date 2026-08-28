import path from "node:path";
import { config as loadEnv } from "dotenv";

const LIVEKIT_ENV_KEYS = [
  "LIVEKIT_MODE",
  "LIVEKIT_DOMAIN",
  "LIVEKIT_TLS_MODE",
  "LIVEKIT_URL",
  "LIVEKIT_INTERNAL_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
];

function normalizeHostInternalUrl(value) {
  if (!value) return value;
  try {
    const url = new URL(value);
    if (["livekit", "host.docker.internal"].includes(url.hostname)) {
      url.hostname = "localhost";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

export function loadInstallerLiveKitDevEnv({ currentDir, env = process.env } = {}) {
  if (!currentDir || env.NODE_ENV === "production") return false;

  const installerEnv = {};
  const result = loadEnv({
    path: path.resolve(currentDir, "../../../infra/installer/.env.local"),
    processEnv: installerEnv,
    quiet: true,
  });
  if (result.error) return false;

  let loaded = false;
  for (const key of LIVEKIT_ENV_KEYS) {
    if (env[key] || !installerEnv[key]) continue;
    env[key] = key === "LIVEKIT_INTERNAL_URL"
      ? normalizeHostInternalUrl(installerEnv[key])
      : installerEnv[key];
    loaded = true;
  }
  return loaded;
}
