import jwt  from 'jsonwebtoken'
import { config } from '../config/index.js';
export const verifyAccessToken = (token: string): string => {
  const payload = jwt.verify(token, config.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer:"realtime-chat",
    audience:"realtime-chat-api"
  })
  if (typeof payload === "string" || typeof payload.sub !== "string") {
      throw new Error("Invalid access token payload");
  }
  return payload.sub
}