import { TopicName } from "@realtime-chat/shared-kafka";
import { logger } from "../config/logger.js";
import { kafkaProducer } from "./kafka.js";
import { prisma } from "./prisma.js";

const BATCH_SIZE = 50;
const POLL_INTERVAL_MS = 1000;
const MAX_ATTEMPTS = 10

export class OutBoxPublisher{
  private timer: NodeJS.Timeout| null = null;
  private running = false

  start(): void{
    if (this.timer) return;
        logger.info("Outbox publisher started");
        this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
  }
  stop(): void{
    if (this.timer) {
      clearInterval(this.timer)
      this.timer=null
    }
  }
  private async tick():Promise<void> {
    if (this.running) return; // prevent overlapping runs
    this.running = true;

    try {
      const rows = await prisma.outBox.findMany({
        where: { publishedAt: null, attempts: { lt: MAX_ATTEMPTS } },
        orderBy: { createdAt: "asc" },
                take: BATCH_SIZE,
        
      })
      for (const row of rows) {
        try {
          await kafkaProducer.send(
            row.topic as TopicName,
            row.key ?? row.id,
            row.payload as object
          )
          await prisma.outBox.update({
            where: { id: row.id },
            data:{publishedAt:new Date()}
          })
          logger.debug("Outbox published", {
                      outboxId: row.id,
                      topic: row.topic,
                      key: row.key,
                    });
        }
      catch (err) {
        await prisma.outBox.update({
                    where: { id: row.id },
                    data: { attempts: { increment: 1 } },
                  });
                  logger.error("Outbox publish failed", {
                    outboxId: row.id,
                    attempts: row.attempts + 1,
                    err,
                  });
                }
      
      }
    } catch (err) {
      logger.error("Outbox tick failed",err)
    } finally {
      this.running=false
    }
  }
}

export const outBoxPublisher = new OutBoxPublisher();