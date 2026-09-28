import { CreateUserData, SafeUser } from "./auth.types.js";

export interface AuthInterface{
  create(data: CreateUserData): Promise<SafeUser>
  findByEmail(email: string): Promise<(SafeUser & { passwordHash: string }) | null>;
    findById(id: string): Promise<SafeUser | null>;
}