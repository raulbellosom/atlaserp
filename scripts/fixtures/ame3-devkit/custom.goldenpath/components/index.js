export async function register(registry) {
  if (typeof window === 'undefined') return
  const { default: ModuleDashboard } = await import('./ModuleDashboard.jsx')
  registry.register('custom.goldenpath:ModuleDashboard', ModuleDashboard)
}
