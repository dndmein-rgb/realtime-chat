import { createKafkaClient, KafkaProducer } from "@realtime-chat/shared-kafka";
import { config } from "../config/index.js";

const kafka = createKafkaClient({
  clientId:"chat-service",
  brokers: [config.KAFKA_BROKER]
    
})

export const kafkaProducer=new KafkaProducer(kafka)