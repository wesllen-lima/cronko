import { findAllMonitors, updateMonitorStatus } from "@cronko/database/queries/monitors"
import { findLatestHeartbeat, deleteHeartbeatsOlderThan } from "@cronko/database/queries/heartbeats"
import { createIncident, findOpenIncident, resolveIncident } from "@cronko/database/queries/incidents"
import { sendNotification } from "./notifier"
import { currentSettings } from "../routes/settings"
import { logger } from "../lib/logger"

let intervalId: ReturnType<typeof setInterval> | null = null

let isRunning = false

let lastCleanupDay = 0

export const schedulerMetrics = {
  lastTickAt: 0,
  lastTickDurationMs: 0,
  tickErrors: 0,
  monitorsChecked: 0,
}

async function cleanupOldHeartbeats() {
  const today = new Date().getDate()
  if (today === lastCleanupDay) return
  lastCleanupDay = today

  try {
    const retentionDays = currentSettings.heartbeatHistoryDays
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    await deleteHeartbeatsOlderThan(cutoff)
    logger.info({ retentionDays }, "heartbeat cleanup completed")
  } catch (err) {
    logger.error({ err }, "heartbeat cleanup failed")
  }
}

export function startScheduler() {
  const tick = () => {
    if (intervalId) clearInterval(intervalId)
    intervalId = setInterval(runTick, currentSettings.schedulerTickMs)
  }
  tick()
  runTick()
}

export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

export function restartScheduler() {
  const tick = () => {
    if (intervalId) clearInterval(intervalId)
    intervalId = setInterval(runTick, currentSettings.schedulerTickMs)
  }
  tick()
}

async function runTick() {
  if (isRunning) return
  isRunning = true

  const start = Date.now()

  try {
    await cleanupOldHeartbeats()

    const allMonitors = await findAllMonitors()
    const activeMonitors = allMonitors.filter((m: { paused: boolean }) => !m.paused)

    schedulerMetrics.monitorsChecked = activeMonitors.length

    for (const monitor of activeMonitors) {
      try {
        await checkMonitor(monitor)
      } catch (err) {
        schedulerMetrics.tickErrors++
        logger.error({ err, monitorId: monitor.id, monitorName: monitor.name }, "scheduler check failed")
      }
    }
  } finally {
    schedulerMetrics.lastTickDurationMs = Date.now() - start
    schedulerMetrics.lastTickAt = Date.now()
    isRunning = false
  }
}

async function checkMonitor(monitor: {
  id: string
  name: string
  status: string
  expectedIntervalSeconds: number
  gracePeriodSeconds: number
  createdAt?: Date
}) {
  const lastHeartbeat = await findLatestHeartbeat(monitor.id)

    if (!lastHeartbeat) {
    if (!monitor.createdAt) return
    const created = new Date(monitor.createdAt).getTime()
    const deadline = created + monitor.expectedIntervalSeconds * 1000 + monitor.gracePeriodSeconds * 1000
    const now = Date.now()

    if (now > deadline + monitor.expectedIntervalSeconds * 1000) {
      if (monitor.status === "healthy" || monitor.status === "missed" || monitor.status === "pending") {
        await updateMonitorStatus(monitor.id, "down")
        const openIncident = await findOpenIncident(monitor.id)
        if (!openIncident) {
          await createIncident({
            id: crypto.randomUUID(),
            monitorId: monitor.id,
            startedAt: new Date(created + monitor.expectedIntervalSeconds * 1000),
          })
        }
        await sendNotification({ name: monitor.name }, "down")
      }
    } else if (now > deadline) {
      if (monitor.status === "healthy") {
        await updateMonitorStatus(monitor.id, "missed")
        await createIncident({
          id: crypto.randomUUID(),
          monitorId: monitor.id,
          startedAt: new Date(),
        })
        await sendNotification({ name: monitor.name }, "missed")
      }
    }
    return
  }

  const now = Date.now()
  const lastPing = lastHeartbeat.receivedAt.getTime()
  const expectedWindow = lastPing + monitor.expectedIntervalSeconds * 1000
  const deadline = expectedWindow + monitor.gracePeriodSeconds * 1000

  if (now > deadline) {
    if (monitor.status === "healthy") {
      await updateMonitorStatus(monitor.id, "missed")
      await createIncident({
        id: crypto.randomUUID(),
        monitorId: monitor.id,
        startedAt: new Date(),
      })
      await sendNotification({ name: monitor.name }, "missed")
    }

    if (now > deadline + monitor.expectedIntervalSeconds * 1000) {
      if (monitor.status === "missed") {
        await updateMonitorStatus(monitor.id, "down")
        await sendNotification({ name: monitor.name }, "down")
      }
    }
  }

  if (
    now <= deadline &&
    monitor.status !== "healthy" &&
    monitor.status !== "paused" &&
    monitor.status !== "pending"
  ) {
    await updateMonitorStatus(monitor.id, "healthy")

    const openIncident = await findOpenIncident(monitor.id)
    if (openIncident) {
      await resolveIncident(openIncident.id, new Date())
    }

    await sendNotification({ name: monitor.name }, "recovered")
  }
}