import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4002),
  DATABASE_URL: z.string().min(1),
  KAFKA_BROKER: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  CLIENT_ORIGINS: z
      .string()
      .min(1)
      .transform((value) => value.split(",").map((origin) => origin.trim())),

  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  SERVICE_NAME: "chat-service",
} as const;