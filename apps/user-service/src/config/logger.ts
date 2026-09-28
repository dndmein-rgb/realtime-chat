import { config } from "./index.js";

type LogLevel = "info" | "debug" | "warn" | "error"

const log = (level: LogLevel, message: string, meta?: unknown) => {
  const entry = {
    level,
    service: config.SERVICE_NAME,
    message,
        timestamp: new Date().toISOString(),
        ...(meta !== undefined ? { meta } : {}),
  }
  if (level === "error") {
      console.error(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
}

export const logger = {
  info: (message: string, meta?: unknown) => log("info", message, meta),
  warn: (message: string, meta?: unknown) => log("warn", message, meta),
  error: (message: string, meta?: unknown) => log("error", message, meta),
  debug: (message: string, meta?: unknown) => log("debug", message, meta),
};
