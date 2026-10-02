import { config } from "../config/index.js";

export async function isRoomMember(roomId: string, accessToken: string): Promise<boolean>{
  try {
    const res = await fetch(`${config.CHAT_SERVICE_URL}/rooms/${roomId}`, {
      headers: {
        Authorization:`Bearer ${accessToken}`
      }
      
    })
    // chat-service returns 200 if member, 403/404 otherwise
        return res.ok;
  } catch {
    return false;
  }
}