import {
  createKafkaClient,
  KafkaConsumer,
  KafkaProducer,
  TOPICS,
} from "@realtime-chat/shared-kafka";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { ChatMessageCreatedSchema } from "@realtime-chat/shared-events";
import { notificationStore } from "./notification.store.js";
import { randomUUID } from "node:crypto";

const kafka = createKafkaClient({
  clientId: "notification-service",
  brokers: [config.KAFKA_BROKER],
});
export const kafkaConsumer = new KafkaConsumer(kafka, config.KAFKA_GROUP_ID);

const producer = new KafkaProducer(kafka);

export const startConsumers = async (): Promise<void> => {
  await kafkaConsumer.connect();
  await kafkaConsumer.subscribe([TOPICS.CHAT_MESSAGE_CREATED]);
  logger.info("Kafka consumer subscribed", {
    topics: [TOPICS.CHAT_MESSAGE_CREATED],
    groupId: config.KAFKA_GROUP_ID,
  });
  await kafkaConsumer.run(async ({ topic, partition, offset, key, value }) => {
    if (topic !== TOPICS.CHAT_MESSAGE_CREATED) return;

    const parsed = ChatMessageCreatedSchema.safeParse(value);
    if (!parsed.success) {
      logger.warn(
        { topic, partition, offset, issues: parsed.error.flatten() },
        "Invalid chat.message.created payload – skipping",
      );
      return; // still commit (poison pill handling for Phase 4)
    }

    const event = parsed.data;

    const { roomId, messageId, senderId, content, createdAt } = event.data;
    // 1. Get room members from chat-service
    const members = await getRoomMembers(roomId);
    if (!members) return;
    // 2. Create a notification for every member except the sender
    for (const memberId of members) {
      if (memberId === senderId) continue;
      const notification = await notificationStore.create({
        userId: memberId,
        roomId,
        messageId,
        senderId,
        content,
        createdAt,
      });
      // 3. Publish notification.created so the gateway can push it
      const notifEvent = {
        eventId: randomUUID(),
        eventType: "notification.created" as const,
        occurredAt: new Date().toISOString(),
        data: {
          notificationId: notification.id,
          userId: memberId,
          roomId,
          messageId,
          senderId,
          content,
          createdAt,
        },
      };
      await producer.send(TOPICS.NOTIFICATION_CREATED, memberId, notifEvent);

      logger.info("Notification created", {
        notificationId: notification.id,
        userId: memberId,
        roomId,
        key
      });
    }
  });
};

// Simple helper – calls chat-service
async function getRoomMembers(roomId: string): Promise<string[] | null> {
  try {
    // We need an internal way to get members.
    // For now we will add a lightweight endpoint in chat-service.
    const res = await fetch(
      `${process.env.CHAT_SERVICE_URL}/rooms/internal/${roomId}/members`,
      {
        headers: {
          "x-internal-service": config.INTERNAL_SERVICE_KEY
        },
      },
    );
    if (!res.ok) {
          logger.warn({ status: res.status, roomId }, "Failed to fetch room members");
          return null;
        }

    const body = (await res.json()) as {
      success?: boolean;
      data?: Array<{ userId: string }>;
    };
    
    return body.data?.map((m) => m.userId) ?? null;
  } catch (err) {
    logger.error("Failed to fetch room members", err);
    return null;
  }
}
