import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./client";

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  const token = getAccessToken();
  if (!token) {
    throw new Error("No access token – login first");
  }

  socket = io(GATEWAY_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinRoom(
  roomId: string,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const s = getSocket();
    if (!s) {
      resolve({ success: false, error: "Not connected" });
      return;
    }
    s.emit(
      "join-room",
      { roomId },
      (res: { success: boolean; error?: string }) => {
        resolve(res ?? { success: false, error: "No ack" });
      },
    );
  });
}

export function leaveRoom(roomId: string): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    const s = getSocket();
    if (!s) {
      resolve({ success: false });
      return;
    }
    s.emit("leave-room", { roomId }, (res: { success: boolean }) => {
      resolve(res ?? { success: false });
    });
  });
}

export function emitTypingStart(roomId: string) {
  getSocket()?.emit("typing:start", { roomId });
}

export function emitTypingStop(roomId: string) {
  getSocket()?.emit("typing:stop", { roomId });
}

export function emitMessageSeen(roomId: string, messageIds: string[]) {
  getSocket()?.emit("message:seen", { roomId, messageIds });
}

export function emitHeartbeat() {
  getSocket()?.emit("presence:heartbeat");
}