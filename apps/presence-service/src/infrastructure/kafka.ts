import { createKafkaClient, KafkaConsumer, TOPICS } from "@realtime-chat/shared-kafka";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";
import { PresenceUserOfflineSchema, PresenceUserOnlineSchema } from "@realtime-chat/shared-events";
import { presenceStore } from "./presence.store.js";

const kafka = createKafkaClient({
  clientId: "presence-service",
  brokers:[config.KAFKA_BROKER]
})

export const kafkaConsumer = new KafkaConsumer(kafka, "presence-service")

export const startConsumers = async (): Promise<void>=>{
  await kafkaConsumer.connect();
  await kafkaConsumer.subscribe([TOPICS.PRESENCE_USER_OFFLINE, TOPICS.PRESENCE_USER_ONLINE])
  logger.info("Presence consumer subscribed", {
      topics: [TOPICS.PRESENCE_USER_ONLINE, TOPICS.PRESENCE_USER_OFFLINE],
    });

  await kafkaConsumer.run(async ({topic,value,partition,offset }) => {
    if (topic === TOPICS.PRESENCE_USER_ONLINE) {
      const parsed = PresenceUserOnlineSchema.safeParse(value);
      if (!parsed.success) {
        logger.warn({ issues: parsed.error.flatten() }, "Invalid online event – skip");
                return;
      }
      await presenceStore.setOnline(parsed.data.data.userId)
      logger.info("User online", { userId: parsed.data.data.userId, partition, offset });
            return;
    }
    if (topic === TOPICS.PRESENCE_USER_OFFLINE) {
          const parsed = PresenceUserOfflineSchema.safeParse(value);
          if (!parsed.success) {
            logger.warn({ issues: parsed.error.flatten() }, "Invalid offline event – skip");
            return;
          }
          await presenceStore.setOffline(parsed.data.data.userId);
          logger.info("User offline", { userId: parsed.data.data.userId, partition, offset });
        }
  })
} 
