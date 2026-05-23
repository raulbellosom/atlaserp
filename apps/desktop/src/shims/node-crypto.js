// Browser stub for node:crypto — only the checksum utility in module-engine
// uses createHash, and it runs server-side only. This stub prevents the
// "module externalized for browser compatibility" Vite error.
export const createHash = () => ({
  update: () => ({ digest: () => "" }),
});
export default { createHash };
