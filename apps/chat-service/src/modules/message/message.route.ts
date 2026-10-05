import express from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { markDeliveredSchema, markSeenSchema, sendMessageSchema } from "./message.schema.js";
import { listMessages, markMessagesDelivered, markMessagesSeen, sendMessage } from "./message.controller.js";

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.post("/", validate(sendMessageSchema), sendMessage);
router.get("/", listMessages);
router.post("/seen", validate(markSeenSchema), markMessagesSeen);
router.post("/delivered", validate(markDeliveredSchema),markMessagesDelivered);

export default router;