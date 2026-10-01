import "dotenv/config";
import type { Server } from "node:http";
import { logger } from "./config/logger.js";
import { config } from "./config/index.js";
import { kafkaConsumer, startConsumers } from "./infrastructure/kafka.js";
import app from "./app.js";

let server: Server | undefined;
let isShuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    logger.warn(`Shutdown already in progress; received ${signal} again`);
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      logger.info("HTTP server closed");
    }

    await kafkaConsumer.disconnect();
    logger.info("Kafka consumer disconnected");
    logger.info("Graceful shutdown completed");
  } catch (error) {
    logger.error("Error during graceful shutdown", error);
    process.exitCode = 1;
  }
};

const startServer = async (): Promise<void> => {
  try {
    // Start consumer in background (does not block HTTP)
    void startConsumers().catch((error) => {
      logger.error("Kafka consumer crashed", error);
      process.exitCode = 1;
    });

    const httpServer = app.listen(config.PORT, () => {
      logger.info(
        `${config.SERVICE_NAME} is running on http://localhost:${config.PORT}`,
      );
    });

    server = httpServer;

    httpServer.on("error", (error) => {
      logger.error("HTTP server error", error);
      process.exitCode = 1;
    });

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exitCode = 1;
  }
};

void startServer();