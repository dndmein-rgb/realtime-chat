import { TopicName, TOPICS } from "@realtime-chat/shared-kafka";
import { logger } from "../config/logger.js";
import { kafkaProducer } from "./kafka.js";
import { prisma } from "./prisma.js";

const BATCH_SIZE = 50;
const POLL_INTERVAL_MS = 1000;
const MAX_ATTEMPTS = 10;

// How long to keep successfully published rows before deleting them.
const RETENTION_HOURS = 24;

// How often to run cleanup.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1_000;

// DLQ topic – must also be allowed by the KafkaProducer TopicName type
// or cast as any / extend TOPICS if you want type safety.
const DLQ_TOPIC = TOPICS.CHAT_OUTBOX_DLQ;

export class OutBoxPublisher {
  private timer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (this.timer) return;

    logger.info("Outbox publisher started");

    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);

    this.cleanupTimer = setInterval(
      () => void this.cleanup(),
      CLEANUP_INTERVAL_MS,
    );

    void this.cleanup();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    logger.info("Outbox publisher stopped");
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          topic: string;
          key: string | null;
          payload: unknown;
          attempts: number;
        }>
      >`
        SELECT id, topic, key, payload, attempts
        FROM outbox
        WHERE "publishedAt" IS NULL
          AND attempts < ${MAX_ATTEMPTS}
        ORDER BY "createdAt" ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      `;

      for (const row of rows) {
        try {
          await kafkaProducer.send(
            row.topic as TopicName,
            row.key ?? row.id,
            row.payload as object,
          );

          // SUCCESS → only mark as published. Never touch DLQ here.
          await prisma.outBox.update({
            where: { id: row.id },
            data: { publishedAt: new Date() },
          });

          logger.debug("Outbox published", {
            outboxId: row.id,
            topic: row.topic,
            key: row.key,
          });
        } catch (err) {
          const newAttempts = row.attempts + 1;

          await prisma.outBox.update({
            where: { id: row.id },
            data: { attempts: newAttempts },
          });

          if (newAttempts >= MAX_ATTEMPTS) {
            // ONLY send to DLQ when we give up
            try {
              await kafkaProducer.send(DLQ_TOPIC, row.key ?? row.id, {
                original: {
                  id: row.id,
                  topic: row.topic,
                  key: row.key,
                  payload: row.payload,
                  attempts: newAttempts,
                },
                reason: "max_attempts",
                failedAt: new Date().toISOString(),
              });
            } catch (dlqErr) {
              logger.error("Failed to publish to DLQ", {
                outboxId: row.id,
                err: dlqErr,
              });
            }

            // Mark as published so the poller stops picking it up
            // (or move to a dead_letter table if you prefer)
            await prisma.outBox.update({
              where: { id: row.id },
              data: { publishedAt: new Date() },
            });

            logger.error("Outbox row moved to dead-letter", {
              outboxId: row.id,
              topic: row.topic,
              key: row.key,
              attempts: newAttempts,
              payload: row.payload,
              err,
            });
          } else {
            logger.warn("Outbox publish failed – will retry", {
              outboxId: row.id,
              attempts: newAttempts,
              err,
            });
          }
        }
      }
    } catch (err) {
      logger.error("Outbox tick failed", err);
    } finally {
      this.running = false;
    }
  }

  private async cleanup(): Promise<void> {
    try {
      const cutOff = new Date(
        Date.now() - RETENTION_HOURS * 60 * 60 * 1000,
      );

      const result = await prisma.outBox.deleteMany({
        where: {
          publishedAt: {
            not: null,
            lt: cutOff,
          },
        },
      });

      if (result.count > 0) {
        logger.info("Outbox cleanup completed", {
          deleted: result.count,
          olderThanHours: RETENTION_HOURS,
        });
      }
    } catch (err) {
      logger.error("Outbox cleanup failed", err);
    }
  }
}

export const outBoxPublisher = new OutBoxPublisher();