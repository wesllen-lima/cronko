import { Hono } from "hono"
import { findHeartbeatsSince } from "@cronko/database/queries/heartbeats"
import { findAllMonitors } from "@cronko/database/queries/monitors"
import { calculateUptime } from "@cronko/shared/utils"
import type { Heartbeat } from "@cronko/shared"

export const statsRoute = new Hono()

statsRoute.get("/", async (c) => {
  try {
    const monitors = await findAllMonitors()

    let healthyCount = 0
    let downCount = 0
    let missedCount = 0
    let pausedCount = 0

    for (const m of monitors) {
      if (m.status === "healthy") healthyCount++
      else if (m.status === "down") downCount++
      else if (m.status === "missed") missedCount++
      else if (m.status === "paused") pausedCount++
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentHeartbeats = await findHeartbeatsSince(twentyFourHoursAgo)

    const totalHeartbeats = recentHeartbeats.length

    let uptimeTotal = 0
    let monitorsWithHeartbeats = 0

    for (const monitor of monitors) {
      const monitorHeartbeats = recentHeartbeats.filter(
        (hb: { monitorId: string }) => hb.monitorId === monitor.id,
      )

      if (monitorHeartbeats.length > 0) {
        const uptime = calculateUptime(
          monitorHeartbeats as unknown as Heartbeat[],
          { expectedIntervalSeconds: monitor.expectedIntervalSeconds },
        )
        uptimeTotal += uptime
        monitorsWithHeartbeats++
      }
    }

    const uptimePercent =
      monitorsWithHeartbeats > 0
        ? Math.round((uptimeTotal / monitorsWithHeartbeats) * 100) / 100
        : 0

    const heartbeatsByHour = Array.from({ length: 24 }, (_, i) => {
      const hourStart = new Date(twentyFourHoursAgo.getTime() + i * 60 * 60 * 1000)
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
      return recentHeartbeats.filter(
        (hb: { receivedAt: Date }) =>
          hb.receivedAt >= hourStart && hb.receivedAt < hourEnd,
      ).length
    })

    return c.json({
      data: {
        healthyCount,
        downCount,
        missedCount,
        pausedCount,
        totalHeartbeats,
        uptimePercent,
        heartbeatsByHour,
      },
    })
  } catch (err) {
    console.error("Stats route error:", err)
    return c.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, 500)
  }
})