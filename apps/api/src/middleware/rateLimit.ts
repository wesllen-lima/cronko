import type { Context, Next } from "hono"
import { PING_RATE_LIMIT_PER_MINUTE } from "@cronko/shared/constants"

const store = new Map<string, { count: number; resetAt: number }>()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key)
  }
}, 60_000).unref()

export async function rateLimit(c: Context, next: Next) {
  const token = c.req.param("token") ?? ""
  const now = Date.now()
  const entry = store.get(token)

  if (entry && now < entry.resetAt) {
    if (entry.count >= PING_RATE_LIMIT_PER_MINUTE) {
      return c.json(
        { error: "Rate limit exceeded", code: "RATE_LIMITED" },
        429,
      )
    }
    entry.count++
  } else {
    store.set(token, { count: 1, resetAt: now + 60_000 })
  }

  await next()
}