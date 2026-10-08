import { redis } from "./redis.js";

const ONLINE_SET = "presence:online";
const MEMBER_KEY = (userId: string) => `presence:member:${userId}`;
const LAST_SEEN_KEY = (userId: string) => `presence:lastseen:${userId}`;
const ROOM_PRESENCE_KEY = (roomId: string) => `presence:room:${roomId}`;
const HEARTBEAT_TTL_SECONDS = 45; // client should send heartbeat every ~20-25s

export class PresenceStore{
  async setOnline(userId: string): Promise<void>{
    const multi = redis.multi();
        multi.sadd(ONLINE_SET, userId);
        multi.set(MEMBER_KEY(userId), "1", "EX", HEARTBEAT_TTL_SECONDS);
        multi.set(LAST_SEEN_KEY(userId), new Date().toISOString());
        await multi.exec();
  }
  async setOffline(userId: string): Promise<void> {
    const multi = redis.multi();
        multi.srem(ONLINE_SET, userId);
        multi.del(MEMBER_KEY(userId));
        multi.set(LAST_SEEN_KEY(userId), new Date().toISOString());
        // also remove from all room presence sets (best-effort)
        // in production you would track which rooms the user was in
        await multi.exec();
  }
  /** Only refreshes TTL – call this on presence:heartbeat */
  async heartbeat(userId: string): Promise<void> {
      // refresh TTL only
      await redis.set(MEMBER_KEY(userId), "1", "EX", HEARTBEAT_TTL_SECONDS);
      await redis.set(LAST_SEEN_KEY(userId), new Date().toISOString());
    }
  async isOnline(userId: string): Promise<boolean>{
   return (await redis.exists(MEMBER_KEY(userId))) === 1;
  }
  async getOnlineUsers(): Promise<string[]> {
      // Clean approach: only return users that still have the TTL key
      const members = await redis.smembers(ONLINE_SET);
      if (members.length === 0) return [];
  
      const pipeline = redis.pipeline();
      members.forEach((id) => pipeline.exists(MEMBER_KEY(id)));
      const results = await pipeline.exec();
  
      const stillOnline: string[] = [];
          for (let i = 0; i < members.length; i++) {
            if (results?.[i]?.[1] === 1) {
              stillOnline.push(members[i]!);
            } else {
              // lazy cleanup of stale SET members
              void redis.srem(ONLINE_SET, members[i]!);
            }
          }
          return stillOnline;
    }
  
    async getLastSeen(userId: string): Promise<string | null> {
      return redis.get(LAST_SEEN_KEY(userId));
  }

  // ---------- Room-level presence ----------
    async joinRoom(userId: string, roomId: string): Promise<void> {
      await redis.sadd(ROOM_PRESENCE_KEY(roomId), userId);
      await redis.expire(ROOM_PRESENCE_KEY(roomId), HEARTBEAT_TTL_SECONDS * 2);
    }
  
    async leaveRoom(userId: string, roomId: string): Promise<void> {
      await redis.srem(ROOM_PRESENCE_KEY(roomId), userId);
    }
  
    async getUsersInRoom(roomId: string): Promise<string[]> {
      return redis.smembers(ROOM_PRESENCE_KEY(roomId));
    }
}

export const presenceStore = new PresenceStore();