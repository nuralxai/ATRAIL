import type { Request, Response, NextFunction } from "express";
import { noticesService } from "./notices.service.js";

export const noticesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const data = await noticesService.list(u.id, u.orgId);
      res.json({ ok: true, notices: data });
    } catch (e) {
      next(e);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const notice = await noticesService.create(u.id, u.orgId, req.body);
      res.json({ ok: true, notice });
    } catch (e) {
      next(e);
    }
  },

  async markSeen(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      await noticesService.markSeen(u.id, u.orgId, req.params.id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },

  async pin(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const notice = await noticesService.pin(
        u.orgId,
        req.params.id,
        req.body.pinned
      );
      res.json({ ok: true, notice });
    } catch (e) {
      next(e);
    }
  },
};
