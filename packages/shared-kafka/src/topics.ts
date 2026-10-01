export const TOPICS = {
  CHAT_MESSAGE_CREATED: "chat.message.created",
  PRESENCE_USER_ONLINE: "presence.user.online",
  PRESENCE_USER_OFFLINE:"presence.user.offline"
}

export type TopicName=(typeof TOPICS)[keyof typeof TOPICS]