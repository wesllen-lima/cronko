import { findAllMonitors, updateMonitorStatus } from "@cronko/database/queries/monitors"
import { findLatestHeartbeat, deleteHeartbeatsOlderThan } from "@cronko/database/queries/heartbeats"
import { createIncident, findOpenIncident, resolveIncident } from "@cronko/database/queries/incidents"
import { sendNotification } from "./notifier"
import { currentSettings } from "../routes/settings"
import { HEARTBEAT_HISTORY_DAYS } from "@cronko/shared/constants"

let intervalId: ReturnType<typeof setInterval> | null = null

let isRunning = false

let lastCleanupDay = 0

async function cleanupOldHeartbeats() {
  const today = new Date().getDate()
  if (today === lastCleanupDay) return
  lastCleanupDay = today

  try {
    const cutoff = new Date(Date.now() - HEARTBEAT_HISTORY_DAYS * 24 * 60 * 60 * 1000)
    await deleteHeartbeatsOlderThan(cutoff)
    console.log(`Heartbeat cleanup: deleted records older than ${HEARTBEAT_HISTORY_DAYS} days`)
  } catch (err) {
    console.error("Heartbeat cleanup failed:", err)
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

  try {
    await cleanupOldHeartbeats()

    const allMonitors = await findAllMonitors()
    const activeMonitors = allMonitors.filter((m: { paused: boolean }) => !m.paused)

    for (const monitor of activeMonitors) {
      try {
        await checkMonitor(monitor)
      } catch (err) {
        console.error(`Scheduler: error checking monitor ${monitor.name} (${monitor.id})`, err)
      }
    }
  } finally {
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
      if (monitor.status === "healthy" || monitor.status === "missed") {
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