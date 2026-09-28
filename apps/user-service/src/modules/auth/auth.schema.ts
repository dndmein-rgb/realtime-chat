import { z } from 'zod';

export const registerUserSchema = z.object({
  email: z.string().email("Invalid email").trim().toLowerCase(),
  password:z.string().min(8,"Password must be atleast 8 characters long").max(72, "Password too long"),
    firstName: z.string().min(1, "First name is required").max(50),
    lastName: z.string().min(1, "Last name is required").max(50),
})
export type RegisterUserInput=z.infer<typeof registerUserSchema>
