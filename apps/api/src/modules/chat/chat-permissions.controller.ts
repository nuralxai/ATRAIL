import type { Request, Response, NextFunction } from "express";
import { chatPermissionsService } from "./chat-permissions.service.js";

export const chatPermissionsController = {
  async createRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { adminId } = req.body as any;
      const permission = await chatPermissionsService.createRequest(
        u.id,
        u.orgId,
        adminId
      );
      res.json({ ok: true, permission });
    } catch (e) {
      next(e);
    }
  },

  async listInbox(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const requests = await chatPermissionsService.listInbox(u.id, u.orgId);
      res.json({ ok: true, requests });
    } catch (e) {
      next(e);
    }
  },

  async accept(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { id } = req.params;
      const permission = await chatPermissionsService.accept(u.id, u.orgId, id);
      res.json({ ok: true, permission });
    } catch (e) {
      next(e);
    }
  },

  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { id } = req.params;
      const permission = await chatPermissionsService.reject(u.id, u.orgId, id);
      res.json({ ok: true, permission });
    } catch (e) {
      next(e);
    }
  },

  async block(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { id } = req.params;
      const permission = await chatPermissionsService.block(u.id, u.orgId, id);
      res.json({ ok: true, permission });
    } catch (e) {
      next(e);
    }
  },

  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { adminId } = req.query as any;
      if (!adminId) {
        return res.status(400).json({ ok: false, message: "adminId required" });
      }
      const status = await chatPermissionsService.getPermissionStatus(u.id, adminId);
      res.json({ ok: true, status });
    } catch (e) {
      next(e);
    }
  },
};
