import { findMonitorByToken, updateMonitorStatus } from "@cronko/database/queries/monitors"
import {
  createHeartbeat,
  findLatestHeartbeat,
  updateHeartbeatDuration,
} from "@cronko/database/queries/heartbeats"
import {
  createIncident,
  findOpenIncident,
  resolveIncident,
} from "@cronko/database/queries/incidents"

export async function processHeartbeat(
  token: string,
  options: {
    sourceIp?: string
    userAgent?: string
    durationMs?: number
    exitCode?: number
    body?: string
    pulseType?: "start" | "finish"
  },
) {
  const monitor = await findMonitorByToken(token)

  if (!monitor) {
    return { ok: false, status: 404, error: "Monitor not found" }
  }

  if (monitor.paused) {
    return { ok: true, data: { status: "paused" } }
  }

  const heartbeatId = crypto.randomUUID()

  const prevPulse = await findLatestHeartbeat(monitor.id)

  if (options.pulseType === "finish" && options.durationMs !== undefined && options.durationMs !== null) {
    if (prevPulse && prevPulse.durationMs === null) {
      await updateHeartbeatDuration(prevPulse.id, options.durationMs)
      await createHeartbeat({
        id: heartbeatId,
        monitorId: monitor.id,
        ...(options.sourceIp !== undefined && { sourceIp: options.sourceIp }),
        ...(options.userAgent !== undefined && { userAgent: options.userAgent }),
        durationMs: options.durationMs,
        ...(options.exitCode !== undefined && { exitCode: options.exitCode }),
        body: "pulse:finish",
      })
    }
  } else {
    await createHeartbeat({
      id: heartbeatId,
      monitorId: monitor.id,
      ...(options.sourceIp !== undefined && { sourceIp: options.sourceIp }),
      ...(options.userAgent !== undefined && { userAgent: options.userAgent }),
      ...(options.durationMs !== undefined && { durationMs: options.durationMs }),
      ...(options.exitCode !== undefined && { exitCode: options.exitCode }),
      ...(options.body !== undefined && { body: options.body }),
    })
  }

  if (options.durationMs !== undefined && options.durationMs !== null && (monitor as { maxDurationMs?: number }).maxDurationMs) {
    const maxDuration = (monitor as { maxDurationMs: number }).maxDurationMs
    if (options.durationMs > maxDuration && monitor.status !== "down") {
      await createIncident({
        id: crypto.randomUUID(),
        monitorId: monitor.id,
        startedAt: new Date(),
      })
      if (monitor.status !== "missed") {
        await updateMonitorStatus(monitor.id, "missed")
      }
    }
  }

  if (monitor.status === "missed" || monitor.status === "down" || monitor.status === "pending") {
    await updateMonitorStatus(monitor.id, "healthy")

    const openIncident = await findOpenIncident(monitor.id)
    if (openIncident) {
      await resolveIncident(openIncident.id, new Date())
    }
  }

  return {
    ok: true,
    data: {
      ok: true,
      monitorId: monitor.id,
      receivedAt: prevPulse?.receivedAt.toISOString() ?? new Date().toISOString(),
    },
  }
}