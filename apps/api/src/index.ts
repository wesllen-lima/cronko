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
import { getRedis } from "./lib/redis"

async function applyMigrations() {
  if (env.AUTO_MIGRATE !== "true") return

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

async function bootstrap() {
  // 1. Apply migrations first — tables must exist before any queries
  await applyMigrations()

  // 2. Seed admin user
  await seedAdmin()

  // Health endpoints
  app.get("/health", (c) =>
    c.json({ ok: true, uptime: process.uptime() }),
  )

  // Liveness probe
  app.get("/health/live", (c) =>
    c.json({ status: "ok" }),
  )

  // Readiness probe — database connectivity
  app.get("/health/ready", async (c) => {
    try {
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
      memory: process.memoryUsage(),
    }),
  )

  // 3. Start scheduler and HTTP server
  startScheduler()

  const server = serve({ fetch: app.fetch, port: env.API_PORT, hostname: env.API_HOST })

  let shuttingDown = false

  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, "shutting down gracefully")

    stopScheduler()

    // Close Redis connection gracefully
    const redis = getRedis()
    if (redis) {
      try {
        await redis.quit()
        logger.info("redis disconnected")
      } catch {
        redis.disconnect()
      }
    }

    // Close HTTP server — allow in-flight requests to finish
    server.close(() => {
      logger.info("server closed")
      process.exitCode = 0
    })

    // Force shutdown after 30s as safety net
    setTimeout(() => {
      logger.error("forced shutdown after timeout")
      process.exitCode = 1
    }, 30_000).unref()
  }

  process.on("SIGTERM", () => { shutdown("SIGTERM").catch(() => {}) })
  process.on("SIGINT", () => { shutdown("SIGINT").catch(() => {}) })
}

bootstrap().catch((err) => {
  logger.error({ err }, "bootstrap failed")
  process.exit(1)
})