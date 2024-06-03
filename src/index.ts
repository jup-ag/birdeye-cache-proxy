import { Hono } from 'hono'

const app = new Hono()

app.get('/defi/*', (c) => {
  // Add cache API to cache birdeye responses
  return c.text('Hello Hono!')
})

export default app
