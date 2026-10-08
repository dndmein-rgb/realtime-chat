import express from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { addMemberSchema, createRoomSchema } from "./room.schema.js";
import {
  addMember,
  createRoom,
  getMyRooms,
  getRoomById,
  getRoomMembers,
} from "./room.controller.js";
import { internalAuth } from "../../middlewares/internal-auth.middleware.js";

const router = express.Router();

router.use(authenticate);
// ---------- Internal (no JWT, service key only) ----------
router.get("/internal/:roomId/members", internalAuth, getRoomMembers); 

// ---------- Client-facing (JWT) ----------
router.use(authenticate);

router.post("/", validate(createRoomSchema), createRoom);
router.get("/", getMyRooms);
router.get("/:roomId", getRoomById);
router.post("/:roomId/members", validate(addMemberSchema), addMember);
router.get("/:roomId/members", getRoomMembers);          

export default router;