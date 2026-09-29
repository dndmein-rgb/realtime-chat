import jwt,{type SignOptions } from "jsonwebtoken";
import { config } from "../../config/index.js";
import {  randomUUID } from "node:crypto";

type TokenPayload = {
  userId:  string;
  jti: string

}

const accessOptions: SignOptions = {
  algorithm: "HS256",
  expiresIn: config.ACCESS_TOKEN_EXP as SignOptions["expiresIn"],
  issuer: "realtime-chat",
  audience:"realtime-chat-api"
}

const refreshOptions: SignOptions = {
  algorithm: "HS256",
  expiresIn: config.REFRESH_TOKEN_EXP as SignOptions["expiresIn"],
  issuer: "realtime-chat",
  audience: "realtime-chat-api",
};

export const generateAccessToken=(userId:string):string=> {
  return jwt.sign({userId},config.JWT_ACCESS_SECRET,{...accessOptions,subject:userId})
  }

export const generateRefreshToken = (
  userId: string,
  jti = randomUUID(),
): { token: string; jti: string } => {
  const token= jwt.sign(
    { userId },
    config.JWT_REFRESH_SECRET,
    {
      ...refreshOptions,
      subject: userId,
      jwtid: jti,
    },
  );
  return {token,jti}
};
export const verifyAccessToken = (token:string):string => {
  const payload = jwt.verify(token, config.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
      issuer: "realtime-chat",
      audience: "realtime-chat-api",
    });
  
    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string"
    ) {
      throw new Error("Invalid access token payload");
    }
  
    return payload.sub;

}

export const verifyRefreshToken = (token: string): TokenPayload => {
  const payload = jwt.verify(token, config.JWT_REFRESH_SECRET, {
    algorithms: ["HS256"],
    issuer: "realtime-chat",
    audience: "realtime-chat-api",
  });

  if (
    typeof payload === "string" ||
    typeof payload.sub !== "string" ||
    typeof payload.jti !== "string"
  ) {
    throw new Error("Invalid refresh token payload");
  }

  return {
    userId: payload.sub,
    jti: payload.jti,
  };
};

