import { prisma } from "../../infrastructure/prisma.js";
import { AuthInterface } from "./auth.interface.js";
import { CreateUserData, SafeUser } from "./auth.types.js";


export class AuthRepository implements AuthInterface{
  async create(data: CreateUserData): Promise<SafeUser> {
    return prisma.user.create({
      data,
      select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              createdAt: true,
            },
    })
  }
  async findByEmail(email: string): Promise<(SafeUser & { passwordHash: string; }) | null> {
    return await prisma.user.findUnique({
      where: { email },
      select: {
              id: true,
              email: true,
              passwordHash: true,
              firstName: true,
              lastName: true,
              createdAt: true,
            },
    })
  }
  async findById(id: string): Promise<SafeUser | null> {
      return prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
        },
      });
    }
}