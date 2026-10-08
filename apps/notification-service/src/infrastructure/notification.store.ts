import { redis } from "./redis.js";
import { randomUUID } from "node:crypto";

export interface Notification {
  id: string;
  userId: string;
  roomId: string;
  messageId: string;
  senderId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

const NOTIFICATION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const UNREAD_KEY = (userId: string) => `notifications:unread:${userId}`;
export class NotificationStore {
  private listKey(userId: string) {
    return `notifications:${userId}`
  }
  private itemKey(userId: string,id:string) {
    return `notifications:${userId}:${id}`;
  }

  async create(data: Omit<Notification, "id" | "read">): Promise<Notification> {
    const notification: Notification = {
      id: randomUUID(),
      ...data,
      read: false,
    };

    const listKey = this.listKey(data.userId)
    const itemKey = this.itemKey(data.userId, notification.id)
    

    // Store as a hash + add to a sorted set (for ordering)
    await redis
      .multi()
      .hset(itemKey, notification as any)
      .zadd(listKey, Date.now(), notification.id)
      .expire(itemKey, NOTIFICATION_TTL_SECONDS)
      .expire(UNREAD_KEY(data.userId), NOTIFICATION_TTL_SECONDS)
      .exec();

    return notification;
  }

  async list(userId: string, limit = 50, offset = 0): Promise<Notification[]> {
    const listKey = this.listKey(userId);
    const ids = await redis.zrevrange(listKey, offset,offset+limit-1);
  
    if (ids.length === 0) return [];
  
    const pipeline = redis.pipeline();
    ids.forEach((id) => pipeline.hgetall(this.itemKey(userId,id)));
    const results = await pipeline.exec();
  
    const notifications: Notification[] = [];
  
    for (const result of results ?? []) {
      const raw = result?.[1] as Record<string, string> | undefined;
      if (!raw || !raw.id) continue;
  
      notifications.push({
        id: raw.id,
        userId: raw.userId ?? userId,
        roomId: raw.roomId ?? "",
        messageId: raw.messageId ?? "",
        senderId: raw.senderId ?? "",
        content: raw.content ?? "",
        createdAt: raw.createdAt ?? new Date().toISOString(),
        read: raw.read === "true",
      });
    }
  
    return notifications;
  }

  async unreadCount(userId: string): Promise<number>{
    const val = await redis.get(UNREAD_KEY(userId))
    return val ? parseInt(val, 10) : 0;
  }

  async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return;
    const pipeline = redis.pipeline();
    let newlyRead = 0;
    for (const id of notificationIds) {
      const itemKey = this.itemKey(userId, id);
            // only decrement if it was previously unread
        pipeline.hget(itemKey,"read")
    }
    const readFlags = await pipeline.exec()
    const updatePipe = redis.pipeline()
    for (let i = 0; i < notificationIds.length; i++) {
          const wasRead = (readFlags?.[i]?.[1] as string) === "true";
          if (!wasRead) {
            newlyRead++;
            updatePipe.hset(this.itemKey(userId, notificationIds[i]!), "read", "true");
          }
    }
    if (newlyRead > 0) {
      updatePipe.decrby(UNREAD_KEY(userId), newlyRead);
    }
    await updatePipe.exec();
  }

  async markAllAsRead(userId: string): Promise<void> {
      const listKey = this.listKey(userId);
      const ids = await redis.zrange(listKey, "0", "-1");
      if (ids.length === 0) return;
  
      const pipeline = redis.pipeline();
      ids.forEach((id) => pipeline.hset(this.itemKey(userId, id), "read", "true"));
      pipeline.set(UNREAD_KEY(userId), "0");
      await pipeline.exec();
    }
}

export const notificationStore = new NotificationStore();