import { prisma } from "../../infrastructure/prisma.js";
import { RoomInterface } from "./room.interface.js";
import {
  CreateGroupRoomData,
  CreatePrivateRoomData,
  RoomView,
} from "./room.types.js";

const roomSelect = {
  id: true,
  name: true,
  type: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  members: {
    select: {
      id: true,
      userId: true,
      joinedAt: true,
      role: true,
    },
  },
} as const;

export class RoomRepository implements RoomInterface {
  async createPrivate(data: CreatePrivateRoomData): Promise<RoomView> {
    return prisma.room.create({
      data: {
        type: "PRIVATE",
        name: null,
        createdById: data.createdById,
        members: {
          create: [
            { userId: data.createdById, role: "OWNER" },
            { userId: data.otherUserId, role: "MEMBER" },
          ],
        },
      },
      select: roomSelect,
    });
  }

  async createGroup(data: CreateGroupRoomData): Promise<RoomView> {
    const uniqueMemberIds = Array.from(
      new Set([data.createdById, ...data.memberIds]),
    );

    return prisma.room.create({
      data: {
        type: "GROUP",
        name: data.name,
        createdById: data.createdById,
        members: {
          create: uniqueMemberIds.map((userId) => ({
            userId,
            role: userId === data.createdById ? "OWNER" : "MEMBER",
          })),
        },
      },
      select: roomSelect,
    });
  }

  async findById(roomId: string): Promise<RoomView | null> {
    return prisma.room.findUnique({
      where: { id: roomId },
      select: roomSelect,
    });
  }

  async findByUserId(userId: string): Promise<RoomView[]> {
    return prisma.room.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      select: roomSelect,
      orderBy: { updatedAt: "desc" },
    });
  }

  async isMember(roomId: string, userId: string): Promise<boolean> {
    const member = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: { roomId, userId },
      },
      select: { id: true },
    });
    return member !== null;
  }

  async addMember(
    roomId: string,
    userId: string,
    role: "MEMBER" | "ADMIN",
  ): Promise<void> {
    await prisma.roomMember.create({
      data: {
        userId,
        roomId,
        role,
      },
    });
  }

  async findExistingPrivateRoom(
    userA: string,
    userB: string,
  ): Promise<RoomView | null> {
    return prisma.room.findFirst({
      where: {
        type: "PRIVATE",
        AND: [
          { members: { some: { userId: userA } } },
          { members: { some: { userId: userB } } },
        ],
      },
      select: roomSelect,
    });
  }
}
