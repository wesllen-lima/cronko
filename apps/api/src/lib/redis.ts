import Redis from "ioredis";
import { env } from "../env";
import { logger } from "./logger";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;

  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
    });

    redis.on("error", (err) => {
      logger.error({ err }, "redis connection error");
    });

    redis.on("connect", () => {
      logger.info("redis connected");
    });
  }

  return redis;
}