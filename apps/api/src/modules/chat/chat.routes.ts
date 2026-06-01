import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import { validateBody } from "../../utils/validate.js";
import { z } from "zod";
import { chatController } from "./chat.controller.js";
import { chatPermissionsController } from "./chat-permissions.controller.js";

export const chatRouter = Router();

const directSchema = z.object({ toUserId: z.string().min(1) });
const projectSchema = z.object({ projectId: z.string().min(1) });
const sendSchema = z.object({ 
  body: z.string().max(2000).optional(),
  file: z.object({ url: z.string(), name: z.string(), type: z.string() }).optional()
}).refine(data => data.body || data.file, { message: "Message body or file required" });
const requestSchema = z.object({ adminId: z.string().min(1) });

chatRouter.use(requireAuth);

chatRouter.get("/conversations", chatController.listConversations);
chatRouter.post(
  "/direct",
  validateBody(directSchema),
  chatController.getOrCreateDirect
);
chatRouter.post(
  "/project",
  validateBody(projectSchema),
  chatController.getOrCreateProject
);

chatRouter.get("/conversations/:id/messages", chatController.getMessages);
chatRouter.post(
  "/conversations/:id/messages",
  validateBody(sendSchema),
  chatController.sendMessage
);
chatRouter.post("/conversations/:id/read", chatController.markAsRead);
chatRouter.delete("/messages/:id", chatController.deleteMessage);

// Chat permission requests
chatRouter.post(
  "/requests",
  validateBody(requestSchema),
  chatPermissionsController.createRequest
);
chatRouter.get("/requests/inbox", chatPermissionsController.listInbox);
chatRouter.get("/requests/status", chatPermissionsController.getStatus);
chatRouter.post("/requests/:id/accept", chatPermissionsController.accept);
chatRouter.post("/requests/:id/reject", chatPermissionsController.reject);
chatRouter.post("/requests/:id/block", chatPermissionsController.block);
