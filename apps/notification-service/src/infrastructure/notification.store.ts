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

export class NotificationStore {
  private key(userId: string) {
    return `notifications:${userId}`;
  }

  async create(data: Omit<Notification, "id" | "read">): Promise<Notification> {
    const notification: Notification = {
      id: randomUUID(),
      ...data,
      read: false,
    };

    const key = this.key(data.userId);

    // Store as a hash + add to a sorted set (for ordering)
    await redis
      .multi()
      .hset(`${key}:${notification.id}`, notification as any)
      .zadd(key, Date.now(), notification.id)
      .expire(`${key}:${notification.id}`, NOTIFICATION_TTL_SECONDS)
      .expire(key, NOTIFICATION_TTL_SECONDS)
      .exec();

    return notification;
  }

  async list(userId: string, limit = 50): Promise<Notification[]> {
    const key = this.key(userId);
    const ids = await redis.zrevrange(key, 0, limit - 1);
  
    if (ids.length === 0) return [];
  
    const pipeline = redis.pipeline();
    ids.forEach((id) => pipeline.hgetall(`${key}:${id}`));
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

  async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
    const pipeline = redis.pipeline();
    for (const id of notificationIds) {
      pipeline.hset(`notifications:${userId}:${id}`, "read", "true");
    }
    await pipeline.exec();
  }
}

export const notificationStore = new NotificationStore();