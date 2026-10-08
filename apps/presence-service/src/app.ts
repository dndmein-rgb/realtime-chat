import express from "express";
import helmet from "helmet";
import cors from "cors";
import type { Request, Response } from "express";
import { config } from "./config/index.js";
import { presenceStore } from "./infrastructure/presence.store.js";
import { redis } from "./infrastructure/redis.js";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

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

// simple public API (protect later if needed)
app.get("/presence/:userId", async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const online = await presenceStore.isOnline(userId);
  const lastSeen = await presenceStore.getLastSeen(userId);
  res.json({ success: true, data: { userId, online, lastSeen } });
});

app.get("/presence", async (_req: Request, res: Response) => {
  const users = await presenceStore.getOnlineUsers();
  res.json({ success: true, data: { online: users, count: users.length } });
});

app.get("/presence/room/:roomId", async (req, res) => {
  const users = await presenceStore.getUsersInRoom(req.params.roomId as string);
  res.json({ success: true, data: { roomId: req.params.roomId, users } });
});

export default app;