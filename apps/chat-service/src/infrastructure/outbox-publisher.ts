import { TopicName } from "@realtime-chat/shared-kafka";
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

export class OutBoxPublisher {
  private timer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (this.timer) return;

    logger.info("Outbox publisher started");

    // Main publishing loop.
    this.timer = setInterval(
      () => void this.tick(),
      POLL_INTERVAL_MS,
    );

    // Periodic cleanup of old published rows.
    this.cleanupTimer = setInterval(
      () => void this.cleanup(),
      CLEANUP_INTERVAL_MS,
    );

    // Run cleanup once immediately on startup.
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
      // 1. Atomically claim a batch of rows
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
        WHERE published_at IS NULL
          AND attempts < ${MAX_ATTEMPTS}
        ORDER BY created_at ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      `;
  
      // 2. Publish each claimed row
      for (const row of rows) {
        try {
          await kafkaProducer.send(
            row.topic as TopicName,
            row.key ?? row.id,
            row.payload as object,
          );
  
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