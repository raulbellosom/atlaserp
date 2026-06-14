export function parseMentionIds(body) {
  if (!body) return []
  const regex = /@\[([a-f0-9-]{36}):[^\]]+\]/g
  const ids = []
  let m
  while ((m = regex.exec(body)) !== null) ids.push(m[1])
  return [...new Set(ids)]
}
