import express from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { addMemberSchema, createRoomSchema } from "./room.schema.js";
import {
  addMember,
  createRoom,
  getMyRooms,
  getRoomById,
} from "./room.controller.js";

const router = express.Router();

router.use(authenticate);

router.post("/", validate(createRoomSchema), createRoom);
router.get("/", getMyRooms);
router.get("/:roomId", getRoomById);
router.post("/:roomId/members", validate(addMemberSchema), addMember);

export default router;