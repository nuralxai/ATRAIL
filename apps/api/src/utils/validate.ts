import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";
import { ApiError } from "./errors.js";

export const validateBody = (schema: ZodSchema): RequestHandler => {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(
        new ApiError(400, parsed.error.issues.map((i) => i.message).join(", "))
      );
    }
    req.body = parsed.data;
    next();
  };
};
