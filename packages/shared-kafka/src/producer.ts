import type { Kafka, Producer, RecordMetadata } from "kafkajs";
import type { TopicName } from "./topics.js";

export class KafkaProducer {
  private readonly producer: Producer;
  private connected = false;

  constructor( kafka: Kafka) {
    this.producer = kafka.producer({
      allowAutoTopicCreation: true,
      idempotent: true, // safer retries
    });
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.producer.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.producer.disconnect();
    this.connected = false;
  }

  async send<T extends object>(
    topic: TopicName,
    key: string,
    value: T,
  ): Promise<RecordMetadata[]> {
    if (!this.connected) {
      await this.connect();
    }

    return this.producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(value),
          headers: {
            "content-type": "application/json",
          },
        },
      ],
    });
  }
}