import { Hono } from "hono"
import { cors } from "hono/cors"
import { authenticate } from "./middleware/authenticate"
import { pingRoute } from "./routes/ping"
import { authRoute } from "./routes/auth"
import { monitorsRoute } from "./routes/monitors"
import { incidentsRoute } from "./routes/incidents"
import { notificationsRoute } from "./routes/notifications"
import { statsRoute } from "./routes/stats"
import { settingsRoute } from "./routes/settings"

const app = new Hono()

app.use("*", cors({
  origin: [
    "http://localhost:3000",
    process.env.NEXT_PUBLIC_API_URL ?? "",
  ].filter(Boolean),
  credentials: true,
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}))

app.onError((err, c) => {
  console.error(err)
  return c.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    500,
  )
})

app.route("/ping", pingRoute)
app.route("/auth", authRoute)

app.get("/badge/:token", async (c) => {
  const { findMonitorByToken } = await import("@cronko/database/queries/monitors")
  const token = c.req.param("token") ?? ""
  const monitor = await findMonitorByToken(token)

  if (!monitor) {
    return c.text("monitor not found", 404)
  }

  const colors: Record<string, string> = {
    healthy: "#10b981",
    missed: "#f59e0b",
    down: "#ef4444",
    paused: "#6b7280",
    pending: "#3b82f6",
  }
  const labels: Record<string, string> = {
    healthy: "healthy",
    missed: "missed",
    down: "down",
    paused: "paused",
    pending: "pending",
  }

  const color = colors[monitor.status] ?? "#6b7280"
  const label = labels[monitor.status] ?? monitor.status
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
  <rect width="60" height="20" fill="#555" rx="3"/>
  <rect x="60" width="60" height="20" fill="${color}" rx="3"/>
  <text x="30" y="14" text-anchor="middle" fill="#fff" font-size="10" font-family="sans-serif">cronko</text>
  <text x="90" y="14" text-anchor="middle" fill="#fff" font-size="10" font-family="sans-serif">${label}</text>
</svg>`

  return c.text(svg, 200, { "Content-Type": "image/svg+xml", "Cache-Control": "no-cache" })
})

const api = new Hono()
api.use("*", authenticate)
api.route("/monitors", monitorsRoute)
api.route("/incidents", incidentsRoute)
api.route("/notifications", notificationsRoute)
api.route("/stats", statsRoute)
api.route("/settings", settingsRoute)

app.route("/api", api)

export { app }
export type AppType = typeof app