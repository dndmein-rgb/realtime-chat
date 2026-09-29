import { redis } from "./redis.client.js";
import { hashToken } from "../crypto/token-hash.js";

const ROTATE_REFRESH_TOKEN_SCRIPT = `
  local storedHash = redis.call("GET", KEYS[1])

  if not storedHash then
    return 0
  end

  if storedHash ~= ARGV[1] then
    return 0
  end

  redis.call("DEL", KEYS[1])

  redis.call(
    "SET",
    KEYS[2],
    ARGV[2],
    "EX",
    ARGV[3]
  )

  return 1
`;

const REVOKE_REFRESH_TOKEN_SCRIPT = `
  local storedHash = redis.call("GET", KEYS[1])

  if not storedHash then
    return 0
  end

  if storedHash ~= ARGV[1] then
    return 0
  end

  return redis.call("DEL", KEYS[1])
`;

export class RefreshTokenStore {
  async save(
    jti: string,
    refreshToken: string,
    ttlSeconds: number,
  ) {
    await redis.set(
      this.getKey(jti),
      hashToken(refreshToken),
      "EX",
      ttlSeconds,
    );
  }

  async rotate(
    oldJti: string,
    oldRefreshToken: string,
    newJti: string,
    newRefreshToken: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await redis.eval(
      ROTATE_REFRESH_TOKEN_SCRIPT,
      2,
      this.getKey(oldJti),
      this.getKey(newJti),
      hashToken(oldRefreshToken),
      hashToken(newRefreshToken),
      String(ttlSeconds),
    );

    return result === 1;
  }

  async revoke(
    jti: string,
    refreshToken: string,
  ): Promise<boolean> {
    const result = await redis.eval(
      REVOKE_REFRESH_TOKEN_SCRIPT,
      1,
      this.getKey(jti),
      hashToken(refreshToken),
    );

    return result === 1;
  }

  private getKey(jti: string) {
    return `refresh:${jti}`;
  }
}

export const refreshTokenStore = new RefreshTokenStore();
