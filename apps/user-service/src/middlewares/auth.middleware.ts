import type {
  NextFunction,
  Request,
  Response,
} from "express";
import jwt from "jsonwebtoken";

import { UnauthorizedError } from "@realtime-chat/shared-utils";
import { verifyAccessToken } from "../modules/auth/auth.token.utils.js";

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next(
        new UnauthorizedError("Authentication required"),
      );
    }

    if (!authHeader.startsWith("Bearer ")) {
      return next(
        new UnauthorizedError(
          "Invalid authentication header format",
        ),
      );
    }

    const accessToken = authHeader.split(" ")[1];

    if (!accessToken) {
      return next(
        new UnauthorizedError("Access token missing"),
      );
    }

    const userId = verifyAccessToken(accessToken);

    req.user = {
      userId,
    };

    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(
        new UnauthorizedError("Access token expired"),
      );
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return next(
        new UnauthorizedError("Invalid access token"),
      );
    }

    return next(error);
  }
};