import { createKafkaClient, KafkaConsumer, TOPICS } from "@realtime-chat/shared-kafka";
import { config } from "../config/index.js";
import type{ Server } from "socket.io";
import { logger } from "../config/logger.js";
import { ChatMessageCreatedSchema } from "@realtime-chat/shared-events";

const kafka = createKafkaClient({
  clientId: "websocket-gateway",
  brokers: [config.KAFKA_BROKER],
});

export const kafkaConsumer = new KafkaConsumer(kafka, config.KAFKA_GROUP_ID)

/**
 * Starts the consumer and wires it to the Socket.IO server.
 * Must be called after `io` is created.
 */
export const startConsumers = async (io: Server):Promise<void> => {
  await kafkaConsumer.connect();
  await kafkaConsumer.subscribe([TOPICS.CHAT_MESSAGE_CREATED]);
  logger.info("[gateway] kafka consumer subscribed", {
    topics: [TOPICS.CHAT_MESSAGE_CREATED],
    groupId:config.KAFKA_GROUP_ID
  })

  await kafkaConsumer.run(async ({ topic, partition, offset, key, value }) => {
    if (topic !== TOPICS.CHAT_MESSAGE_CREATED) return
    const parsed = ChatMessageCreatedSchema.safeParse(value);
    if (!parsed.success) {
      logger.warn("[gateway] Invalid chat.message.created payload – skipping", {
        partition,
        offset,
        issues: parsed.error.flatten(),
      })
      return; // still commit (poison-pill handling)
    }
  
    const event = parsed.data;
    const roomId = event.data.roomId
    // Push to every socket that joined this room
    io.to(roomId).emit("message:new", {
      messageId: event.data.messageId,
      roomId: event.data.roomId,
            senderId: event.data.senderId,
            content: event.data.content,
            createdAt: event.data.createdAt,
            eventId: event.eventId, // useful for client-side deduplication
    })
    logger.info("[gateway] pushed message to room", {
          roomId,
          messageId: event.data.messageId,
          partition,
          offset,
          key,
        });
  })

  
}