import { test } from "node:test";
import assert from "node:assert/strict";
import { startMeeting } from "../startMeeting.js";

function setup(error, linkError) {
  const events = [];
  return {
    events,
    options: {
      resolveTargetId: async () => "new-room",
      createLink: async (id) => { events.push(["link", id]); if (linkError) throw linkError; },
      startCall: async (args) => { events.push(["call", args]); if (error) throw error; return true; },
      discardNewRoom: async (id) => { events.push(["discard", id]); },
    },
  };
}

test("prepares the guest link before starting a host-only meeting", async () => {
  const { events, options } = setup();
  assert.equal(await startMeeting(options), true);
  assert.deepEqual(events, [
    ["link", "new-room"],
    ["call", { conversationId: "new-room", kind: "VIDEO", throwOnError: true }],
  ]);
});

test("a rejected start cleans up the newly created room and preserves the actual error", async () => {
  const error = Object.assign(new Error("No hay otra persona"), { status: 422 });
  const { events, options } = setup(error);
  await assert.rejects(startMeeting(options), (actual) => actual === error);
  assert.deepEqual(events.at(-1), ["discard", "new-room"]);
});

test("a link failure cleans up without attempting a call", async () => {
  const error = new Error("Link unavailable");
  const { events, options } = setup(null, error);
  await assert.rejects(startMeeting(options), (actual) => actual === error);
  assert.deepEqual(events, [["link", "new-room"], ["discard", "new-room"]]);
});

test("an ambiguous network or server failure keeps the room for retry", async () => {
  for (const status of [undefined, 500]) {
    const { events, options } = setup(Object.assign(new Error("Connection lost"), { status }));
    await assert.rejects(startMeeting(options));
    assert.equal(events.some(([event]) => event === "discard"), false);
  }
});

test("cleanup failure does not obscure the call error", async () => {
  const error = Object.assign(new Error("Rejected"), { status: 422 });
  const { options } = setup(error);
  options.discardNewRoom = async () => { throw new Error("Offline"); };
  await assert.rejects(startMeeting(options), (actual) => actual === error);
});

test("a rejected join does not discard a room with an existing call", async () => {
  const { events, options } = setup(Object.assign(new Error("Join rejected"), { status: 403, callMayExist: true }));
  await assert.rejects(startMeeting(options));
  assert.equal(events.some(([event]) => event === "discard"), false);
});
