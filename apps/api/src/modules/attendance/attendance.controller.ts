import type { Request, Response, NextFunction } from "express";
import { attendanceService } from "./attendance.service.js";

export const attendanceController = {
  async punchIn(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const record = await attendanceService.punchIn(u.id, u.orgId, u.role);
      res.json({ ok: true, attendance: record });
    } catch (e) {
      next(e);
    }
  },

  async punchOut(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const record = await attendanceService.punchOut(u.id, u.orgId, u.role);
      res.json({ ok: true, attendance: record });
    } catch (e) {
      next(e);
    }
  },

  async today(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const data = await attendanceService.today(u.id, u.orgId);
      res.json({ ok: true, today: data });
    } catch (e) {
      next(e);
    }
  },

  async myHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;

      const month = (req.query.month as string | undefined) ?? undefined;
      const from = (req.query.from as string | undefined) ?? undefined;
      const to = (req.query.to as string | undefined) ?? undefined;
      const days = (req.query.days as string | undefined) ?? undefined;

      const data = await attendanceService.myHistory(u.id, u.orgId, {
        month,
        from,
        to,
        days,
      });
      res.json({ ok: true, ...data });
    } catch (e) {
      next(e);
    }
  },

  async adminDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const userId = (req.query.userId as string | undefined) ?? undefined;
      const role = (req.query.role as string | undefined) ?? undefined;
      const from = (req.query.from as string | undefined) ?? undefined;
      const to = (req.query.to as string | undefined) ?? undefined;

      const data = await attendanceService.adminDashboard(
        u.id,
        u.orgId,
        u.role,
        { userId, role, from, to }
      );
      res.json({ ok: true, ...data });
    } catch (e) {
      next(e);
    }
  },
};
