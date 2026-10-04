export interface MessageView {
  id: string;
  roomId: string;
  content: string;
  senderId: string;
  createdAt: Date;
  status:"SENT"|"DELIVERED"|"SEEN"
}


export interface PaginatedMessages{
  messages: MessageView[];
  nextCursor: string | null;
  hasMore:boolean
}