import { ConflictError } from "@realtime-chat/shared-utils";
import { AuthInterface } from "./auth.interface.js";
import { RegisterUserInput } from "./auth.schema.js";
import { hashPassword } from "./auth.utils.js";
import { logger } from "../../config/logger.js";


export class AuthService{
  constructor(private readonly authrepo: AuthInterface) { }

  async register(data: RegisterUserInput) {
    const {email,firstName,lastName,password } = data;
    const existing = await this.authrepo.findByEmail(email);
    if (existing) {
          throw new ConflictError("Email already registered");
    }
    const passwordHash = await hashPassword(password);
    const user = await this.authrepo.create({
      email,
      firstName,
      lastName,
      passwordHash

    })
    logger.info("User registered", { userId: user.id, email: user.email });
    return user;
  }
}
