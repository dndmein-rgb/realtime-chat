import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@realtime-chat/shared-utils";
import { RoomInterface } from "./room.interface.js";
import { CreateRoomInput } from "./room.schema.js";
import { RoomView } from "./room.types.js";
import { logger } from "../../config/logger.js";

export class RoomService {
  constructor(private readonly roomRepo: RoomInterface) {}

  async create(userId: string, input: CreateRoomInput): Promise<RoomView> {
    if (input.type === "PRIVATE") {
      if (input.otherUserId === userId) {
        throw new BadRequestError("Cannot create private room with yourself");
      }
      const existing = await this.roomRepo.findExistingPrivateRoom(
        userId,
        input.otherUserId,
      );
      if (existing) {
        return existing;
      }

      const room = await this.roomRepo.createPrivate({
        type: "PRIVATE",
        otherUserId: input.otherUserId,
        createdById: userId,
      });

      logger.info({ roomId: room.id, userId }, "Private room created");
      return room;
    }
    // GROUP
    const room = await this.roomRepo.createGroup({
      type: "GROUP",
      createdById: userId,
      name: input.name,
      memberIds: input.memberIds ?? [],
    });
    logger.info({ roomId: room.id, userId }, "Group room created");
    return room;
  }

  async getMyRooms(userId: string): Promise<RoomView[]> {
    return await this.roomRepo.findByUserId(userId);
  }

  async getById(roomId: string, userId: string): Promise<RoomView> {
    const room = await this.roomRepo.findById(roomId);
    if (!room) {
      throw new NotFoundError("Room not found");
    }
    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenError("You are not a member of this room");
    }
    return room;
  }
  async addMember(roomId:string,requesterId:string,targetUserId:string): Promise<RoomView>{
    const room = await this.roomRepo.findById(roomId);
    if (!room) {
      throw new NotFoundError("Room not found");
    }
    if (room.type === "PRIVATE") {
          throw new BadRequestError("Cannot add members to a private room");
    }

    const requester = room.members.find((m) => m.userId === requesterId);
    if (!requester || (requester.role !== "OWNER" && requester.role !== "ADMIN")) {
          throw new ForbiddenError("Only owner or admin can add members");
        }
  
  const alreadyMember = room.members.some((m) => m.userId === targetUserId);
    if (alreadyMember) {
      throw new ConflictError("User is already a member of this room");
    }
    await this.roomRepo.addMember(roomId, targetUserId, "MEMBER");
    
        const updated = await this.roomRepo.findById(roomId);
        if (!updated) {
          throw new NotFoundError("Room not found after update");
        }
        logger.info( {
              roomId,
              addedUserId: targetUserId,
              by: requesterId,
            },"Member added to room");
        
            return updated;
  }

  async assertMember(roomId: string, userId: string): Promise<void> {
      const isMember = await this.roomRepo.isMember(roomId, userId);
      if (!isMember) {
        throw new ForbiddenError("You are not a member of this room");
      }
    }
  
  async getByIdForInternal(roomId: string): Promise<RoomView>{
    const room = await this.roomRepo.findById(roomId)
    if (!room) throw new NotFoundError("Room not found");
      return room;
  }
  }
