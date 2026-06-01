import type { Request, Response, NextFunction } from "express";
import { calendarService } from "./calendar.service.js";

export const calendarController = {
  async getEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { projectId } = req.query;
      const result = await calendarService.listEvents(
        u.id,
        u.organizationId,
        projectId as string
      );
      res.json({ ok: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  async createEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const event = await calendarService.createEvent(
        u.id,
        u.organizationId,
        req.body
      );
      res.status(201).json({ ok: true, event });
    } catch (e) {
      next(e);
    }
  },

  async createRecurringTask(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const recurring = await calendarService.createRecurringTask(
        u.id,
        u.organizationId,
        req.body
      );
      res.status(201).json({ ok: true, recurring });
    } catch (e) {
      next(e);
    }
  },

  async syncTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const generated = await calendarService.syncRecurringTasks(u.organizationId);
      res.json({ ok: true, generatedCount: generated.length, tasks: generated });
    } catch (e) {
      next(e);
    }
  }
};
