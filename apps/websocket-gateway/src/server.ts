import "dotenv/config";
import { createServer, type Server as HttpServer } from "node:http";
import { Server } from "socket.io";

import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";

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
import {
  connectPresencePublisher,
  disconnectPresencePublisher,
  publishUserOffline,
  publishUserOnline,
} from "./infrastructure/presence-publisher.js";

let httpServer: HttpServer | undefined;
let io: Server | undefined;
let isShuttingDown = false;


function broadcastPresence(socketServer: Server, userId: string, event: "presence-offline" | "presence-online", payload: object) {
  // Get all rooms this user is currently in (from connectionManager)
  const rooms = connectionManager.getRoomsForUser(userId);
  if (rooms.length === 0) {
      // fallback: still useful for global online list
      socketServer.emit(event, payload);
      return;
  }
  for (const roomId of rooms) {
    socketServer.to(roomId).emit(event,payload)
  }
}

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
    await disconnectPresencePublisher();
    console.log("Graceful shutdown completed");
  } catch (error) {
    console.error("Error during graceful shutdown", error);
    process.exitCode = 1;
  }
};

const startServer = async (): Promise<void> => {
  try {
    httpServer = createServer(app);
    const pubClient = new Redis(config.REDIS_URL);
    const subClient = pubClient.duplicate();
    const socketServer = new Server(httpServer, {
      cors: {
        origin: config.CLIENT_ORIGINS,
        credentials: true,
      },
      adapter:createAdapter(pubClient,subClient)
    });

    io = socketServer;
    // Auth middleware – runs before "connection"
    io.use(socketAuthMiddleware);

    await connectPresencePublisher();

    io.on("connection", (rawSocket) => {
      const socket = rawSocket as AuthenticatedSocket;
      const userId = socket.data.userId;
      const socketId = socket.id;

      connectionManager.addConnection(socketId, userId);

      // Publish to Kafka (for presence-service)
      void publishUserOnline(userId); // fire-and-forget

      broadcastPresence(socketServer, userId, "presence-online", {
        userId,
        connectedAt:new Date().toISOString()
      })

      console.log(`[gateway] connected user=${userId} socket=${socketId}`);

      // ---------- join-room ----------
      socket.on(
        "join-room",
        async (payload: { roomId?: string }, ack?: (res: unknown) => void) => {
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

      // ---------- presence heartbeat ----------
      socket.on("presence:heartbeat", () => {
        // Just touch the Redis key via presence-service or keep a local map.
        // For simplicity we re-publish online (idempotent).
        void publishUserOnline(userId);
      });
      // ---------- typing indicators ----------
      socket.on("typing:start", async(payload:{roomId?:string},ack?:(res:unknown)=>void) => {
        const roomId = payload?.roomId
        if (!roomId) {
          ack?.({ success: false, error: "roomId is required" });
                return;
        }
        const token = socket.handshake.auth?.token as string | undefined
        if (!token) {
          ack?.({ success: false, error: "Missing token" });
                return;
        }
        const allowed = await isRoomMember(roomId, token)
        if (!allowed) {
              ack?.({ success: false, error: "Not a member of this room" });
              return;
        }
        // Broadcast to everyone else in the room
        socket.to(roomId).emit("typing:start", {
          roomId,userId
        })
        ack?.({ success: true });
      })

      socket.on(
        "typing:stop",
        (payload: { roomId?: string }, ack?: (res: unknown) => void) => {
          const roomId = payload?.roomId;
          if (!roomId) {
            ack?.({ success: false, error: "roomId is required" });
            return;
          }
      
          socket.to(roomId).emit("typing:stop", {
            roomId,
            userId,
          });
      
          ack?.({ success: true });
        },
      );
      
      socket.on(
        "message:seen",
        async (
          payload: { roomId?: string; messageIds?: string[] },
          ack?: (res: unknown) => void,
        ) => {
          const { roomId, messageIds } = payload ?? {};
      
          if (!roomId || !messageIds || messageIds.length === 0) {
            ack?.({ success: false, error: "roomId and messageIds are required" });
            return;
          }
      
          const token = socket.handshake.auth?.token as string | undefined;
          if (!token) {
            ack?.({ success: false, error: "Missing token" });
            return;
          }
      
          try {
            const res = await fetch(
              `${config.CHAT_SERVICE_URL}/rooms/${roomId}/messages/seen`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ messageIds }),
              },
            );
      
            if (!res.ok) {
              let errorMessage = "Failed to mark as seen";
            
              try {
                const body = await res.json();
                if (body && typeof body === "object" && "message" in body) {
                  errorMessage = String((body as { message: unknown }).message);
                }
              } catch {
                // ignore JSON parse errors
              }
            
              ack?.({ success: false, error: errorMessage });
              return;
            }
      
            ack?.({ success: true });
          } catch (err) {
            logger.error("message:seen failed", err);
            ack?.({ success: false, error: "Internal error" });
          }
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
        if (wasLastConnection && uid) {
          void publishUserOffline(uid);
          // Real-time broadcast to all connected clients
          socketServer.emit("presence:offline", {
            userId: uid,
            disconnectedAt: new Date().toISOString(),
          });
        }
      });
    });

    // ---------- start Kafka consumer (needs the io instance) ----------
    void startConsumers(io).catch((error) => {
      logger.error("Kafka consumer crashed", error);
      process.exitCode = 1;
    });

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
