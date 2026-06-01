import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { validateBody } from "../../utils/validate.js";
import { emergencyController } from "./emergency.controller.js";
import { triggerSchema } from "./emergency.schemas.js";

export const emergencyRouter = Router();
emergencyRouter.use(requireAuth);

emergencyRouter.post(
  "/trigger",
  validateBody(triggerSchema),
  emergencyController.trigger
);
emergencyRouter.post("/:id/cancel", emergencyController.cancel);

// All users can see active emergencies
emergencyRouter.get("/active", emergencyController.active);

// Get emergency conversation
emergencyRouter.get("/:id/conversation", emergencyController.getConversation);

// Get emergency event by conversation ID
emergencyRouter.get("/conversation/:conversationId", emergencyController.getByConversationId);

// SuperAdmin resolve
emergencyRouter.post(
  "/:id/resolve",
  requireRole("SUPER_ADMIN"),
  emergencyController.resolve
);
