import { getModuleKeyAliases } from '@runly/core';

// Exact persisted records always win: a pre-existing Runly-named module must
// never be replaced by an unrelated Atlas record through alias resolution.
export async function resolvePersistedModuleKey(prisma, key) {
  const [, counterpart] = getModuleKeyAliases(key);
  if (!counterpart) return key;
  const exact = await prisma.runlyModule.findUnique({ where: { key }, select: { key: true } });
  if (exact) return key;
  const alias = await prisma.runlyModule.findUnique({ where: { key: counterpart }, select: { key: true } });
  return alias?.key ?? key;
}
