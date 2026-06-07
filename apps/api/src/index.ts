import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { serve } from "@hono/node-server"
import { env } from "./env"
import { db } from "@cronko/database"
import { findUserByEmail, createUser } from "@cronko/database/queries/users"
import { hashPassword } from "./services/auth"
import { startScheduler, stopScheduler } from "./services/scheduler"
import { app } from "./app"

if (env.DATABASE_URL.startsWith("file:")) {
  migrate(db, { migrationsFolder: "../../packages/database/src/migrations" })
}

async function seedAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return

  const existing = await findUserByEmail(env.ADMIN_EMAIL)
  if (existing) return

  const hash = await hashPassword(env.ADMIN_PASSWORD)
  await createUser({ email: env.ADMIN_EMAIL, passwordHash: hash })
  console.log("Admin user created:", env.ADMIN_EMAIL)
}

seedAdmin().then(() => {
  app.get("/health", (c) => c.json({ ok: true }))

  startScheduler()

  const server = serve({ fetch: app.fetch, port: env.API_PORT, hostname: env.API_HOST })

  let shuttingDown = false

  const shutdown = (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`Received ${signal}, shutting down gracefully...`)
    stopScheduler()
    server.close(() => {
      console.log("Server closed")
      process.exit(0)
    })
    setTimeout(() => {
      console.error("Forced shutdown after timeout")
      process.exit(1)
    }, 10_000)
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
})
