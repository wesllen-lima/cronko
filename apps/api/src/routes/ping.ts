import { Hono } from "hono"
import type { Context } from "hono"
import { rateLimit } from "../middleware/rateLimit"
import { processHeartbeat } from "../services/heartbeat"

export const pingRoute = new Hono()

pingRoute.use("/:token", rateLimit)

async function handlePing(c: Context) {
  const token = c.req.param("token")
  const durationMs = c.req.query("d")
  const exitCode = c.req.query("exit")
  const sourceIp = c.req.header("x-forwarded-for") ?? "127.0.0.1"
  const userAgent = c.req.header("user-agent")
  let body: string | undefined

  if (c.req.method === "POST") {
    try {
      const contentType = c.req.header("content-type") ?? ""
      if (contentType.includes("application/json")) {
        const json = await c.req.json()
        body = json.body ?? json.log ?? json.text
        if (body && body.length > 10000) body = body.slice(0, 10000)
      } else if (contentType.includes("text/plain")) {
        body = await c.req.text()
        if (body.length > 10000) body = body.slice(0, 10000)
      }
    } catch {}
  }

  const result = await processHeartbeat(token ?? "", {
    ...(sourceIp !== undefined && { sourceIp }),
    ...(userAgent !== undefined && { userAgent }),
    ...(durationMs !== undefined && { durationMs: parseInt(durationMs, 10) }),
    ...(exitCode !== undefined && { exitCode: parseInt(exitCode, 10) }),
    ...(body !== undefined && { body }),
  })

  if (!result.ok) {
    return c.json({ error: result.error }, result.status as 404)
  }

  return c.json(result.data)
}

pingRoute.get("/:token", handlePing)
pingRoute.post("/:token", handlePing)

async function handlePulseStart(c: Context) {
  const token = c.req.param("token")
  const sourceIp = c.req.header("x-forwarded-for") ?? "127.0.0.1"
  const userAgent = c.req.header("user-agent")

  const result = await processHeartbeat(token ?? "", {
    sourceIp,
    ...(userAgent !== undefined && { userAgent }),
    pulseType: "start",
  })

  if (!result.ok) {
    return c.json({ error: result.error }, result.status as 404)
  }

  return c.json(result.data)
}

pingRoute.post("/:token/start", handlePulseStart)
pingRoute.get("/:token/start", handlePulseStart)

async function handlePulseFinish(c: Context) {
  const token = c.req.param("token")
  const durationMs = c.req.query("d")
  const exitCode = c.req.query("exit")
  const sourceIp = c.req.header("x-forwarded-for") ?? "127.0.0.1"
  const userAgent = c.req.header("user-agent")

  const result = await processHeartbeat(token ?? "", {
    sourceIp,
    ...(userAgent !== undefined && { userAgent }),
    ...(durationMs !== undefined && { durationMs: parseInt(durationMs, 10) }),
    ...(exitCode !== undefined && { exitCode: parseInt(exitCode, 10) }),
    pulseType: "finish",
  })

  if (!result.ok) {
    return c.json({ error: result.error }, result.status as 404)
  }

  return c.json(result.data)
}

pingRoute.post("/:token/finish", handlePulseFinish)
pingRoute.get("/:token/finish", handlePulseFinish)
