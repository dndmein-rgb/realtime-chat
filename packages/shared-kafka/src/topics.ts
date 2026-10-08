export const TOPICS = {
  CHAT_MESSAGE_CREATED: "chat.message.created",
  PRESENCE_USER_ONLINE: "presence.user.online",
  PRESENCE_USER_OFFLINE: "presence.user.offline",
  CHAT_MESSAGE_STATUS: "chat.message.status",
  NOTIFICATION_CREATED: "notification.created",
  CHAT_OUTBOX_DLQ: "chat.outbox.dlq",
}

export type TopicName=(typeof TOPICS)[keyof typeof TOPICS]
