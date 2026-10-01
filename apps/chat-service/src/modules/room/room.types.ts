import type { MemberRole, RoomType } from "../../generated/prisma/client.js";

export interface RoomMemberView {
  id: string;
  userId: string;
  role: MemberRole;
  joinedAt: Date;
}

export interface RoomView {
  id: string;
  name: string | null;
  type: RoomType;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  members: RoomMemberView[];
}

export interface CreatePrivateRoomData {
  type: "PRIVATE";
  otherUserId: string;
  createdById: string;
}

export interface CreateGroupRoomData {
  type: "GROUP";
  name: string;
  createdById: string;
  memberIds: string[];
}
