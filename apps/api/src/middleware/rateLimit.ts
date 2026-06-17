import type { Context, Next } from "hono";
import { PING_RATE_LIMIT_PER_MINUTE } from "@cronko/shared/constants";
import { getRedis } from "../lib/redis";
import { logger } from "../lib/logger";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (now >= entry.resetAt) memoryStore.delete(key);
  }
}, 60_000).unref();

function getLimit(): number {
  return PING_RATE_LIMIT_PER_MINUTE;
}

function getWindowMs(): number {
  return 60_000;
}

async function checkMemoryLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now >= entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, reset: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, reset: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: limit - entry.count,
    reset: entry.resetAt,
  };
}

async function checkRedisLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis not available");

  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = `ratelimit:${key}`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, 0, windowStart);
  pipeline.zcard(redisKey);
  pipeline.zadd(redisKey, now, `${now}-${crypto.randomUUID()}`);
  pipeline.expire(redisKey, Math.ceil(windowMs / 1000) + 1);

  const results = await pipeline.exec();
  const count = (results?.[1]?.[1] as number) ?? 0;

  const remaining = Math.max(0, limit - count - 1);
  const reset = now + windowMs;

  if (count >= limit) {
    return { allowed: false, remaining: 0, reset };
  }

  return { allowed: true, remaining, reset };
}

let redisAvailable: boolean | null = null;

async function isRedisAvailable(): Promise<boolean> {
  if (redisAvailable !== null) return redisAvailable;

  const redis = getRedis();
  if (!redis) {
    redisAvailable = false;
    return false;
  }

  try {
    await redis.ping();
    redisAvailable = true;
    return true;
  } catch {
    logger.warn("redis ping failed, falling back to memory store");
    redisAvailable = false;
    return false;
  }
}

export async function rateLimit(
  c: Context,
  next: Next,
): Promise<Response | undefined> {
  const token = c.req.param("token") ?? "";
  const limit = getLimit();
  const windowMs = getWindowMs();

  let result: { allowed: boolean; remaining: number; reset: number };

  try {
    if (await isRedisAvailable()) {
      result = await checkRedisLimit(token, limit, windowMs);
    } else {
      result = await checkMemoryLimit(token, limit, windowMs);
    }
  } catch {
    result = await checkMemoryLimit(token, limit, windowMs);
  }

  c.res.headers.set("X-RateLimit-Limit", String(limit));
  c.res.headers.set("X-RateLimit-Remaining", String(result.remaining));
  c.res.headers.set("X-RateLimit-Reset", String(Math.ceil(result.reset / 1000)));

  if (!result.allowed) {
    return c.json(
      { error: "Rate limit exceeded", code: "RATE_LIMITED" },
      429,
    );
  }

  await next();
}