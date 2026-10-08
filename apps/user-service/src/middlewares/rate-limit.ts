import rateLimit from "express-rate-limit";
import RedisStore, { type RedisReply } from "rate-limit-redis";
import { redis } from "../infrastructure/redis/redis.client.js";

interface RateLimiterOptions {
  windowMs: number;
  limit: number;
  prefix: string;
  error: {
    message: string;
    code: string;
  };
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
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 300,
  prefix: "user-global",
  error: {
    code: "GLOBAL_RATE_LIMIT_EXCEEDED",
    message: "Too many requests. Please try again later.",
  },
});

export const loginRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 min
  limit: 5,
  prefix: "login",
  error: {
    code: "LOGIN_RATE_LIMIT_EXCEEDED",
    message: "Too many login attempts. Please try again later.",
  },
});

export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  prefix: "register",
  error: {
    code: "REGISTRATION_RATE_LIMIT_EXCEEDED",
    message: "Too many registration attempts. Please try again later.",
  },
});

export const refreshTokenRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  prefix: "refresh-token",
  error: {
    code: "REFRESH_TOKEN_RATE_LIMIT_EXCEEDED",
    message: "Too many refresh-token requests. Please try again later.",
  },
});