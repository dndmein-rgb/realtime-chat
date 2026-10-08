import express from "express";
import helmet from "helmet";
import cors from "cors";
import type { Request, Response } from "express";
import { Redis } from "ioredis";

import { config } from "./config/index.js";
import { connectionManager } from "./infrastructure/connection-manager.js";
import { correlationId } from "./middlewares/correlation.middleware.js";

const app = express();

app.use(correlationId);
app.use(helmet());
app.use(
  cors({
    origin: config.CLIENT_ORIGINS,
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: config.SERVICE_NAME,
    timestamp: new Date().toISOString(),
    connections: connectionManager.getStats(),
  });
});

app.get("/ready", async (_req: Request, res: Response) => {
  try {
    const redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    });

    await redis.connect();
    const pong = await redis.ping();
    await redis.quit();

    if (pong !== "PONG") {
      throw new Error("Redis ping failed");
    }

    res.status(200).json({
      ready: true,
      checks: { redis: "ok" },
    });
  } catch (err) {
    res.status(503).json({
      ready: false,
      checks: { redis: "fail" },
      error: err instanceof Error ? err.message : "unknown",
    });
  }
});

export default app;