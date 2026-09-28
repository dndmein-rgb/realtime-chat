import type { Request, Response } from "express";
import { asyncHandler } from "@realtime-chat/shared-utils";
import { authService } from "./auth.container.js";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.register(req.body);

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: user,
  });
})