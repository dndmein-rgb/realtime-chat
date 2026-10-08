import type {
  ApiResponse,
  Message,
  NotificationItem,
  Room,
  User,
} from "../types";

const USER_URL = import.meta.env.VITE_USER_URL;
const CHAT_URL = import.meta.env.VITE_CHAT_URL;
const NOTIFICATION_URL = import.meta.env.VITE_NOTIFICATION_URL;
const PRESENCE_URL = import.meta.env.VITE_PRESENCE_URL;

let accessToken: string | null = localStorage.getItem("accessToken");

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) localStorage.setItem("accessToken", token);
  else localStorage.removeItem("accessToken");
}

export function getAccessToken() {
  return accessToken;
}

async function request<T>(
  base: string,
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const body = (await res.json().catch(() => ({}))) as ApiResponse<T>;

  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/refresh" && path !== "/auth/login") {
      try {
        const refreshed = await request<{ accessToken: string }>(
          USER_URL,
          "/auth/refresh",
          { method: "POST" },
        );
        if (refreshed.data?.accessToken) {
          setAccessToken(refreshed.data.accessToken);
          headers.Authorization = `Bearer ${refreshed.data.accessToken}`;
          const retry = await fetch(`${base}${path}`, {
            ...options,
            headers,
            credentials: "include",
          });
          const retryBody = (await retry.json()) as ApiResponse<T>;
          if (!retry.ok) {
            throw new Error(
              retryBody.message || retryBody.error || `HTTP ${retry.status}`,
            );
          }
          return retryBody;
        }
      } catch {
        setAccessToken(null);
      }
    }
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }

  return body;
}

export const authApi = {
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) =>
    request<User>(USER_URL, "/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<{ user: User; accessToken: string }>(USER_URL, "/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  refresh: () =>
    request<{ accessToken: string }>(USER_URL, "/auth/refresh", {
      method: "POST",
    }),

  logout: () => request(USER_URL, "/auth/logout", { method: "POST" }),

  me: () => request<User>(USER_URL, "/auth/me"),
};

export const chatApi = {
  getRooms: () => request<Room[]>(CHAT_URL, "/rooms"),

  getRoom: (roomId: string) => request<Room>(CHAT_URL, `/rooms/${roomId}`),

  createPrivate: (otherUserId: string) =>
    request<Room>(CHAT_URL, "/rooms", {
      method: "POST",
      body: JSON.stringify({ type: "PRIVATE", otherUserId }),
    }),

  createGroup: (name: string, memberIds: string[] = []) =>
    request<Room>(CHAT_URL, "/rooms", {
      method: "POST",
      body: JSON.stringify({ type: "GROUP", name, memberIds }),
    }),

  addMember: (roomId: string, userId: string) =>
    request<Room>(CHAT_URL, `/rooms/${roomId}/members`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),

  getMessages: (roomId: string, limit = 50, before?: string) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (before) qs.set("before", before);
    return request<{
      messages: Message[];
      nextCursor: string | null;
      hasMore: boolean;
    }>(CHAT_URL, `/rooms/${roomId}/messages?${qs}`);
  },

  sendMessage: (roomId: string, content: string) =>
    request<Message>(CHAT_URL, `/rooms/${roomId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  markSeen: (roomId: string, messageIds: string[]) =>
    request(CHAT_URL, `/rooms/${roomId}/messages/seen`, {
      method: "POST",
      body: JSON.stringify({ messageIds }),
    }),
};

export const notificationApi = {
  list: (limit = 50, offset = 0) =>
    request<{ notifications: NotificationItem[]; unread: number }>(
      NOTIFICATION_URL,
      `/notifications?limit=${limit}&offset=${offset}`,
    ),

  unreadCount: () =>
    request<{ unread: number }>(NOTIFICATION_URL, "/notifications/unread-count"),

  markRead: (notificationIds: string[]) =>
    request(NOTIFICATION_URL, "/notifications/read", {
      method: "POST",
      body: JSON.stringify({ notificationIds }),
    }),

  markAllRead: () =>
    request(NOTIFICATION_URL, "/notifications/read-all", { method: "POST" }),
};

export const presenceApi = {
  getUser: (userId: string) =>
    request<{ userId: string; online: boolean; lastSeen: string | null }>(
      PRESENCE_URL,
      `/presence/${userId}`,
    ),

  getOnline: () =>
    request<{ online: string[]; count: number }>(PRESENCE_URL, "/presence"),
};