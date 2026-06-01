import type { Request, Response, NextFunction } from "express";
import { notificationsService } from "./notifications.service.js";

export const notificationsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const unreadOnly = req.query.unreadOnly === "true";
      const notifications = await notificationsService.list(
        u.id,
        u.orgId,
        unreadOnly
      );
      res.json({ ok: true, notifications });
    } catch (e) {
      next(e);
    }
  },

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { id } = req.params;
      const result = await notificationsService.markRead(u.id, u.orgId, id);
      if (result.count === 0) {
        return res.status(404).json({ ok: false, message: "Notification not found" });
      }
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      await notificationsService.markAllRead(u.id, u.orgId);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
};
