import type { Request, Response, NextFunction } from "express";
import { emergencyService } from "./emergency.service.js";

export const emergencyController = {
  async trigger(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const event = await emergencyService.trigger(u.id, u.orgId, req.body);
      res.json({ ok: true, event });
    } catch (e) {
      next(e);
    }
  },

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const event = await emergencyService.cancel(u.id, u.orgId, req.params.id);
      res.json({ ok: true, event });
    } catch (e) {
      next(e);
    }
  },

  async active(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const events = await emergencyService.active(u.orgId);
      res.json({ ok: true, events });
    } catch (e) {
      next(e);
    }
  },

  async getConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const conversation = await emergencyService.getEmergencyConversation(
        u.orgId,
        req.params.id
      );
      res.json({ ok: true, conversation });
    } catch (e) {
      next(e);
    }
  },

  async getByConversationId(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const event = await emergencyService.getEmergencyByConversationId(
        u.orgId,
        req.params.conversationId
      );
      res.json({ ok: true, event });
    } catch (e) {
      next(e);
    }
  },

  async resolve(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const event = await emergencyService.resolve(
        u.id,
        u.orgId,
        req.params.id
      );
      res.json({ ok: true, event });
    } catch (e) {
      next(e);
    }
  },
};
