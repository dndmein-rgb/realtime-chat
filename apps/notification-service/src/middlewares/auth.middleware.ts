import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "@realtime-chat/shared-utils";
import { config } from "../config/index.js";

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return next(new UnauthorizedError("Authentication required"));
    }

    const accessToken = authHeader.split(" ")[1];
    if (!accessToken) {
      return next(new UnauthorizedError("Access token missing"));
    }

    const payload = jwt.verify(accessToken, config.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
      issuer: "realtime-chat",
      audience: "realtime-chat-api",
    });

    if (typeof payload === "string" || typeof payload.sub !== "string") {
      return next(new UnauthorizedError("Invalid access token"));
    }

    req.user = { userId: payload.sub };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError("Access token expired"));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new UnauthorizedError("Invalid access token"));
    }
    next(error);
  }
};