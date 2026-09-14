import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildConversationActions, fullSwipeAction } from "../buildConversationActions.js";

const actionsOf = (conv, opts) => buildConversationActions(conv, opts).map((a) => a.action);

describe("buildConversationActions", () => {
  it("returns [] for a nullish conversation", () => {
    assert.deepEqual(buildConversationActions(null), []);
  });

  it("direct chat, default state: pin, mute, archive, delete", () => {
    assert.deepEqual(actionsOf({ type: "direct" }), ["pin", "mute", "archive", "delete"]);
  });

  it("shows 'read' only when there are unread messages", () => {
    assert.ok(!actionsOf({ type: "direct", unread_count: 0 }).includes("read"));
    assert.deepEqual(
      actionsOf({ type: "direct", unread_count: 3 }),
      ["pin", "mute", "read", "archive", "delete"],
    );
  });

  it("flips pin/mute/archive labels by state", () => {
    const a = buildConversationActions({
      type: "direct", is_pinned: true, is_muted: true, is_archived: true,
    });
    const byKey = Object.fromEntries(a.map((x) => [x.key, x]));
    assert.equal(byKey.pin.action, "unpin");
    assert.equal(byKey.pin.label, "Desfijar");
    assert.equal(byKey.mute.action, "unmute");
    assert.equal(byKey.archive.action, "unarchive");
    assert.equal(byKey.archive.label, "Desarchivar");
  });

  it("channel as manager -> 'delete' (Eliminar canal); as member -> 'leave'", () => {
    assert.ok(actionsOf({ type: "channel", my_role: "owner" }).includes("delete"));
    assert.ok(actionsOf({ type: "channel", my_role: "admin" }).includes("delete"));
    const asMember = buildConversationActions({ type: "channel", my_role: "member" });
    const last = asMember[asMember.length - 1];
    assert.equal(last.action, "leave");
    assert.equal(last.label, "Salir del canal");
  });

  it("group nouns", () => {
    const mgr = buildConversationActions({ type: "group", my_role: "owner" });
    assert.equal(mgr[mgr.length - 1].label, "Eliminar grupo");
    const mem = buildConversationActions({ type: "group", my_role: "member" });
    assert.equal(mem[mem.length - 1].label, "Salir del grupo");
  });

  it("external_support has no delete/leave", () => {
    const a = actionsOf({ type: "external_support" });
    assert.ok(!a.includes("delete") && !a.includes("leave"));
  });

  it("destructive actions are flagged and toned", () => {
    const del = buildConversationActions({ type: "direct" }).find((a) => a.action === "delete");
    assert.equal(del.destructive, true);
    assert.equal(del.tone, "danger");
  });
});

describe("fullSwipeAction", () => {
  it("archive when active, unarchive when archived", () => {
    assert.equal(fullSwipeAction({ is_archived: false }), "archive");
    assert.equal(fullSwipeAction({ is_archived: true }), "unarchive");
  });
});
