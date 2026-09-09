// apps/desktop/src/modules/atlas.chat/lib/pendingAttachments.js
//
// Pure helpers for the composer's pending-attachment queue. Kept out of
// MessageComposer.jsx so the branching logic is unit-testable (this repo has
// no React-component test runner).

import { isAudioAttachment } from "./chatUtils.js";

// Map the composer's pending-file entries to the shape ChatAttachmentViewer /
// AdvancedFileViewer expect. Audio / voice notes are excluded — they are
// played inline in the bubble after send and have no viewer treatment.
export function mapPendingToViewerFiles(pendingFiles) {
  return (pendingFiles ?? [])
    .filter((entry) => {
      const name = entry?.file?.name ?? "";
      const mimeType = entry?.file?.type ?? "";
      return !isAudioAttachment({ fileName: name, mimeType });
    })
    .map((entry) => {
      const name = entry?.file?.name ?? "archivo";
      return {
        id: entry.localId,
        mimeType: entry?.file?.type ?? "",
        fileName: name,
        originalName: name,
        sizeBytes: entry?.file?.size ?? 0,
        url: entry.objectUrl ?? null,
        thumbnailUrl: entry.objectUrl ?? null,
      };
    });
}

// attachmentIds of queue entries whose upload finished but which were NOT part
// of a successful send (their localId is absent from sentLocalIds). These are
// the rows the composer must ask the server to discard on remove / unmount.
export function attachmentIdsToDiscard(pendingFiles, sentLocalIds) {
  const sent = sentLocalIds ?? new Set();
  return (pendingFiles ?? [])
    .filter((entry) => entry?.attachmentId && !sent.has(entry.localId))
    .map((entry) => entry.attachmentId);
}
