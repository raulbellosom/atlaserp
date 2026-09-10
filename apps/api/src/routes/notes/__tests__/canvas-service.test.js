// apps/api/src/routes/notes/__tests__/canvas-service.test.js
//
// Coverage for the canvas scene service:
//   - pure helpers: whitelistAppState, extractSceneText, defaultLayer
//   - getScene: read-access gate, empty-scene shape, stored-scene shape
//   - saveScene: edit-access gate, size ceiling, appState whitelist,
//     content_text extraction, version bump
//   - getPublicScene: 404 on non-public, render-safe projection only
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createCanvasService,
  CanvasServiceError,
  whitelistAppState,
  extractSceneText,
  defaultLayer,
} from "../canvas-service.js";

const OWNER = "01900000-0000-7000-8000-000000000001";
const OTHER = "01900000-0000-7000-8000-000000000002";
const NOTE = "01900000-0000-7000-8000-0000000000aa";

function sql(strings) {
  return (Array.isArray(strings) ? strings.join(" ? ") : String(strings)).replace(/\s+/g, " ").trim();
}

// Build a prisma stub from a list of [substringMatcher, rowsOrFn] rules.
// Rules are checked in order; the first whose needle appears in the SQL wins.
function fakePrisma(rules) {
  const run = (strings, ...values) => {
    const text = sql(strings);
    for (const [needle, out] of rules) {
      if (text.toLowerCase().includes(needle.toLowerCase())) {
        return Promise.resolve(typeof out === "function" ? out(values, text) : out);
      }
    }
    return Promise.resolve([]);
  };
  return { $queryRaw: run, $executeRaw: run };
}

describe("canvas-service — pure helpers", () => {
  it("whitelistAppState keeps only allowed keys", () => {
    const out = whitelistAppState({
      gridModeEnabled: true,
      gridSize: 20,
      snapToGrid: true,
      viewBackgroundColor: "#fff",
      scrollX: 999,
      scrollY: 999,
      zoom: { value: 3 },
      collaborators: { a: 1 },
      selectedElementIds: { x: true },
      somethingElse: "nope",
    });
    assert.deepEqual(out, {
      gridModeEnabled: true,
      gridSize: 20,
      snapToGrid: true,
      viewBackgroundColor: "#fff",
    });
  });

  it("whitelistAppState on a non-object returns {}", () => {
    assert.deepEqual(whitelistAppState(null), {});
    assert.deepEqual(whitelistAppState("x"), {});
    assert.deepEqual(whitelistAppState([1, 2]), {});
  });

  it("extractSceneText concatenates text elements, ignores deleted and non-text", () => {
    const els = [
      { type: "text", text: "hola" },
      { type: "text", text: "mundo", isDeleted: true },
      { type: "rectangle" },
      { type: "text", text: "adios" },
    ];
    assert.equal(extractSceneText(els), "hola adios");
  });

  it("extractSceneText handles empty / non-array", () => {
    assert.equal(extractSceneText([]), "");
    assert.equal(extractSceneText(null), "");
  });

  it("defaultLayer returns a fresh layer each call with a unique id", () => {
    const a = defaultLayer();
    const b = defaultLayer();
    assert.equal(a.name, "Capa 1");
    assert.equal(a.visible, true);
    assert.equal(a.locked, false);
    assert.equal(a.opacity, 1);
    assert.equal(a.order, 0);
    assert.notEqual(a.id, b.id);
  });
});

describe("canvas-service — getScene", () => {
  it("owner with no scene row gets an empty scene with one layer", async () => {
    const svc = createCanvasService({
      prisma: fakePrisma([
        ["from notes where id", [{ id: NOTE }]],
        ["from note_canvas_scene", []],
      ]),
    });
    const scene = await svc.getScene(NOTE, OWNER);
    assert.deepEqual(scene.elements, []);
    assert.deepEqual(scene.files, {});
    assert.equal(scene.version, 0);
    assert.equal(scene.layers.length, 1);
    assert.equal(scene.layers[0].name, "Capa 1");
  });

  it("throws 404 for a user with no access", async () => {
    const svc = createCanvasService({ prisma: fakePrisma([]) });
    await assert.rejects(
      () => svc.getScene(NOTE, OTHER),
      (e) => e instanceof CanvasServiceError && e.status === 404,
    );
  });

  it("returns the stored scene", async () => {
    const svc = createCanvasService({
      prisma: fakePrisma([
        ["from notes where id", [{ id: NOTE }]],
        [
          "from note_canvas_scene",
          [
            {
              elements: [{ type: "rectangle", id: "r1" }],
              app_state: { gridModeEnabled: true },
              layers: [{ id: "L1", name: "Capa 1", visible: true, locked: false, opacity: 1, order: 0 }],
              files: { f1: { url: "https://x/f1.png" } },
              version: 7,
            },
          ],
        ],
      ]),
    });
    const scene = await svc.getScene(NOTE, OWNER);
    assert.equal(scene.version, 7);
    assert.equal(scene.elements[0].id, "r1");
    assert.equal(scene.appState.gridModeEnabled, true);
    assert.equal(scene.files.f1.url, "https://x/f1.png");
  });
});

