export async function register(registry) {
  if (typeof window === 'undefined') return

  const { default: ExampleScreen } = await import('./ExampleScreen.jsx')
  registry.register('custom.example:ExampleScreen', ExampleScreen)
}
