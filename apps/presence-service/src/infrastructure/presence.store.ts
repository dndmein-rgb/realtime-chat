import { redis } from "./redis.js";

const ONLINE_KEY ="presence:online" // Redis SET of userIds
const LAST_SEEN_PREFIX = "presence:lastseen"

export class PresenceStore{
  async setOnline(userId: string): Promise<void>{
    await redis.sadd(ONLINE_KEY, userId)
    await redis.set(`${LAST_SEEN_PREFIX}${userId}`,new Date().toISOString())
  }
  async setOffline(userId: string): Promise<void> {
      await redis.srem(ONLINE_KEY, userId);
      await redis.set(`${LAST_SEEN_PREFIX}${userId}`, new Date().toISOString());
  }

  async isOnline(userId: string): Promise<boolean>{
   return (await redis.sismember(ONLINE_KEY,userId))===1
  }
  async getOnlineUsers(): Promise<string[]> {
      return redis.smembers(ONLINE_KEY);
    }
  
    async getLastSeen(userId: string): Promise<string | null> {
      return redis.get(`${LAST_SEEN_PREFIX}${userId}`);
    }
}

export const presenceStore = new PresenceStore();