import express from "express";
import helmet from "helmet";
import cors from "cors";
import type { Request, Response } from "express";
import { config } from "./config/index.js";
import { presenceStore } from "./infrastructure/presence.store.js";

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

export default app;