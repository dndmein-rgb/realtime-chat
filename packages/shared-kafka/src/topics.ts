export const TOPICS = {
  CHAT_MESSAGE_CREATED: "chat.message.created",
  PRESENCE_USER_ONLINE: "presence.user.online",
  PRESENCE_USER_OFFLINE: "presence.user.offline",
  CHAT_MESSAGE_STATUS:   "chat_message_status"
}

export type TopicName=(typeof TOPICS)[keyof typeof TOPICS]
