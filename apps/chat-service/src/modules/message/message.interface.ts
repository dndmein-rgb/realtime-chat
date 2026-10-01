import type{ MessageView, PaginatedMessages } from "./message.types.js";

export interface MessageInterface{
  create(roomId: string, senderId: string, content: string): Promise<MessageView>
  listByRoom(roomId: string, limit: number, beforeMessageId?: string): Promise<PaginatedMessages>
  prismaRoomTouch(roomId:string):Promise<void>
}