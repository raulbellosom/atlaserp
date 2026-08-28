import crypto from "node:crypto";
import { RoomServiceClient } from "livekit-server-sdk";

const internalUrl = String(process.env.LIVEKIT_INTERNAL_URL ?? "").trim();
const publicUrl = String(process.env.LIVEKIT_URL ?? "").trim();
const apiKey = String(process.env.LIVEKIT_API_KEY ?? "").trim();
const apiSecret = String(process.env.LIVEKIT_API_SECRET ?? "").trim();

if (!internalUrl || !apiKey || !apiSecret) {
  throw new Error(
    "LIVEKIT_INTERNAL_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET are required.",
  );
}

const healthResponse = await fetch(`${internalUrl.replace(/\/$/, "")}/`, {
  signal: AbortSignal.timeout(10_000),
});
if (!healthResponse.ok) {
  throw new Error(`LiveKit health endpoint returned HTTP ${healthResponse.status}.`);
}

const roomName = `atlas-installer-smoke-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const rooms = new RoomServiceClient(internalUrl, apiKey, apiSecret);
let created = false;
let deleted = false;

try {
  await rooms.createRoom({
    name: roomName,
    emptyTimeout: 30,
    departureTimeout: 10,
    maxParticipants: 2,
  });
  created = true;
  if (/^wss:\/\//i.test(publicUrl)) {
    const publicHttpUrl = publicUrl.replace(/^wss:/i, "https:");
    const publicRooms = new RoomServiceClient(publicHttpUrl, apiKey, apiSecret);
    await publicRooms.deleteRoom(roomName);
  } else {
    await rooms.deleteRoom(roomName);
  }
  deleted = true;
} finally {
  if (created && !deleted) {
    try { await rooms.deleteRoom(roomName); } catch { /* Preserve the smoke-test error. */ }
  }
}

console.log(JSON.stringify({ ok: true, roomCreated: true, roomDeleted: true }));
