import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import { notificationsController } from "./notifications.controller.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get("/", notificationsController.list);
notificationsRouter.post("/:id/read", notificationsController.markRead);
notificationsRouter.post("/read-all", notificationsController.markAllRead);
