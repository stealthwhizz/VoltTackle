import type { Kafka, Producer } from "kafkajs";
import { randomUUID } from "node:crypto";
import type { AlertQueueMessage, AlertWebhookPayload } from "@volt-tackle/shared";
import type { Env } from "../env.js";

export class AlertProducer {
  private producer: Producer;
  private connected = false;

  constructor(
    kafka: Kafka,
    private readonly env: Env,
  ) {
    this.producer = kafka.producer();
  }

  async connect() {
    if (this.connected) return;
    await this.producer.connect();
    this.connected = true;
  }

  async disconnect() {
    if (!this.connected) return;
    await this.producer.disconnect();
    this.connected = false;
  }

  async publish(payload: AlertWebhookPayload): Promise<AlertQueueMessage> {
    const message: AlertQueueMessage = {
      ...payload,
      receivedAt: new Date().toISOString(),
      correlationId: randomUUID(),
    };

    await this.producer.send({
      topic: this.env.KAFKA_ALERTS_TOPIC,
      messages: [{ key: message.externalId, value: JSON.stringify(message) }],
    });

    return message;
  }
}
