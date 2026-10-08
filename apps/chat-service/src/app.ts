import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import type { Request, Response } from "express";


import { corsMiddleware } from "./middlewares/cors.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { requestLogger } from "./middlewares/req.middleware.js";

import roomsRoutes from "./modules/room/room.route.js";
import messagesRoutes from "./modules/message/message.route.js";
import { correlationId } from "./middlewares/correlation.middleware.js";
import { prisma } from "./infrastructure/prisma.js";
import { globalRateLimiter } from "./middlewares/rate-limit.js";

const app = express();

app.use(correlationId);
app.use(corsMiddleware);
app.use(
  helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(requestLogger);
app.use(globalRateLimiter)
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req:Request, res:Response) => {
  res.status(200).json({
    success: true,
    service: "chat-service",
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ ready: true, checks: { postgres: "ok" } });
  } catch (err) {
    res.status(503).json({
      ready: false,
      checks: { postgres: "fail" },
      error: err instanceof Error ? err.message : "unknown",
    });
  }
});
app.use("/rooms", roomsRoutes);
app.use("/rooms/:roomId/messages", messagesRoutes);

app.use(errorHandler)

export default app