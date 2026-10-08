import express from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { markDeliveredSchema, markSeenSchema, sendMessageSchema } from "./message.schema.js";
import { listMessages, markMessagesDelivered, markMessagesSeen, sendMessage } from "./message.controller.js";
import { internalAuth } from "../../middlewares/internal-auth.middleware.js";
import { sendMessageRateLimiter } from "../../middlewares/rate-limit.js";

const router = express.Router({ mergeParams: true });

// Internal delivered endpoint (gateway uses this)
router.post(
  "/delivered",
  internalAuth,
  validate(markDeliveredSchema),
  markMessagesDelivered,
);
router.use(authenticate);

router.post("/", sendMessageRateLimiter,validate(sendMessageSchema), sendMessage);
router.get("/", listMessages);
router.post("/seen", validate(markSeenSchema), markMessagesSeen);
router.post("/delivered", validate(markDeliveredSchema),markMessagesDelivered);

export default router;