import type { Request, Response } from "express";
import { asyncHandler, UnauthorizedError } from "@realtime-chat/shared-utils";
import { messageService } from "./message.container.js";
import { listMessagesQuerySchema } from "./message.schema.js";

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError("Authentication required");
  }

  const roomId = req.params.roomId as string;
  const message = await messageService.send(
    roomId,
    req.user.userId,
    req.body.content,
  );

  res.status(201).json({
    success: true,
    message: "Message sent successfully",
    data: message,
  });
});

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError("Authentication required");
  }

  const roomId = req.params.roomId as string;
  const query = listMessagesQuerySchema.parse(req.query);

  const result = await messageService.list(
    roomId,
    req.user.userId,
    query.limit,
    query.before,
  );

  res.status(200).json({
    success: true,
    message: "Messages fetched successfully",
    data: result,
  });
});

export const markMessagesSeen = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError("Authentication required");
  }

  const roomId = req.params.roomId as string;
  const { messageIds } = req.body;

  await messageService.markAsSeen(roomId, req.user.userId, messageIds);

  res.status(200).json({
    success: true,
    message: "Messages marked as seen",
  });
});

export const markMessagesDelivered = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId as string;
  const { messageIds } = req.body;

  await messageService.markAsDelivered(roomId, messageIds);

  res.status(200).json({ success: true });
});