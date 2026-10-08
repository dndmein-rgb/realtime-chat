import { FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "../store/auth";
import { useChat } from "../hooks/useChat";
import { notificationApi } from "../api/client";

function roomTitle(
  room: {
    name: string | null;
    type: string;
    members: { userId: string }[];
  },
  myId: string,
) {
  if (room.type === "GROUP") return room.name || "Group";
  const other = room.members.find((m) => m.userId !== myId);
  return other ? `DM · ${other.userId.slice(0, 8)}…` : "Private chat";
}

function statusIcon(status: string) {
  if (status === "SEEN") return "✓✓";
  if (status === "DELIVERED") return "✓✓";
  return "✓";
}

export function ChatPage() {
  const { user, logout } = useAuth();
  const {
    rooms,
    activeRoom,
    activeRoomId,
    messages,
    onlineUsers,
    typingUsers,
    notifications,
    unread,
    loadingRooms,
    connected,
    error,
    selectRoom,
    sendMessage,
    onTyping,
    createPrivate,
    createGroup,
    loadNotifications,
    setError,
  } = useChat();

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [otherUserId, setOtherUserId] = useState("");
  const [groupName, setGroupName] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeRoomId]);

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(text);
      setText("");
    } catch {
      // error already set in hook
    } finally {
      setSending(false);
    }
  };

  const handleCreatePrivate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createPrivate(otherUserId.trim());
      setShowPrivateModal(false);
      setOtherUserId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleCreateGroup = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createGroup(groupName.trim());
      setShowGroupModal(false);
      setGroupName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const markAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      await loadNotifications();
    } catch {
      // ignore
    }
  };

  if (!user) return null;

  const typingInRoom = activeRoomId
    ? (typingUsers[activeRoomId] ?? []).filter((id) => id !== user.id)
    : [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="user-chip">
            <strong>
              {user.firstName} {user.lastName}
            </strong>
            <span title={user.id}>
              <span
                className={`status-dot ${connected ? "online" : "offline"}`}
              />
              {connected ? "Connected" : "Disconnected"}
            </span>
            <span
              style={{
                fontSize: "0.7rem",
                fontFamily: "var(--mono)",
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
              title="Click to copy full user id"
              onClick={() => void navigator.clipboard.writeText(user.id)}
            >
              {user.id}
            </span>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => void logout()}
            title="Logout"
          >
            Out
          </button>
        </div>

        <div className="sidebar-actions">
          <button
            className="btn btn-ghost"
            onClick={() => setShowPrivateModal(true)}
          >
            + Private
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setShowGroupModal(true)}
          >
            + Group
          </button>
        </div>

        <div className="room-list">
          {loadingRooms && <div className="empty-state">Loading rooms…</div>}
          {!loadingRooms && rooms.length === 0 && (
            <div className="empty-state">
              <p>No rooms yet. Create one to start chatting.</p>
            </div>
          )}
          {rooms.map((room) => (
            <button
              key={room.id}
              className={`room-item ${room.id === activeRoomId ? "active" : ""}`}
              onClick={() => void selectRoom(room.id)}
            >
              <span className="name">{roomTitle(room, user.id)}</span>
              <span className="meta">
                {room.type} · {room.members.length} member
                {room.members.length !== 1 ? "s" : ""}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="chat-main">
        {error && (
          <div className="error-banner" style={{ margin: 12 }}>
            {error}
            <button
              type="button"
              style={{
                marginLeft: 12,
                color: "inherit",
                textDecoration: "underline",
              }}
              onClick={() => setError(null)}
            >
              dismiss
            </button>
          </div>
        )}

        {!activeRoom ? (
          <div className="empty-state">
            <h3>Select a room</h3>
            <p>Pick a conversation on the left or create a new one.</p>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div>
                <h2>{roomTitle(activeRoom, user.id)}</h2>
                <div className="meta">
                  {activeRoom.members.map((m) => (
                    <span key={m.id} style={{ marginRight: 10 }}>
                      <span
                        className={`status-dot ${onlineUsers.has(m.userId) ? "online" : "offline"}`}
                      />
                      {m.userId === user.id ? "you" : m.userId.slice(0, 8)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="messages">
              {messages.map((m) => {
                const mine = m.senderId === user.id;
                return (
                  <div key={m.id} className={`message ${mine ? "mine" : ""}`}>
                    {!mine && (
                      <div className="sender">{m.senderId.slice(0, 8)}…</div>
                    )}
                    <div className="body">{m.content}</div>
                    <div className="footer">
                      <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                      {mine && (
                        <span title={m.status}>{statusIcon(m.status)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="typing-bar">
              {typingInRoom.length > 0
                ? `${typingInRoom.map((id) => id.slice(0, 6)).join(", ")} typing…`
                : "\u00A0"}
            </div>

            <form className="composer" onSubmit={onSend}>
              <input
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  onTyping();
                }}
                placeholder="Type a message…"
                autoComplete="off"
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={sending || !text.trim()}
              >
                Send
              </button>
            </form>
          </>
        )}
      </main>

      <aside className="sidebar sidebar-right">
        <div className="panel-section">
          <h3>
            Notifications {unread > 0 && <span className="badge">{unread}</span>}
          </h3>
          {unread > 0 && (
            <button
              className="btn btn-ghost"
              style={{ marginBottom: 10, width: "100%" }}
              onClick={() => void markAllRead()}
            >
              Mark all read
            </button>
          )}
          {notifications.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              No notifications
            </p>
          )}
          {notifications.slice(0, 15).map((n) => (
            <div key={n.id} className="notif-item">
              <div>
                {n.content.slice(0, 80)}
                {n.content.length > 80 ? "…" : ""}
              </div>
              <div className="time">
                {new Date(n.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <div className="panel-section">
          <h3>Online ({onlineUsers.size})</h3>
          {[...onlineUsers].map((id) => (
            <div key={id} className="member-row">
              <span className="status-dot online" />
              {id === user.id ? "you" : `${id.slice(0, 12)}…`}
            </div>
          ))}
          {onlineUsers.size === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Nobody online yet
            </p>
          )}
        </div>
      </aside>

      {showPrivateModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowPrivateModal(false)}
        >
          <form
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreatePrivate}
          >
            <h3>New private chat</h3>
            <div className="form-group">
              <label>Other user ID (UUID)</label>
              <input
                value={otherUserId}
                onChange={(e) => setOtherUserId(e.target.value)}
                required
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Tip: open another browser, register a second user, click their
              user id under the name to copy.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowPrivateModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "auto" }}
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {showGroupModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowGroupModal(false)}
        >
          <form
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateGroup}
          >
            <h3>New group</h3>
            <div className="form-group">
              <label>Group name</label>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowGroupModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "auto" }}
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}