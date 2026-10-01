export interface MessageView {
  id: string;
  roomId: string;
  content: string;
  senderId: string;
  createdAt: Date;
}


export interface PaginatedMessages{
  messages: MessageView[];
  nextCursor: string | null;
  hasMore:boolean
}