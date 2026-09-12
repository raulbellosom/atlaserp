export const NATIVE_CSP = "frame-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"

export function nativeHostHeaders() {
  return {
    name: 'atlas-native-host-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (String(req.headers['user-agent']).includes('AtlasNativeHost/')) {
          res.setHeader('Content-Security-Policy', NATIVE_CSP)
          res.setHeader('Cache-Control', 'no-store')
        }
        next()
      })
    },
  }
}
