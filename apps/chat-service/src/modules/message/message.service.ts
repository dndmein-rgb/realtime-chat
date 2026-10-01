import { ForbiddenError, NotFoundError } from "@realtime-chat/shared-utils";
import { RoomInterface } from "../room/room.interface.js";
import { MessageInterface } from "./message.interface.js";
import { MessageView, PaginatedMessages } from "./message.types.js";
import { logger } from "../../config/logger.js";
import { ChatMessageCreatedEvent } from "@realtime-chat/shared-events";
import { randomUUID } from "node:crypto";
import { kafkaProducer } from "../../infrastructure/kafka.js";
import { TOPICS } from "@realtime-chat/shared-kafka";

export class MessageService {
  constructor(
    private readonly messageRepo: MessageInterface,
    private readonly roomRepo: RoomInterface,
  ) {}

  async send(
    roomId: string,
    senderId: string,
    content: string,
  ): Promise<MessageView> {
    const isMember = await this.roomRepo.isMember(roomId, senderId);
    if (!isMember) {
      throw new ForbiddenError("You are not a member of this room");
    }

    const message = await this.messageRepo.create(roomId, senderId, content);

    // Touch room updatedAt so it sorts correctly in "my rooms"
    await this.messageRepo.prismaRoomTouch(roomId);

    // Publish domain event (fire-and-forget with logging on failure)
    const event: ChatMessageCreatedEvent = {
      eventId: randomUUID(),
      eventType: "chat.message.created",
      occurredAt: new Date().toISOString(),
      data: {
        messageId: message.id,
        roomId: message.roomId,
        senderId: message.senderId,
        content: message.content,
        createdAt:message.createdAt.toISOString()
      }
    }
    try {
      await kafkaProducer.send(TOPICS.CHAT_MESSAGE_CREATED, roomId, event)
      logger.info(
      "Published chat.message.created",
              {
                messageId: message.id,
                roomId,
                eventId: event.eventId,
              },
              
            );
    } catch (error) {
      // Message is already persisted; event publish failure should not fail the HTTP request
            logger.error("Failed to publish chat.message.created", error);
    }

    logger.info("Message sent", {
      messageId: message.id,
      roomId,
      senderId,
    });

    return message;
  }

  async list(
    roomId: string,
    userId: string,
    limit: number,
    before?: string,
  ): Promise<PaginatedMessages> {
    const isMember = await this.roomRepo.isMember(roomId, userId);
    if (!isMember) {
      throw new ForbiddenError("You are not a member of this room");
    }

    const room = await this.roomRepo.findById(roomId);
    if (!room) {
      throw new NotFoundError("Room not found");
    }

    return this.messageRepo.listByRoom(roomId, limit, before);
  }
}