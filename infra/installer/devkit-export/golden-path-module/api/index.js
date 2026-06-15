import { Hono } from 'hono'

export default function createGoldenPathRouter() {
  const app = new Hono()

  app.get('/goldenpath/samples', (c) => {
    return c.json({ data: [] })
  })

  app.get('/goldenpath/summary', (c) => {
    return c.json({ data: { total: 0 } })
  })

  return app
}
