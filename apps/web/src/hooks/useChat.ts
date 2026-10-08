import { useCallback, useEffect, useRef, useState } from "react";
import { chatApi, notificationApi, presenceApi } from "../api/client";
import {
  connectSocket,
  emitHeartbeat,
  emitMessageSeen,
  emitTypingStart,
  emitTypingStop,
  joinRoom,
  leaveRoom,
} from "../api/socket";
import type { Message, NotificationItem, Room } from "../types";
import { useAuth } from "../store/auth";

export function useChat() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const activeRoomRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeRoomRef.current = activeRoomId;
  }, [activeRoomId]);

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    setError(null);
    try {
      const res = await chatApi.getRooms();
      setRooms(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rooms");
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (roomId: string) => {
      setLoadingMessages(true);
      setError(null);
      try {
        const res = await chatApi.getMessages(roomId, 50);
        const list = [...(res.data?.messages ?? [])].reverse();
        setMessages(list);

        const ids = list
          .filter((m) => m.senderId !== user?.id && m.status !== "SEEN")
          .map((m) => m.id);
        if (ids.length > 0) {
          emitMessageSeen(roomId, ids);
          void chatApi.markSeen(roomId, ids).catch(() => undefined);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load messages");
      } finally {
        setLoadingMessages(false);
      }
    },
    [user?.id],
  );

  const selectRoom = useCallback(
    async (roomId: string) => {
      const prev = activeRoomRef.current;
      if (prev && prev !== roomId) {
        await leaveRoom(prev);
      }
      setActiveRoomId(roomId);
      await joinRoom(roomId);
      await loadMessages(roomId);
    },
    [loadMessages],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeRoomId || !content.trim()) return;
      try {
        const res = await chatApi.sendMessage(activeRoomId, content.trim());
        if (res.data) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === res.data!.id)) return prev;
            return [...prev, res.data!];
          });
        }
        emitTypingStop(activeRoomId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send");
        throw e;
      }
    },
    [activeRoomId],
  );

  const onTyping = useCallback(() => {
    if (!activeRoomId) return;
    emitTypingStart(activeRoomId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (activeRoomId) emitTypingStop(activeRoomId);
    }, 2000);
  }, [activeRoomId]);

  const createPrivate = useCallback(
    async (otherUserId: string) => {
      const res = await chatApi.createPrivate(otherUserId);
      await loadRooms();
      if (res.data) await selectRoom(res.data.id);
      return res.data;
    },
    [loadRooms, selectRoom],
  );

  const createGroup = useCallback(
    async (name: string, memberIds: string[] = []) => {
      const res = await chatApi.createGroup(name, memberIds);
      await loadRooms();
      if (res.data) await selectRoom(res.data.id);
      return res.data;
    },
    [loadRooms, selectRoom],
  );

  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationApi.list();
      setNotifications(res.data?.notifications ?? []);
      setUnread(res.data?.unread ?? 0);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    let s;
    try {
      s = connectSocket();
    } catch {
      return;
    }

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onMessageNew = (payload: {
      messageId: string;
      roomId: string;
      senderId: string;
      content: string;
      createdAt: string;
      status: Message["status"];
    }) => {
      const msg: Message = {
        id: payload.messageId,
        roomId: payload.roomId,
        senderId: payload.senderId,
        content: payload.content,
        createdAt: payload.createdAt,
        status: payload.status ?? "SENT",
      };

      if (activeRoomRef.current === payload.roomId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (payload.senderId !== user.id) {
          emitMessageSeen(payload.roomId, [payload.messageId]);
        }
      }

      setRooms((prev) => {
        const idx = prev.findIndex((r) => r.id === payload.roomId);
        if (idx < 0) return prev;
        const room = prev[idx]!;
        const rest = prev.filter((r) => r.id !== payload.roomId);
        return [{ ...room, updatedAt: payload.createdAt }, ...rest];
      });
    };

    const onMessageStatus = (payload: {
      messageId: string;
      roomId: string;
      status: Message["status"];
    }) => {
      if (activeRoomRef.current !== payload.roomId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId ? { ...m, status: payload.status } : m,
        ),
      );
    };

    const onTypingStart = (payload: { roomId: string; userId: string }) => {
      if (payload.userId === user.id) return;
      setTypingUsers((prev) => {
        const list = prev[payload.roomId] ?? [];
        if (list.includes(payload.userId)) return prev;
        return { ...prev, [payload.roomId]: [...list, payload.userId] };
      });
    };

    const onTypingStop = (payload: { roomId: string; userId: string }) => {
      setTypingUsers((prev) => {
        const list = (prev[payload.roomId] ?? []).filter(
          (id) => id !== payload.userId,
        );
        return { ...prev, [payload.roomId]: list };
      });
    };

    const onPresenceOnline = (payload: { userId: string }) => {
      setOnlineUsers((prev) => new Set(prev).add(payload.userId));
    };

    const onPresenceOffline = (payload: { userId: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(payload.userId);
        return next;
      });
    };

    const onNotification = (payload: NotificationItem) => {
      setNotifications((prev) => [payload, ...prev]);
      setUnread((n) => n + 1);
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("message:new", onMessageNew);
    s.on("message:status", onMessageStatus);
    s.on("typing:start", onTypingStart);
    s.on("typing:stop", onTypingStop);
    s.on("presence-online", onPresenceOnline);
    s.on("presence:offline", onPresenceOffline);
    s.on("presence-offline", onPresenceOffline);
    s.on("notification:new", onNotification);

    if (s.connected) setConnected(true);

    const hb = setInterval(() => emitHeartbeat(), 20_000);

    void presenceApi.getOnline().then((res) => {
      if (res.data?.online) setOnlineUsers(new Set(res.data.online));
    });

    void loadRooms();
    void loadNotifications();

    return () => {
      clearInterval(hb);
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("message:new", onMessageNew);
      s.off("message:status", onMessageStatus);
      s.off("typing:start", onTypingStart);
      s.off("typing:stop", onTypingStop);
      s.off("presence-online", onPresenceOnline);
      s.off("presence:offline", onPresenceOffline);
      s.off("presence-offline", onPresenceOffline);
      s.off("notification:new", onNotification);
    };
  }, [user, loadRooms, loadNotifications]);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;

  return {
    rooms,
    activeRoom,
    activeRoomId,
    messages,
    onlineUsers,
    typingUsers,
    notifications,
    unread,
    loadingRooms,
    loadingMessages,
    error,
    connected,
    selectRoom,
    sendMessage,
    onTyping,
    createPrivate,
    createGroup,
    loadRooms,
    loadNotifications,
    setError,
  };
}