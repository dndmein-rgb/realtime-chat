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

export async function markMessagesDelivered(roomId: string, messageIds: string[], _accessToken: string): Promise<void> {
  // For simplicity in this phase we call an internal endpoint.
  try {
    await fetch(`${config.CHAT_SERVICE_URL}/rooms/${roomId}/messages/delivered`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // TODO ADD INTERNAL CALL HEADER
      },
      body: JSON.stringify({ messageIds })
    })
  } catch (err) { 
    // Non-blocking – delivery status is best-effort
        console.error("Failed to mark as DELIVERED", err);
  }
  
}