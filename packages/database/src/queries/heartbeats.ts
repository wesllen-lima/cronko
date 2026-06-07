import { eq, desc, lt, gte, lte } from "drizzle-orm"
import { db } from "../index"
import { heartbeats } from "../schema"

export async function findHeartbeatsByMonitor(
  monitorId: string,
  options: { limit: number; before?: string },
) {
  const where = options.before
    ? lt(heartbeats.receivedAt, new Date(options.before))
    : undefined

  return db
    .select()
    .from(heartbeats)
    .where(
      where
        ? () => [
            eq(heartbeats.monitorId, monitorId),
            where,
          ]
        : eq(heartbeats.monitorId, monitorId),
    )
    .orderBy(desc(heartbeats.receivedAt))
    .limit(Math.min(options.limit, 500))
    .all()
}

export async function findLatestHeartbeat(monitorId: string) {
  return db
    .select()
    .from(heartbeats)
    .where(eq(heartbeats.monitorId, monitorId))
    .orderBy(desc(heartbeats.receivedAt))
    .limit(1)
    .get()
}

export async function findHeartbeatsSince(since: Date) {
  return db
    .select()
    .from(heartbeats)
    .where(gte(heartbeats.receivedAt, since))
    .all()
}

export async function createHeartbeat(input: {
  id: string
  monitorId: string
  sourceIp?: string
  userAgent?: string
  durationMs?: number
  exitCode?: number
  body?: string
}) {
  await db.insert(heartbeats).values({
    id: input.id,
    monitorId: input.monitorId,
    receivedAt: new Date(),
    sourceIp: input.sourceIp ?? null,
    userAgent: input.userAgent ?? null,
    durationMs: input.durationMs ?? null,
    exitCode: input.exitCode ?? null,
    body: input.body ?? null,
  })
}

export async function updateHeartbeatDuration(id: string, durationMs: number) {
  await db.update(heartbeats).set({ durationMs }).where(eq(heartbeats.id, id))
}

export async function deleteHeartbeatsOlderThan(cutoff: Date) {
  await db.delete(heartbeats).where(lte(heartbeats.receivedAt, cutoff))
}

export async function findLatestOpenPulse(monitorId: string) {
  return db
    .select()
    .from(heartbeats)
    .where(eq(heartbeats.monitorId, monitorId))
    .orderBy(desc(heartbeats.receivedAt))
    .limit(1)
    .get()
}