describe("canvas-service — saveScene", () => {
  const emptyScene = { elements: [], appState: {}, layers: [], files: {} };

  it("a read-only collaborator cannot save (403)", async () => {
    // edit-access check returns no row
    const svc = createCanvasService({ prisma: fakePrisma([["permission = 'edit'", []]]) });
    await assert.rejects(
      () => svc.saveScene(NOTE, OTHER, emptyScene),
      (e) => e instanceof CanvasServiceError && e.status === 403,
    );
  });

  it("rejects an oversized scene with 413", async () => {
    const svc = createCanvasService({ prisma: fakePrisma([["permission = 'edit'", [{ id: NOTE }]]]) });
    const huge = {
      elements: [{ type: "text", text: "x".repeat(11 * 1024 * 1024) }],
      appState: {},
      layers: [],
      files: {},
    };
    await assert.rejects(
      () => svc.saveScene(NOTE, OWNER, huge),
      (e) => e instanceof CanvasServiceError && e.status === 413,
    );
  });

  it("whitelists appState, extracts content_text, bumps version", async () => {
    const calls = [];
    const svc = createCanvasService({
      prisma: fakePrisma([
        ["permission = 'edit'", [{ id: NOTE }]],
        [
          "insert into note_canvas_scene",
          (values, text) => {
            calls.push({ text, values });
            return [{ version: 3 }];
          },
        ],
        [
          "update notes",
          (values, text) => {
            calls.push({ text, values });
            return [];
          },
        ],
      ]),
    });
    const res = await svc.saveScene(NOTE, OWNER, {
      elements: [
        { type: "text", text: "buscar esto" },
        { type: "rectangle" },
      ],
      appState: { gridModeEnabled: true, scrollX: 500, zoom: { value: 2 } },
      layers: [{ id: "L1", name: "Capa 1", visible: true, locked: false, opacity: 1, order: 0 }],
      files: {},
    });
    assert.deepEqual(res, { ok: true, version: 3 });

    const insert = calls.find((c) => c.text.toLowerCase().includes("insert into note_canvas_scene"));
    const persistedAppState = insert.values
      .map((v) => {
        try {
          return typeof v === "string" ? JSON.parse(v) : v;
        } catch {
          return null;
        }
      })
      .find((v) => v && typeof v === "object" && "gridModeEnabled" in v);
    assert.deepEqual(persistedAppState, { gridModeEnabled: true });

    const notesUpdate = calls.find((c) => c.text.toLowerCase().includes("update notes"));
    assert.equal(notesUpdate.values.includes("buscar esto"), true);
  });
});

describe("canvas-service — getPublicScene", () => {
  it("throws 404 when not public / not a canvas", async () => {
    const svc = createCanvasService({ prisma: fakePrisma([]) });
    await assert.rejects(
      () => svc.getPublicScene("nope"),
      (e) => e instanceof CanvasServiceError && e.status === 404,
    );
  });

  it("returns render-safe fields only, keyed for the client", async () => {
    let capturedSql = "";
    const svc = createCanvasService({
      prisma: fakePrisma([
        [
          "public_slug",
          (_values, text) => {
            capturedSql = text.toLowerCase();
            return [
              {
                note_id: NOTE,
                title: "Mi lienzo",
                icon: "shapes",
                elements: [{ id: "r1", type: "rectangle" }],
                app_state: { gridModeEnabled: false },
                layers: [{ id: "L1", name: "Capa 1", visible: true, locked: false, opacity: 1, order: 0 }],
                files: {},
                version: 4,
              },
            ];
          },
        ],
      ]),
    });
    const scene = await svc.getPublicScene("slug-abc");
    assert.deepEqual(
      Object.keys(scene).sort(),
      ["appState", "elements", "files", "icon", "layers", "noteId", "title", "version"],
    );
    assert.equal(scene.noteId, NOTE);
    assert.equal(scene.company_id, undefined);
    assert.equal(scene.owner_user_id, undefined);
    // The SELECT list must not pull internal identifiers.
    const selectList = capturedSql.slice(capturedSql.indexOf("select"), capturedSql.indexOf(" from "));
    assert.ok(!selectList.includes("owner_user_id"));
    assert.ok(!selectList.includes("company_id"));
    assert.ok(!selectList.includes("folder_id"));
  });
});
