import Redis from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 0,
  retryStrategy: () => null,
  enableReadyCheck: false,
  enableOfflineQueue: false,
  connectTimeout: 5000,
  commandTimeout: 5000,
});

redis.on("connect", () => {
  console.log("Redis connected successfully to:", env.REDIS_URL);
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});
