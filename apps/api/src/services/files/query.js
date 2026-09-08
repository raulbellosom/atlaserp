const mime = (value) => ({ mimeType: { startsWith: value } });
const KINDS = {
  image: mime("image/"),
  video: mime("video/"),
  audio: mime("audio/"),
  pdf: { mimeType: "application/pdf" },
  sheet: {
    OR: [
      mime("application/vnd.openxmlformats-officedocument.spreadsheetml"),
      mime("application/vnd.ms-excel"),
      { mimeType: "text/csv" },
    ],
  },
  doc: {
    OR: [
      mime("application/vnd.openxmlformats-officedocument.wordprocessingml"),
      { mimeType: "application/msword" },
    ],
  },
  presentation: {
    OR: [
      mime("application/vnd.openxmlformats-officedocument.presentationml"),
      mime("application/vnd.ms-powerpoint"),
    ],
  },
  text: {
    AND: [
      { OR: [mime("text/"), { mimeType: "application/json" }] },
      { NOT: { mimeType: "text/csv" } },
    ],
  },
};
export function fileKindWhere(kind) {
  if (kind === "generic") return { NOT: { OR: Object.values(KINDS) } };
  return KINDS[kind] ?? {};
}
