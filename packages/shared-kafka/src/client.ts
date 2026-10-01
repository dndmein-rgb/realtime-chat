import { Kafka, KafkaConfig, logLevel } from "kafkajs";

export type CreateKafkaClientOptions = {
  clientId: string;
  brokers: string[];
  logLevel?:logLevel
}

export const createKafkaClient = (options: CreateKafkaClientOptions):Kafka => {
  const config: KafkaConfig = {
    clientId: options.clientId,
    brokers: options.brokers,
    logLevel: options.logLevel ?? logLevel.WARN,
    retry: {
      initialRetryTime: 300,
      retries:8
    }
  }
  return new Kafka(config);
}