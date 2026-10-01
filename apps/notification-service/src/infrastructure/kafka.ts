import { createKafkaClient, KafkaConsumer, TOPICS } from "@realtime-chat/shared-kafka";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { ChatMessageCreatedSchema } from "@realtime-chat/shared-events";

const kafka = createKafkaClient({
  clientId: "notification-service",
  brokers:[config.KAFKA_BROKER]
})
export const kafkaConsumer = new KafkaConsumer(kafka, config.KAFKA_GROUP_ID)

export const startConsumers = async (): Promise<void> => {
  await kafkaConsumer.connect();
  await kafkaConsumer.subscribe([TOPICS.CHAT_MESSAGE_CREATED])
  logger.info(
      "Kafka consumer subscribed",{ topics: [TOPICS.CHAT_MESSAGE_CREATED], groupId: config.KAFKA_GROUP_ID },

    );
  await kafkaConsumer.run(async ({topic,partition,offset,key,value }) => {
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

        // Phase 4 demo: just log. Later → push / email / in-app notification
    logger.info(
        "Received chat.message.created – would notify users here",
          {
            eventId: event.eventId,
            messageId: event.data.messageId,
            roomId: event.data.roomId,
            senderId: event.data.senderId,
            partition,
            offset,
            key,
          }

        );
      });
    };
