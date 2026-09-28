import { AppError } from "@realtime-chat/shared-utils";
import type{Request,Response, NextFunction } from "express";
import { config } from "../config/index.js";
import { logger } from "../config/logger.js";


export const errorHandler = (err:Error,_req:Request,res:Response,_next:NextFunction): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
          success: false,
          error: err.code,
          message: err.message,
        });
        return;
  }
  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message:
        config.NODE_ENV === "development"
          ? err.message
          : "Internal Server Error",
    });
}