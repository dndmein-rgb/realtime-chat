import {
  createKafkaClient,
  KafkaConsumer,
  TOPICS,
} from "@realtime-chat/shared-kafka";
import {
  ChatMessageCreatedSchema,
  MessageStatusUpdatedSchema,
} from "@realtime-chat/shared-events";
import type { Server } from "socket.io";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { markMessagesDelivered } from "./chat-client.js";

const kafka = createKafkaClient({
  clientId: "websocket-gateway",
  brokers: [config.KAFKA_BROKER],
});

export const kafkaConsumer = new KafkaConsumer(kafka, config.KAFKA_GROUP_ID);

/**
 * Starts the consumer and wires it to the Socket.IO server.
 * Must be called after `io` is created.
 */
export const startConsumers = async (io: Server): Promise<void> => {
  await kafkaConsumer.connect();

  await kafkaConsumer.subscribe([
    TOPICS.CHAT_MESSAGE_CREATED,
    TOPICS.CHAT_MESSAGE_STATUS,
  ]);

  logger.info("[gateway] kafka consumer subscribed", {
    topics: [TOPICS.CHAT_MESSAGE_CREATED, TOPICS.CHAT_MESSAGE_STATUS],
    groupId: config.KAFKA_GROUP_ID,
  });

  await kafkaConsumer.run(async ({ topic, partition, offset, key, value }) => {
    // ---------- New chat message ----------
    if (topic === TOPICS.CHAT_MESSAGE_CREATED) {
      const parsed = ChatMessageCreatedSchema.safeParse(value);

      if (!parsed.success) {
        logger.warn("[gateway] Invalid chat.message.created payload – skipping", {
          partition,
          offset,
          issues: parsed.error.flatten(),
        });
        return;
      }

      const event = parsed.data;

      io.to(event.data.roomId).emit("message:new", {
        messageId: event.data.messageId,
        roomId: event.data.roomId,
        senderId: event.data.senderId,
        content: event.data.content,
        createdAt: event.data.createdAt,
        status: "SENT",
        eventId: event.eventId,
      });
      void markMessagesDelivered(event.data.roomId,[event.data.messageId],"")

      logger.info("[gateway] pushed message to room", {
        roomId: event.data.roomId,
        messageId: event.data.messageId,
        partition,
        offset,
        key,
      });

      return;
    }

    // ---------- Message status update (DELIVERED / SEEN) ----------
    if (topic === TOPICS.CHAT_MESSAGE_STATUS) {
      const parsed = MessageStatusUpdatedSchema.safeParse(value);

      if (!parsed.success) {
        logger.warn("[gateway] Invalid chat.message.status payload – skipping", {
          partition,
          offset,
          issues: parsed.error.flatten(),
        });
        return;
      }

      const event = parsed.data;

      io.to(event.data.roomId).emit("message:status", {
        messageId: event.data.messageId,
        roomId: event.data.roomId,
        status: event.data.status,
        userId: event.data.userId,
        eventId: event.eventId,
      });

      logger.info("[gateway] pushed message status to room", {
        roomId: event.data.roomId,
        messageId: event.data.messageId,
        status: event.data.status,
        partition,
        offset,
        key,
      });
    }
  });
};