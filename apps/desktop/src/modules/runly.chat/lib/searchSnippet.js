// Turn a message body + [start,end] match ranges (character offsets into
// `body`, as returned by /chat/search/messages) into an ordered list of
// { text, mark } segments, windowed to `radius` chars around the first match so
// long messages don't blow out the results row. Pure — unit-tested.
export function buildSnippetSegments(body, matchRanges, radius = 80) {
  const text = body ?? "";
  const ranges = Array.isArray(matchRanges)
    ? [...matchRanges]
        .filter((r) => Array.isArray(r) && r.length === 2 && r[1] > r[0])
        .sort((a, b) => a[0] - b[0])
    : [];

  if (!ranges.length) {
    return { segments: [{ text, mark: false }], truncatedStart: false, truncatedEnd: false };
  }

  const firstStart = ranges[0][0];
  const lastEnd = ranges[ranges.length - 1][1];
  const winStart = Math.max(0, firstStart - radius);
  const winEnd = Math.min(text.length, lastEnd + radius);
  const truncatedStart = winStart > 0;
  const truncatedEnd = winEnd < text.length;

  const segments = [];
  let cursor = winStart;
  for (const [s, e] of ranges) {
    const clampedS = Math.max(s, winStart);
    const clampedE = Math.min(e, winEnd);
    if (clampedE <= winStart || clampedS >= winEnd) continue;
    if (clampedS > cursor) segments.push({ text: text.slice(cursor, clampedS), mark: false });
    segments.push({ text: text.slice(clampedS, clampedE), mark: true });
    cursor = clampedE;
  }
  if (cursor < winEnd) segments.push({ text: text.slice(cursor, winEnd), mark: false });

  return { segments, truncatedStart, truncatedEnd };
}
