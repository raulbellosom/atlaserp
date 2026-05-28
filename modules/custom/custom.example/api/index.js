import { Hono } from 'hono'

export default function createRouter({ prisma }) {
  const app = new Hono()

  app.get('/example/ping', (c) => c.json({ message: 'custom.example is alive' }))

  return app
}
