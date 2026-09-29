import pino from "pino";
import { config } from "./index.js";

export const logger = pino({
  level: config.NODE_ENV === "development" ? "debug" : "info",

  ...(config.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),

  base: {
    service: config.SERVICE_NAME,
  },
});