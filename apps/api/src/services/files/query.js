import { fileKindWhereClauses } from "@atlas/core";

const KINDS = fileKindWhereClauses();

export function fileKindWhere(kind) {
  if (kind === "generic") return { NOT: { OR: Object.values(KINDS) } };
  return KINDS[kind] ?? {};
}
