export function getMobilePwaInstallMode({
  platform,
  standalone,
  activeModuleKey,
  canInstall,
  manualInstallReady,
}) {
  const isMobile =
    platform === "ios" ||
    platform === "android" ||
    platform === "mobile";

  if (!isMobile || standalone || !activeModuleKey) return null;
  if (canInstall) return "prompt";
  if (manualInstallReady) return "instructions";
  return "prepare";
}
