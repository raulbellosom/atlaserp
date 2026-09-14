// Normalize each configuration source before merging it. This lets an explicit
// process override beat a stored value even when they use different brand names.
export function withRunlyEnvAliases(...sources) {
  const result = {};
  for (const source of sources) {
    Object.assign(result, source);
    for (const key of Object.keys(source ?? {})) {
      if (!/^(VITE_)?(ATLAS|RUNLY)_/.test(key)) continue;
      const current = key.replace(/^(VITE_)?ATLAS_/, '$1RUNLY_');
      const legacy = current.replace(/^(VITE_)?RUNLY_/, '$1ATLAS_');
      const value = source[current] ?? source[legacy];
      if (value === undefined) continue;
      result[current] = value;
      result[legacy] = value;
    }
  }
  return result;
}

// Keep the raw quoting/value of existing configuration, changing only the key.
// If both spellings exist, the canonical assignment is authoritative.
export function canonicalizeRunlyEnvText(text) {
  const currentKeys = new Set([...text.matchAll(/^(?:VITE_)?RUNLY_[A-Z0-9_]+(?==)/gm)].map(match => match[0]));
  return text.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^((?:VITE_)?ATLAS_[A-Z0-9_]+)=/);
    if (!match) return [line];
    const current = match[1].replace(/^(VITE_)?ATLAS_/, '$1RUNLY_');
    return currentKeys.has(current) ? [] : [current + line.slice(match[1].length)];
  }).join('\n');
}

// Refresh generated defaults without dropping existing Runly/Atlas settings.
// Preserve raw stored values (including quotes); process overrides are explicit.
export function mergeRunlyEnvText(generated, stored, environment = {}) {
  const assignments = new Map();
  for (const text of [generated, stored]) {
    for (const line of canonicalizeRunlyEnvText(text).split(/\r?\n/)) {
      const match = line.match(/^((?:VITE_)?RUNLY_[A-Z0-9_]+)=/);
      if (match) assignments.set(match[1], line);
    }
  }
  const overrides = withRunlyEnvAliases(environment);
  for (const key of assignments.keys()) {
    if (overrides[key] !== undefined) assignments.set(key, `${key}=${JSON.stringify(String(overrides[key]))}`);
  }
  const output = canonicalizeRunlyEnvText(generated).split(/\r?\n/).flatMap(line => {
    const match = line.match(/^((?:VITE_)?RUNLY_[A-Z0-9_]+)=/);
    if (!match) return [line];
    const assignment = assignments.get(match[1]);
    assignments.delete(match[1]);
    return assignment ? [assignment] : [];
  });
  return [...output, ...assignments.values(), ''].join('\n');
}
