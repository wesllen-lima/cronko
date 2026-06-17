import { getRedis } from "./redis";
import { logger } from "./logger";

export async function cacheOrFetch<T>(
  key: string,
  ttlMs: number,
  fetch: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      logger.warn({ err, key }, "redis get failed, falling back to fetch");
    }
  }

  const value = await fetch();

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), "PX", ttlMs);
    } catch (err) {
      logger.warn({ err, key }, "redis set failed");
    }
  }

  return value;
}

export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch (err) {
      logger.warn({ err, key }, "redis del failed");
    }
  }
}