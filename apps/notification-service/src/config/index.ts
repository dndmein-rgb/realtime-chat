import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4005),
  KAFKA_BROKER: z.string().min(1),
  REDIS_URL: z.string().min(1),
  CHAT_SERVICE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  CLIENT_ORIGINS: z
    .string()
    .min(1)
    .transform((v) => v.split(",").map((o) => o.trim())),
  INTERNAL_SERVICE_KEY:z.string()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  SERVICE_NAME: "notification-service",
  KAFKA_GROUP_ID: "notification-service",
} as const;