import express from "express";
import { validate } from "../../middlewares/validate.middleware.js";
import { loginUserSchema, registerUserSchema } from "./auth.schema.js";
import { login, logout, me, refresh, register } from "./auth.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { loginRateLimiter, refreshTokenRateLimiter, registerRateLimiter } from "../../middlewares/rate-limit.js";


const router = express.Router();

router.post("/register",registerRateLimiter, validate(registerUserSchema), register);
router.post("/login",loginRateLimiter, validate(loginUserSchema), login);
router.post("/refresh",refreshTokenRateLimiter, refresh);
router.post("/logout", logout);
router.get(
  "/me",
  authenticate,
  me,
);

export default router;
