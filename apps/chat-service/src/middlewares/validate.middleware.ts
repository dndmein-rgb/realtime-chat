import { BadRequestError } from "@realtime-chat/shared-utils";
import type{Request,Response, NextFunction } from "express";
import type{ ZodSchema } from "zod";

export const validate = (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction):void => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
        const message = result.error.errors
          .map((e) => e.message)
          .join(", ");
        return next(new BadRequestError(message));
  }

  req.body = result.data;
      next();
}