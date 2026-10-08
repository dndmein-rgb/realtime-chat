import express from "express";
import helmet from "helmet";
import cors from "cors";
import type { Request, Response } from "express";

import { config } from "./config/index.js";
import { redis } from "./infrastructure/redis.js";


import notificationRouter from "./modules/notification/notification.route.js"

import { errorHandler } from "./middlewares/error.middleware.js";
import { correlationId } from "./middlewares/correlation.middleware.js";

const app = express();

app.use(correlationId);
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use("/notifications",notificationRouter)

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: config.SERVICE_NAME,
    timestamp: new Date().toISOString(),
  });
});



app.get("/ready", async (_req, res) => {
  try {
    const pong = await redis.ping();
    if (pong !== "PONG") throw new Error("Redis ping failed");
    res.status(200).json({ ready: true, checks: { redis: "ok" } });
  } catch (err) {
    res.status(503).json({
      ready: false,
      checks: { redis: "fail" },
      error: err instanceof Error ? err.message : "unknown",
    });
  }
});
app.use(errorHandler);

export default app;