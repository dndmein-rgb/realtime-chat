import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config/index.js";
import type { Request, Response } from "express";
import authRoutes from "./routes/auth.route.js"
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req:Request, res:Response) => {
  res.status(200).json({
    success: true,
    service: config.SERVICE_NAME,
    timestamp: new Date().toISOString(),
  });
});
app.use("/auth", authRoutes);
app.use(errorHandler);
app.listen(config.PORT, () => {
  console.log(`🚀 ${config.SERVICE_NAME} running on port ${config.PORT}`);
});
