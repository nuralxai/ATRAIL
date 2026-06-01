import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { validateBody } from "../../utils/validate.js";
import { noticesController } from "./notices.controller.js";
import { createNoticeSchema, pinSchema } from "./notices.schemas.js";

export const noticesRouter = Router();
noticesRouter.use(requireAuth);

noticesRouter.get("/", noticesController.list);
noticesRouter.post(
  "/",
  requireRole("ADMIN", "SUPER_ADMIN"),
  validateBody(createNoticeSchema),
  noticesController.create
);
noticesRouter.post("/:id/seen", noticesController.markSeen);
noticesRouter.patch(
  "/:id/pin",
  requireRole("ADMIN", "SUPER_ADMIN"),
  validateBody(pinSchema),
  noticesController.pin
);
