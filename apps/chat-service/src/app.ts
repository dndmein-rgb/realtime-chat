import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import type { Request, Response } from "express";


import { corsMiddleware } from "./middlewares/cors.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { requestLogger } from "./middlewares/req.middleware.js";

import roomsRoutes from "./modules/room/room.route.js";
import messagesRoutes from "./modules/message/message.route.js";

const app = express();

app.use(corsMiddleware);
app.use(
  helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(requestLogger);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req:Request, res:Response) => {
  res.status(200).json({
    success: true,
    service: "chat-service",
    timestamp: new Date().toISOString(),
  });
});

app.use("/rooms", roomsRoutes);
app.use("/rooms/:roomId/messages", messagesRoutes);

app.use(errorHandler)

export default app