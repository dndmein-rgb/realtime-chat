import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "@realtime-chat/shared-utils";
import { config } from "../config/index.js";

/**
 * Only allows requests that carry the shared internal service key.
 * Used for inter-service calls (notification → chat, gateway → chat, etc.)
 */
export const internalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const serviceKey = req.headers["x-internal-service-key"];

  if (!serviceKey || serviceKey !== config.INTERNAL_SERVICE_KEY) {
    return next(new ForbiddenError("Invalid or missing internal service key"));
  }

  next();
};