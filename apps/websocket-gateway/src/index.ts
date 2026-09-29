
import express from "express";
import helmet from "helmet";
import cors from "cors";
import type { Request, Response } from "express";
import { config } from "./config/index.js";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: config.SERVICE_NAME,
    timestamp: new Date().toISOString(),
  });
});

app.listen(config.PORT, () => {
  console.log(`🚀 ${config.SERVICE_NAME} running on port ${config.PORT}`);
});