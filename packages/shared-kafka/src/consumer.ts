import { Consumer, EachMessagePayload, Kafka } from "kafkajs";
import { TopicName } from "./topics.js";

export type MessageHandler = (payload: {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  value: unknown;
}) => Promise<void>;

export class KafkaConsumer {
  private readonly consumer: Consumer;
  constructor(
    kafka: Kafka,
    groupId: string,
  ) {
    this.consumer = kafka.consumer({
      groupId,
      sessionTimeout: 30_000,
      heartbeatInterval: 3_000,
      // at-least-once: we commit after successful processing
      allowAutoTopicCreation: true,
    });
  }
  async connect(): Promise<void> {
    await this.consumer.connect();
  }
  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }

  async subscribe(topics: TopicName[]): Promise<void> {
    for (const topic of topics) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
    }
  }
  async run(handler: MessageHandler): Promise<void> {
    await this.consumer.run({
      autoCommit: false,
      eachMessage: async (payload: EachMessagePayload) => {
        const { topic, message, partition } = payload;

        const key = message.key?.toString() ?? null;
        let value: unknown = null;

        if (message.value) {
          try {
            value = JSON.parse(message.value.toString());
          } catch {
            value = message.value?.toString();
          }
        }

        try {
          await handler({
            topic,
            partition,
            offset: message.offset,
            key,
            value,
          });
          // Commit only after successful handling (at-least-once)
          await this.consumer.commitOffsets([
            {
              topic,
              offset: (Number(message.offset) + 1).toString(),
              partition,
            },
          ]);
        } catch (error) {
          // Do not commit → message will be redelivered
          throw error;
        }
      },
    });
  }
}
