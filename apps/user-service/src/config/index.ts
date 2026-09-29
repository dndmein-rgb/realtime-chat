import { z } from "zod";
import "dotenv/config"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(4001),
      DATABASE_URL: z.string().min(1),
      JWT_ACCESS_SECRET: z.string().min(32),
      JWT_REFRESH_SECRET: z.string().min(32),
      ACCESS_TOKEN_EXP: z.string().default("15m"),
      REFRESH_TOKEN_EXP: z.string().default("7d"),
  REDIS_URL: z.string(),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  CLIENT_ORIGINS: z
    .string()
    .min(1)
    .transform((value) =>
      value.split(",").map((origin) => origin.trim()),
    ),
})

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  SERVICE_NAME: "user-service",
} as const;
