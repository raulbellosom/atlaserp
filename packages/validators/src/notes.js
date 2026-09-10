import { z } from "zod";

// atlas.notes — canvas note type.
//
// Note bodies (document notes) are not Zod-validated at the route today; this
// module only adds the canvas-scene contract. Element internals are
// Excalidraw's authority, so `elements` stays permissive on purpose — the API
// whitelists `appState` keys and enforces the payload size ceiling.

export const noteTypeSchema = z.enum(["document", "canvas"]);

export const canvasLayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
  opacity: z.number().min(0).max(1),
  order: z.number(),
});

export const canvasSceneSchema = z.object({
  elements: z.array(z.any()).default([]),
  appState: z.record(z.any()).default({}),
  layers: z.array(canvasLayerSchema).default([]),
  files: z.record(z.any()).default({}),
});

export const noteCreateSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.any().optional(),
  folderId: z.string().uuid().optional().nullable(),
  icon: z.string().max(100).optional(),
  backgroundColor: z.string().max(50).optional().nullable(),
  noteType: noteTypeSchema.optional().default("document"),
});
