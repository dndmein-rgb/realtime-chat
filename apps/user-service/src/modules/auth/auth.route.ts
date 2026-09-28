import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware.js";
import { registerUserSchema } from "./auth.schema.js";
import { register } from "./auth.controller.js";


const router = Router();

router.post("/register", validate(registerUserSchema), register);

export default router;
