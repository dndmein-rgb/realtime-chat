import type { Request, Response } from "express";
import { asyncHandler, UnauthorizedError } from "@realtime-chat/shared-utils";
import { roomService } from "./room.container.js";

export const createRoom = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError("Authentication required");
  }

  const room = await roomService.create(req.user.userId, req.body);

  res.status(201).json({
    success: true,
    message: "Room created successfully",
    data: room,
  });
});

export const getMyRooms = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError("Authentication required");
  }

  const rooms = await roomService.getMyRooms(req.user.userId);

  res.status(200).json({
    success: true,
    message: "Rooms fetched successfully",
    data: rooms,
  });
});

export const getRoomById = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError("Authentication required");
  }

  const roomId = req.params.roomId as string;
  const room = await roomService.getById(roomId, req.user.userId);

  res.status(200).json({
    success: true,
    message: "Room fetched successfully",
    data: room,
  });
});

export const addMember = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError("Authentication required");
  }

  const roomId = req.params.roomId as string;
  const room = await roomService.addMember(
    roomId,
    req.user.userId,
    req.body.userId,
  );

  res.status(200).json({
    success: true,
    message: "Member added successfully",
    data: room,
  });
});

export const getRoomMembers = asyncHandler(async (req, res) => {
  // Internal-only: either x-internal-service header or a valid JWT
    const isInternal = req.headers["x-internal-service"] === "notification-service";
    if (!isInternal && !req.user) {
      throw new UnauthorizedError("Authentication required");
    }
  const roomId = req.params.roomId as string;
  const room = await roomService.getByIdForInternal(roomId)

  res.json({
    success: true,
    data: room.members,
  });
});