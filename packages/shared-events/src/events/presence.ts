import {z} from "zod";

export const PresenceUserOnlineSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("presence.user.online"),
  occurredAt: z.string().datetime(),
  data: z.object({
    userId: z.string().uuid(),
        connectedAt: z.string().datetime(),
  })
})

export const PresenceUserOfflineSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("presence.user.offline"),
  occurredAt: z.string().datetime(),
  data: z.object({
    userId: z.string().uuid(),
    disconnectedAt: z.string().datetime(),
  }),
});

export type PresenceUserOnlineEvent = z.infer<typeof PresenceUserOnlineSchema>;
export type PresenceUserOfflineEvent = z.infer<typeof PresenceUserOfflineSchema>;