import { ForbiddenError, NotFoundError } from "@realtime-chat/shared-utils";
import { RoomInterface } from "../room/room.interface.js";
import { MessageInterface } from "./message.interface.js";
import { MessageView, PaginatedMessages } from "./message.types.js";
import { logger } from "../../config/logger.js";
import { ChatMessageCreatedEvent } from "@realtime-chat/shared-events";
import { randomUUID } from "node:crypto";


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
    // Build the event first so we can store it in the outbox
    
      const messageId = randomUUID();
      const eventId = randomUUID();
      const now = new Date();
    

    const event: ChatMessageCreatedEvent = {
        eventId,
        eventType: "chat.message.created",
        occurredAt: now.toISOString(),
        data: {
          messageId: "", 
          roomId,
          senderId,
          content,
          createdAt: now.toISOString(),
        },
      };

    // You need to change createWithOutbox to accept a pre-generated id
      const message = await this.messageRepo.createWithOutbox(
        messageId,
        roomId,
        senderId,
        content,
        event,
    );
      logger.info("Message sent (outbox)", {
          messageId: message.id,
          roomId,
          senderId,
          eventId: event.eventId,
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