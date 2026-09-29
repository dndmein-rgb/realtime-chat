import { ConflictError, UnauthorizedError } from "@realtime-chat/shared-utils";
import { AuthInterface } from "./auth.interface.js";
import { LoginUserInput, RegisterUserInput } from "./auth.schema.js";
import { comparePassword, hashPassword } from "./auth.utils.js";
import { logger } from "../../config/logger.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "./auth.token.utils.js";
import { config } from "../../config/index.js";
import { refreshTokenStore } from "../../infrastructure/redis/refresh-token.store.js";


export class AuthService{
  constructor(private readonly authRepo: AuthInterface) { }

  async register(data: RegisterUserInput) {
    const {email,firstName,lastName,password } = data;
    const existing = await this.authRepo.findByEmail(email);
    if (existing) {
          throw new ConflictError("Email already registered");
    }
    const passwordHash = await hashPassword(password);
    const user = await this.authRepo.create({
      email,
      firstName,
      lastName,
      passwordHash

    })
    logger.info({ userId: user.id, email: user.email },"User registered");
    return user;
  }

  async login(data: LoginUserInput) {
    const { email, password } = data;
    const user = await this.authRepo.findByEmail(email)
    if (!user) {
        throw new UnauthorizedError("Invalid email or password");
    }
    const isPasswordValid = await comparePassword(password, user.passwordHash)
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const accessToken = generateAccessToken(user.id);
    const {token:refreshToken,jti} = generateRefreshToken(user.id);
    await refreshTokenStore.save(jti,refreshToken,config.REFRESH_TOKEN_TTL_SECONDS)
    const { passwordHash: _passwordHash, ...safeUser } = user
    logger.info({ userId: user.id },"User logged in" );
    return {
       user: safeUser,
       accessToken,
       refreshToken,
     };
  }

  async refresh(refreshToken: string) {
    let payload: ReturnType<typeof verifyRefreshToken>;
    try {
      payload=verifyRefreshToken(refreshToken)
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

      const {token:newRefreshToken,jti:newJti} = generateRefreshToken(payload.userId);

    const rotated = await refreshTokenStore.rotate(payload.jti, refreshToken, newJti, newRefreshToken, config.REFRESH_TOKEN_TTL_SECONDS)
    if (!rotated) {
         throw new UnauthorizedError(
           "Invalid or expired refresh token",
         );
       }
       const accessToken = generateAccessToken(
             payload.userId,
           );

       logger.info( {
             userId: payload.userId,
             oldJti: payload.jti,
             newJti,
           },"Refresh token rotated");

    return {
       accessToken,
       refreshToken: newRefreshToken,
     };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) {
      return;
    }
  
    let payload: ReturnType<typeof verifyRefreshToken>;
  
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      // Invalid/expired token needs nothing to revoke.
      return;
    }
  
    await refreshTokenStore.revoke(
      payload.jti,
      refreshToken,
    );
  
    logger.info({
      userId: payload.userId,
    },"User logged out" );
  }

  async me(userId: string) {
    const user = await this.authRepo.findById(userId);
    
        if (!user) {
          throw new UnauthorizedError("User no longer exists");
        }
    
        return user;
  }
}
