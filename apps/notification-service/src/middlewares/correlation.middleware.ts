import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const correlationId: RequestHandler = (req, res, next) => {
  const id =
    (req.headers["x-correlation-id"] as string | undefined) || randomUUID();
  req.headers["x-correlation-id"] = id;
  res.setHeader("x-correlation-id", id);
  next();
};