import express from "express";
import type { Request, Response } from "express";
import { asyncHandler, UnauthorizedError, BadRequestError } from "@realtime-chat/shared-utils";
import { notificationStore } from "../../infrastructure/notification.store.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { z } from "zod";

const router = express.Router();

router.use(authenticate);

const markReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()).min(1).max(100),
});

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError("Authentication required");

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const notifications = await notificationStore.list(
      req.user.userId,
      limit,
      offset,
    );
    const unread = await notificationStore.unreadCount(req.user.userId);

    res.status(200).json({
      success: true,
      data: { notifications, unread },
    });
  }),
);

router.get(
  "/unread-count",
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError("Authentication required");

    const unread = await notificationStore.unreadCount(req.user.userId);

    res.status(200).json({
      success: true,
      data: { unread },
    });
  }),
);

router.post(
  "/read",
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError("Authentication required");

    const parsed = markReadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(
        parsed.error.errors.map((e) => e.message).join(", "),
      );
    }

    await notificationStore.markAsRead(
      req.user.userId,
      parsed.data.notificationIds,
    );

    res.status(200).json({ success: true, message: "Marked as read" });
  }),
);

router.post(
  "/read-all",
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError("Authentication required");

    await notificationStore.markAllAsRead(req.user.userId);

    res.status(200).json({ success: true, message: "All marked as read" });
  }),
);

export default router;