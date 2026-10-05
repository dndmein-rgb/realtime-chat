import { ChatMessageCreatedEvent } from "@realtime-chat/shared-events";
import { prisma } from "../../infrastructure/prisma.js";
import { MessageInterface } from "./message.interface.js";
import type { MessageView, PaginatedMessages } from "./message.types.js";
import { TOPICS } from "@realtime-chat/shared-kafka";

const messageSelect = {
  id: true,
  roomId: true,
  senderId: true,
  content: true,
  createdAt: true,
  status: true,
} as const;

export class MessageRepository implements MessageInterface {
  async create(
    roomId: string,
    senderId: string,
    content: string,
  ): Promise<MessageView> {
    return prisma.message.create({
      data: { roomId, content, senderId },
      select: messageSelect,
    });
  }

  /**
   * Atomic: message + room touch + outbox row
   */
  async createWithOutbox(
    messageId: string,
    roomId: string,
    senderId: string,
    content: string,
    event: ChatMessageCreatedEvent,
  ): Promise<MessageView> {
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: { id: messageId, roomId, senderId, content },
        select: messageSelect,
      });
      await tx.room.update({
        where: { id: roomId },
        data: { updatedAt: new Date() },
      });
      await tx.outBox.create({
        data: {
          key: roomId,
          topic: TOPICS.CHAT_MESSAGE_CREATED,
          payload: event as any,
        },
      });
      return message;
    });
  }
  async listByRoom(
    roomId: string,
    limit: number,
    beforeMessageId?: string,
  ): Promise<PaginatedMessages> {
    let beforeCreatedAt: Date | undefined;

    if (beforeMessageId) {
      const cursorMsg = await prisma.message.findUnique({
        where: { id: beforeMessageId },
        select: { createdAt: true, roomId: true },
      });

      if (!cursorMsg || cursorMsg.roomId !== roomId) {
        return { messages: [], nextCursor: null, hasMore: false };
      }
      beforeCreatedAt = cursorMsg.createdAt;
    }
    const messages = await prisma.message.findMany({
      where: {
        roomId,
        ...(beforeCreatedAt && {
          createdAt: { lt: beforeCreatedAt },
        }),
      },
      select: messageSelect,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor =
      hasMore && page.length > 0 ? page[page.length - 1]!.id : null;

    return {
      messages: page,
      nextCursor,
      hasMore,
    };
  }
  async prismaRoomTouch(roomId: string): Promise<void> {
    await prisma.room.update({
      where: { id: roomId },
      data: { updatedAt: new Date() },
    });
  }

  async updateStatus(
    messageIds: string[],
    roomId: string,
    status: "DELIVERED" | "SEEN",
  ): Promise<string[]> {
    // Only update messages that are still in a lower state
    await prisma.message.updateMany({
      where: {
        id: { in: messageIds },
        roomId,
        status: { in: status === "SEEN" ? ["SENT", "DELIVERED"] : ["SENT"] },
      },
      data: { status },
    });
    return messageIds;
  }
  async createStatusOutbox(
    events: Array<{
      messageId: string;
      roomId: string;
      status: "DELIVERED" | "SEEN";
      userId: string;
    }>,
  ): Promise<void>{
    await prisma.outBox.createMany({
      data: events.map((e) => ({
        key: e.roomId,
          topic: TOPICS.CHAT_MESSAGE_STATUS,
        payload: {
          eventId: crypto.randomUUID(),
          eventType: "chat.message.status",
                  occurredAt: new Date().toISOString(),
                  data: e,
            }
      }))
    })
  }

  async getMessages(messageIds:string[],roomId:string):Promise<Array<{id:string,senderId:string}>> {
    return prisma.message.findMany({
      where: {
        id: { in: messageIds },roomId
      },
        select: {
          id:true,senderId:true
        
      }
    })
  }
}
