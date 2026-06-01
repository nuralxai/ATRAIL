import type { Request, Response, NextFunction } from "express";
import { usersService } from "./users.service.js";

export const usersController = {
  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const user = await usersService.createUser(req.body, u.orgId);
      res.status(201).json({ ok: true, user });
    } catch (e) {
      next(e);
    }
  },
  async listMessagable(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const users = await usersService.listMessagable(u.id, u.orgId);
      res.json({ ok: true, users });
    } catch (e) {
      next(e);
    }
  },

  async listAll(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const users = await usersService.listAll(u.orgId);
      res.json({ ok: true, users });
    } catch (e) {
      next(e);
    }
  },

  async listPending(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const users = await usersService.listPending(u.orgId);
      res.json({ ok: true, users });
    } catch (e) {
      next(e);
    }
  },

  async approveUser(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { userId } = req.params;
      const { role } = req.body;
      await usersService.approveUser(userId, u.orgId, role, u.role);
      res.json({ ok: true, message: "User approved successfully" });
    } catch (e) {
      next(e);
    }
  },

  async listOrgDirectory(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const data = await usersService.listOrgDirectory(u.orgId);
      res.json({ ok: true, ...data });
    } catch (e) {
      next(e);
    }
  },

  async changeRole(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { userId } = req.params;
      const { role } = req.body;
      if (!role) return res.status(400).json({ ok: false, message: "role is required" });
      
      const result = await usersService.changeRole(u.id, u.role, userId, role, u.orgId);
      res.json({ ok: true, user: result, message: "User role updated successfully" });
    } catch (e) {
      next(e);
    }
  },

  async assignReportsTo(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { userId } = req.params;
      const { reportsToId } = req.body;
      if (!reportsToId) {
        res.status(400).json({ ok: false, message: "reportsToId is required" });
        return;
      }
      const result = await usersService.assignReportsTo(u.id, userId, reportsToId, u.orgId);
      res.json({ ok: true, user: result });
    } catch (e) {
      next(e);
    }
  },

  async updateFcmToken(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { token } = req.body;
      if (!token) return res.status(400).json({ ok: false, message: "token is required" });
      await usersService.updateFcmToken(u.id, token);
      res.json({ ok: true, message: "FCM token updated" });
    } catch (e) {
      next(e);
    }
  },

  async updateExternalReminders(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") return res.status(400).json({ ok: false, message: "enabled must be boolean" });
      await usersService.updateExternalReminders(u.id, enabled);
      res.json({ ok: true, message: "External reminders updated" });
    } catch (e) {
      next(e);
    }
  },

  async getMyProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const result = await usersService.getMyProfile(u.id);
      res.json({ ok: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  async updateMyProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const result = await usersService.updateMyProfile(u.id, req.body);
      res.json({ ok: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  async listManagers(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const managers = await usersService.listManagers(u.id, u.orgId);
      res.json({ ok: true, managers });
    } catch (e) {
      next(e);
    }
  },
};

