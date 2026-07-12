import { Kafka, logLevel } from "kafkajs";
import type { Env } from "../env.js";

export function createKafkaClient(env: Env): Kafka {
  return new Kafka({
    clientId: env.KAFKA_CLIENT_ID,
    brokers: env.KAFKA_BROKERS.split(",").map((b) => b.trim()),
    logLevel: logLevel.ERROR,
    retry: { retries: 5 },
  });
}
