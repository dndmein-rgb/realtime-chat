import { z } from "zod"

export const createRoomSchema = z.discriminatedUnion("type", [z.object({
  type: z.literal("PRIVATE"),
  otherUserId:z.string().uuid("Invalid otherUserId")
}),
  z.object({
    type: z.literal("GROUP"),
    name: z.string().min(1, "Name is required").max(100),
      memberIds:z.array(z.string().uuid()).max(50).optional().default([])
})
])
export const addMemberSchema = z.object({
  userId: z.string().uuid("Invalid userId"),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
