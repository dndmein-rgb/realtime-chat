import { ChatMessageCreatedEvent } from "@realtime-chat/shared-events";
import type{ MessageView, PaginatedMessages } from "./message.types.js";

export interface MessageInterface{
  create(roomId: string, senderId: string, content: string): Promise<MessageView>
  createWithOutbox(messageId:string,roomId:string,senderId:string,content:string,event:ChatMessageCreatedEvent):Promise<MessageView>
  listByRoom(roomId: string, limit: number, beforeMessageId?: string): Promise<PaginatedMessages>
  prismaRoomTouch(roomId:string):Promise<void>
}