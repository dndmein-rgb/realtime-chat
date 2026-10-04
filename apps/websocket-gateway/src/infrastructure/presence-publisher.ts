import { randomUUID } from "node:crypto";
import {
  createKafkaClient,
  KafkaProducer,
  TOPICS,
} from "@realtime-chat/shared-kafka";
import type {
  PresenceUserOnlineEvent,
  PresenceUserOfflineEvent,
} from "@realtime-chat/shared-events";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";

const kafka = createKafkaClient({
  clientId: "websocket-gateway-presence",
  brokers: [config.KAFKA_BROKER],
});

const producer = new KafkaProducer(kafka);

export async function connectPresencePublisher(): Promise<void> {
  await producer.connect();
  logger.info("Presence Kafka producer connected");
}

export async function disconnectPresencePublisher(): Promise<void> {
  await producer.disconnect();
  logger.info("Presence Kafka producer disconnected");
}

export async function publishUserOnline(userId: string): Promise<void> {
  const event: PresenceUserOnlineEvent = {
    eventId: randomUUID(),
    eventType: "presence.user.online",
    occurredAt: new Date().toISOString(),
    data: {
      userId,
      connectedAt: new Date().toISOString(),
    },
  };

  await producer.send(TOPICS.PRESENCE_USER_ONLINE, userId, event);
  logger.debug("Published presence.user.online", {
    userId,
    eventId: event.eventId,
  });
}

export async function publishUserOffline(userId: string): Promise<void> {
  const event: PresenceUserOfflineEvent = {
    eventId: randomUUID(),
    eventType: "presence.user.offline",
    occurredAt: new Date().toISOString(),
    data: {
      userId,
      disconnectedAt: new Date().toISOString(),
    },
  };

  await producer.send(TOPICS.PRESENCE_USER_OFFLINE, userId, event);
  logger.debug("Published presence.user.offline", {
    userId,
    eventId: event.eventId,
  });
}