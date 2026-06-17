import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { sql } from "drizzle-orm"
import { serve } from "@hono/node-server"
import { env } from "./env"
import { db } from "@cronko/database"
import { findUserByEmail, createUser } from "@cronko/database/queries/users"
import { hashPassword } from "./services/auth"
import { startScheduler, stopScheduler, schedulerMetrics } from "./services/scheduler"
import { app } from "./app"
import { logger } from "./lib/logger"

if (env.AUTO_MIGRATE === "true") {
  if (env.DATABASE_URL.startsWith("file:")) {
    migrate(db, { migrationsFolder: "../../packages/database/src/migrations" })
    logger.info("SQLite migrations applied")
  } else {
    const { migrate: migratePg } = await import("drizzle-orm/postgres-js/migrator")
    await migratePg(db, { migrationsFolder: "../../packages/database/src/migrations" })
    logger.info("PostgreSQL migrations applied")
  }
}

async function seedAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return

  const existing = await findUserByEmail(env.ADMIN_EMAIL)
  if (existing) return

  const hash = await hashPassword(env.ADMIN_PASSWORD)
  await createUser({ email: env.ADMIN_EMAIL, passwordHash: hash })
  logger.info({ email: env.ADMIN_EMAIL }, "admin user created")
}

seedAdmin().then(() => {
  // Health endpoints
  app.get("/health", (c) =>
    c.json({ ok: true, uptime: process.uptime() }),
  )

  // Liveness probe — verifica se o processo está vivo
  app.get("/health/live", (c) =>
    c.json({ status: "ok" }),
  )

  // Readiness probe — verifica se pode receber tráfego (DB conectado)
  app.get("/health/ready", async (c) => {
    try {
      const { db } = await import("@cronko/database")
      await db.select({ val: sql`1` }).get()
      return c.json({ status: "ok", checks: { database: "up" } })
    } catch (err) {
      logger.error({ err }, "readiness check failed")
      return c.json(
        { status: "error", checks: { database: "down" } },
        503,
      )
    }
  })

  // Scheduler metrics endpoint
  app.get("/health/metrics", (c) =>
    c.json({
      uptime: process.uptime(),
      scheduler: {
        lastTickAt: schedulerMetrics.lastTickAt,
        lastTickDurationMs: schedulerMetrics.lastTickDurationMs,
        tickErrors: schedulerMetrics.tickErrors,
        monitorsChecked: schedulerMetrics.monitorsChecked,
      },
      memory: process.memoryUsage()
    }),
  )

  startScheduler()

  const server = serve({ fetch: app.fetch, port: env.API_PORT, hostname: env.API_HOST })

  let shuttingDown = false

  const shutdown = (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, "shutting down gracefully")
    stopScheduler()
    server.close(() => {
      logger.info("server closed")
      process.exit(0)
    })
    setTimeout(() => {
      logger.error("forced shutdown after timeout")
      process.exit(1)
    }, 10_000)
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
})
