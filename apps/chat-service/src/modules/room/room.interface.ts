import {
  CreateGroupRoomData,
  CreatePrivateRoomData,
  RoomView,
} from "./room.types.js";

export interface RoomInterface {
  createPrivate(data: CreatePrivateRoomData): Promise<RoomView>;
  createGroup(data: CreateGroupRoomData): Promise<RoomView>;
  findById(roomId: string): Promise<RoomView | null>;
  findByUserId(userId: string): Promise<RoomView[]>;
  isMember(roomId: string, userId: string): Promise<boolean>;
  addMember(
    roomId: string,
    userId: string,
    role: "MEMBER" | "ADMIN",
  ): Promise<void>;
  findExistingPrivateRoom(
    userA: string,
    userB: string,
  ): Promise<RoomView | null>;
}
