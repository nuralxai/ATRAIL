import type { Request, Response, NextFunction } from "express";
import { chatService } from "./chat.service.js";

export const chatController = {
  async listConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const data = await chatService.listConversations(u.id, u.orgId);
      res.json({ ok: true, conversations: data });
    } catch (e) {
      next(e);
    }
  },

  async getOrCreateDirect(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { toUserId } = req.body as any;
      const convo = await chatService.getOrCreateDirect(
        u.id,
        u.orgId,
        toUserId
      );
      res.json({ ok: true, conversation: convo });
    } catch (e) {
      next(e);
    }
  },

  async getOrCreateProject(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { projectId } = req.body as any;
      const convo = await chatService.getOrCreateProject(
        u.id,
        u.orgId,
        u.role,
        projectId
      );
      res.json({ ok: true, conversation: convo });
    } catch (e) {
      next(e);
    }
  },

  async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { id } = req.params;

      const limit = Math.min(Number(req.query.limit ?? 30), 100);
      const cursor = (req.query.cursor as string | undefined) ?? undefined;

      const data = await chatService.getMessages(u.id, u.orgId, id, {
        limit,
        cursor,
      });
      res.json({ ok: true, ...data });
    } catch (e) {
      next(e);
    }
  },

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { id } = req.params;
      const { body, file } = req.body as any;

      const msg = await chatService.sendMessage(u.id, u.orgId, id, body, file);
      res.json({ ok: true, message: msg });
    } catch (e) {
      next(e);
    }
  },

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { id } = req.params;
      await chatService.markConversationRead(u.id, u.orgId, id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },

  async deleteMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { id } = req.params;
      await chatService.deleteMessage(u.id, u.orgId, id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
};
