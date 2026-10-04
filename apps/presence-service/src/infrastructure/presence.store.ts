import { redis } from "./redis.js";

const ONLINE_KEY ="presence:online" // Redis SET of userIds
const LAST_SEEN_PREFIX = "presence:lastseen"
const HEARTBEAT_TTL_SECONDS = 45; // client should send heartbeat every ~20-25s

export class PresenceStore{
  async setOnline(userId: string): Promise<void>{
    const multi = redis.multi();
    await redis.sadd(ONLINE_KEY, userId)
    await redis.set(`${LAST_SEEN_PREFIX}${userId}`, new Date().toISOString())
    await redis.expire(`${LAST_SEEN_PREFIX}${userId}`, HEARTBEAT_TTL_SECONDS)
    // Also expire membership if no heartbeat arrives
        multi.expire(`presence:member:${userId}`, HEARTBEAT_TTL_SECONDS);
    await multi.exec();
    // Keep the SET member alive with a separate key that has TTL
    await redis.set(`presence-member:${userId}`,"1","EX",HEARTBEAT_TTL_SECONDS)
  }
  async setOffline(userId: string): Promise<void> {
    await redis.srem(ONLINE_KEY, userId);
    await redis.del(`presence:member:${userId}`);
      await redis.set(`${LAST_SEEN_PREFIX}${userId}`, new Date().toISOString());
  }

  async isOnline(userId: string): Promise<boolean>{
   return (await redis.sismember(ONLINE_KEY,userId))===1
  }
  async getOnlineUsers(): Promise<string[]> {
      // Clean approach: only return users that still have the TTL key
      const members = await redis.smembers(ONLINE_KEY);
      if (members.length === 0) return [];
  
      const pipeline = redis.pipeline();
      members.forEach((id) => pipeline.exists(`presence:member:${id}`));
      const results = await pipeline.exec();
  
      return members.filter((_, i) => results?.[i]?.[1] === 1);
    }
  
    async getLastSeen(userId: string): Promise<string | null> {
      return redis.get(`${LAST_SEEN_PREFIX}${userId}`);
    }
}

export const presenceStore = new PresenceStore();