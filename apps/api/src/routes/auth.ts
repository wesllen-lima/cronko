import { Hono } from "hono"
import { setCookie, deleteCookie } from "hono/cookie"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { findUserByEmail } from "@cronko/database/queries/users"
import { verifyPassword, generateToken } from "../services/auth"
import { authenticate } from "../middleware/authenticate"

export const authRoute = new Hono()

const loginStore = new Map<string, { count: number; resetAt: number }>()
const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of loginStore) {
    if (now >= entry.resetAt) loginStore.delete(key)
  }
}, 60_000).unref()

function checkLoginRateLimit(ip: string, email: string): boolean {
  const key = `${ip}:${email}`
  const now = Date.now()
  const entry = loginStore.get(key)

  if (entry && now < entry.resetAt) {
    if (entry.count >= MAX_LOGIN_ATTEMPTS) return false
    entry.count++
  } else {
    loginStore.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
  }
  return true
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

authRoute.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json")

  const ip = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "127.0.0.1"

  if (!checkLoginRateLimit(ip, email)) {
    return c.json(
      { error: "Too many login attempts. Try again later.", code: "RATE_LIMITED" },
      429,
    )
  }

  const user = await findUserByEmail(email)

  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401)
  }

  const valid = await verifyPassword(password, user.password)

  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401)
  }

  const token = await generateToken(user.id, user.email)

  setCookie(c, "cronko_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  })

  const now = Math.floor(Date.now() / 1000)
  const expiresAt = new Date((now + 7 * 24 * 60 * 60) * 1000).toISOString()

  return c.json({
    data: {
      token,
      email: user.email,
      expiresAt,
    },
  })
})

authRoute.post("/logout", authenticate, async (c) => {
  deleteCookie(c, "cronko_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
  })
  return c.json({ data: { ok: true } })
})

authRoute.get("/me", authenticate, async (c) => {
  const payload = c.get("jwtPayload") as { sub: string; email: string }

  return c.json({
    data: {
      id: payload.sub,
      email: payload.email,
    },
  })
})
