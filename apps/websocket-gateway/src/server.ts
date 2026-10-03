import "dotenv/config";
import { createServer, type Server as HttpServer } from "node:http";
import { Server } from "socket.io";

import app from "./app.js";
import { config } from "./config/index.js";
import {
  socketAuthMiddleware,
  type AuthenticatedSocket,
} from "./middlewares/socket-auth.js";
import { connectionManager } from "./infrastructure/connection-manager.js";
import { isRoomMember } from "./infrastructure/chat-client.js";
import { logger } from "./config/logger.js";
import { startConsumers } from "./infrastructure/kafka.js";

let httpServer: HttpServer | undefined;
let io: Server | undefined;
let isShuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    console.warn(`Shutdown already in progress; received ${signal} again`);
    return;
  }

  isShuttingDown = true;
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Stop accepting new connections
    if (io) {
      io.close();
      console.log("Socket.IO server closed");
    }

    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log("HTTP server closed");
    }

    console.log("Graceful shutdown completed");
  } catch (error) {
    console.error("Error during graceful shutdown", error);
    process.exitCode = 1;
  }
};

const startServer = async (): Promise<void> => {
  try {
    httpServer = createServer(app);

    io = new Server(httpServer, {
      cors: {
        origin: config.CLIENT_ORIGINS,
        credentials: true,
      },
    });

    // Auth middleware – runs before "connection"
    io.use(socketAuthMiddleware);

    io.on("connection", (rawSocket) => {
      const socket = rawSocket as AuthenticatedSocket;
      const userId = socket.data.userId;
      const socketId = socket.id;

      connectionManager.addConnection(socketId, userId);
      console.log(`[gateway] connected user=${userId} socket=${socketId}`);

      // ---------- join-room ----------
      socket.on(
        "join-room",
        async (
          payload: { roomId?: string },
          ack?: (res: unknown) => void,
        ) => {
          const roomId = payload?.roomId;
          if (!roomId) {
            ack?.({ success: false, error: "roomId is required" });
            return;
          }

          const token = socket.handshake.auth?.token as string | undefined;
          if (!token) {
            ack?.({ success: false, error: "Missing token" });
            return;
          }

          const allowed = await isRoomMember(roomId, token);
          if (!allowed) {
            ack?.({ success: false, error: "Not a member of this room" });
            return;
          }

          connectionManager.joinRoom(socketId, roomId);
          socket.join(roomId); // Socket.IO room

          console.log(`[gateway] user=${userId} joined room=${roomId}`);
          ack?.({ success: true, roomId });
        },
      );

      // ---------- leave-room ----------
      socket.on(
        "leave-room",
        (payload: { roomId?: string }, ack?: (res: unknown) => void) => {
          const roomId = payload?.roomId;
          if (!roomId) {
            ack?.({ success: false, error: "roomId is required" });
            return;
          }

          connectionManager.leaveRoom(socketId, roomId);
          socket.leave(roomId);

          console.log(`[gateway] user=${userId} left room=${roomId}`);
          ack?.({ success: true, roomId });
        },
      );

      // ---------- disconnect ----------
      socket.on("disconnect", (reason) => {
        const { userId: uid, wasLastConnection } =
          connectionManager.removeConnection(socketId);

        console.log(
          `[gateway] disconnected user=${uid} socket=${socketId} reason=${reason} last=${wasLastConnection}`,
        );
        // Phase 9 will emit presence.user.offline when wasLastConnection === true
      });
    });

    // ---------- start Kafka consumer (needs the io instance) ----------
    void startConsumers(io).catch((error) => {
      logger.error("Kafka consumer crashed", error);
            process.exitCode = 1;
    })

    httpServer.listen(config.PORT, () => {
      logger.info(
        `🚀 ${config.SERVICE_NAME} running on http://localhost:${config.PORT}`,
      );
    });

    httpServer.on("error", (error) => {
      logger.error("HTTP server error", error);
      process.exitCode = 1;
    });

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exitCode = 1;
  }
};

void startServer();