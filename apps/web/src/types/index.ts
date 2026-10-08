export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface RoomMember {
  id: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: string;
}

export interface Room {
  id: string;
  name: string | null;
  type: "PRIVATE" | "GROUP";
  createdById: string;
  createdAt: string;
  updatedAt: string;
  members: RoomMember[];
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: string;
  status: "SENT" | "DELIVERED" | "SEEN";
}

export interface NotificationItem {
  id: string;
  roomId: string;
  messageId: string;
  senderId: string;
  content: string;
  createdAt: string;
  read?: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}