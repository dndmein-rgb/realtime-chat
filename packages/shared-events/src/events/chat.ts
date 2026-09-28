import {z} from "zod";

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
    })
})
export type ChatMessageCreatedEvent=z.infer<typeof ChatMessageCreatedSchema>
