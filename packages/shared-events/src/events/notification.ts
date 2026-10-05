import { z } from "zod";

export const NotificationCreatedSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("notification.created"),
  occurredAt: z.string().datetime(),
  data: z.object({
    notificationId: z.string().uuid(),
    userId: z.string().uuid(),
    roomId: z.string().uuid(),
    senderId: z.string().uuid(),
    content: z.string(),
    createdAt: z.string().datetime(),
    messageId: z.string().uuid(),
  }),
});

export type NotificationCreatedEvent = z.infer<
  typeof NotificationCreatedSchema
>;
