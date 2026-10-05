import { z } from "zod";

export const ChatMessageCreatedSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("chat.message.created"),
  occurredAt: z.string().datetime(),
  data: z.object({
    messageId: z.string().uuid(),
    roomId: z.string().uuid(),
    senderId: z.string().uuid(),
    content: z.string().min(1).max(5000),
    createdAt: z.string().datetime(),
  }),
});

export const MessageStatusUpdatedSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("chat.message.status"),
  occurredAt: z.string().datetime(),
  data: z.object({
    messageId: z.string().uuid(),
    roomId: z.string().uuid(),
    status: z.enum(["DELIVERED", "SEEN"]),
      userId:z.string().uuid().optional()
  })
})
export type ChatMessageCreatedEvent = z.infer<typeof ChatMessageCreatedSchema>;
export type MessageStatusUpdatedEvent = z.infer<typeof MessageStatusUpdatedSchema>;
