import type { Request, Response } from "express";
import { asyncHandler, UnauthorizedError } from "@realtime-chat/shared-utils";
import { authService } from "./auth.container.js";
import { config } from "../../config/index.js";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.register(req.body);

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: user,
  });
})

const refreshCookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/auth",
  maxAge: config.REFRESH_TOKEN_TTL_SECONDS * 1000,
};
export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
 res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);
  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
          user: result.user,
          accessToken: result.accessToken,
        },
  });
});


export const refresh = asyncHandler(async (req:Request,res:Response) => {
  const refreshToken = req.cookies?.refreshToken;
 
   if (!refreshToken) {
     throw new UnauthorizedError("Refresh token is required");
   }
 
   const result = await authService.refresh(refreshToken);
 
   res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);
 
   res.status(200).json({
     success: true,
     message: "Token refreshed",
     data: {
       accessToken: result.accessToken,
     },
   });
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  await authService.logout(refreshToken);

  res.clearCookie(
    "refreshToken",
    refreshCookieOptions,
  );

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

export const me = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new UnauthorizedError(
        "Authentication required",
      );
    }

    const user = await authService.me(
      req.user.userId,
    );

    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user,
    });
  },
);
