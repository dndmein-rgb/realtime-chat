import rateLimit from "express-rate-limit";
import RedisStore, { type RedisReply } from "rate-limit-redis";
import { Redis } from "ioredis";
import { config } from "../config/index.js";

// Minimal Redis client for rate limiting only
const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

interface RateLimiterOptions {
  windowMs: number;
  limit: number;
  prefix: string;
  error: { message: string; code: string };
}

export const createRateLimiter = ({
  windowMs,
  limit,
  prefix,
  error,
}: RateLimiterOptions) => {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: async (...args: string[]) => {
        const [command, ...commandArgs] = args;
        if (!command) {
              throw new Error("Redis command is required");
            }
        return redis.call(command, ...commandArgs) as Promise<RedisReply>;
      },
      prefix: `rate-limit:${prefix}:`,
    }),
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: error.code,
        message: error.message,
      });
    },
  });
};

export const globalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  prefix: "chat-global",
  error: {
    code: "GLOBAL_RATE_LIMIT_EXCEEDED",
    message: "Too many requests. Please try again later.",
  },
});

export const sendMessageRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  limit: 30, // 30 messages / minute / IP
  prefix: "send-message",
  error: {
    code: "MESSAGE_RATE_LIMIT_EXCEEDED",
    message: "Too many messages. Please slow down.",
  },
});