import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import authRoutes from "./modules/auth/auth.route.js";


import { corsMiddleware } from "./middlewares/cors.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { requestLogger } from "./middlewares/req.middleware.js";
import { correlationId } from "./middlewares/correlation.middleware.js";
import { globalRateLimiter } from "./middlewares/rate-limit.js";

const app = express();

app.use(correlationId);
app.use(corsMiddleware);

app.use(
  helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(requestLogger);

app.use(globalRateLimiter)
app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRoutes);


app.get("/", (_req, res) => {
  res.send("Hello from user-service");
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    message: "ok",
  });
});

app.use(errorHandler);

export default app;