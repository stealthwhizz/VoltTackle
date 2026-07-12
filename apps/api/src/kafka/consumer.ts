import type { Kafka, Consumer } from "kafkajs";
import { AlertQueueMessageSchema } from "@volt-tackle/shared";
import { ingestAlert } from "../lib/alertIngestion.js";
import type { Env } from "../env.js";
import type { AppContext } from "../context.js";

export class AlertConsumer {
  private consumer: Consumer;

  constructor(
    kafka: Kafka,
    private readonly env: Env,
    private readonly ctx: AppContext,
  ) {
    this.consumer = kafka.consumer({ groupId: env.KAFKA_CONSUMER_GROUP });
  }

  async start() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.env.KAFKA_ALERTS_TOPIC, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;

        let parsed;
        try {
          parsed = AlertQueueMessageSchema.parse(JSON.parse(message.value.toString()));
        } catch (err) {
          this.ctx.logger.error({ err }, "Discarding malformed alert queue message.");
          return;
        }

        try {
          await ingestAlert(parsed, this.ctx, parsed.correlationId);
        } catch (err) {
          this.ctx.logger.error({ err, externalId: parsed.externalId }, "Failed to process alert message.");
          throw err; // let kafkajs retry per its configured backoff
        }
      },
    });

    this.ctx.logger.info({ topic: this.env.KAFKA_ALERTS_TOPIC, group: this.env.KAFKA_CONSUMER_GROUP }, "Alert consumer started.");
  }

  async stop() {
    await this.consumer.disconnect();
  }
}
