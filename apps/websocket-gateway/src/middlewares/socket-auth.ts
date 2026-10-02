import { Socket } from "socket.io";
import { verifyAccessToken } from "../utils/token.js";

export type AuthenticatedSocket = Socket & {
  data: {
    userId:string
  }
}

export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) =>void): void => {
  try {
    const token = socket.handshake.auth?.token ?? socket.handshake.headers?.authorization?.replace("Bearer ", "")
    if (!token || typeof token !== "string") {
      return next(new Error("Authentication required"))
    }
    const userId = verifyAccessToken(token)
    socket.data.userId = userId
    next()
  } catch {
    next(new Error("Invalid or expired access token"))
  }
}