import type { Request, Response, NextFunction } from "express";
import { projectsService } from "./projects.service.js";

export const projectsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const projects = await projectsService.list(u.id, u.orgId, u.role);
      res.json({ ok: true, projects });
    } catch (e) {
      next(e);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const project = await projectsService.getOne(
        u.id,
        u.orgId,
        u.role,
        req.params.id
      );
      res.json({ ok: true, project });
    } catch (e) {
      next(e);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const project = await projectsService.create(u.id, u.orgId, u.role, req.body);
      res.json({ ok: true, project });
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const project = await projectsService.update(
        u.id,
        u.orgId,
        u.role,
        req.params.id,
        req.body
      );
      res.json({ ok: true, project });
    } catch (e) {
      next(e);
    }
  },

  async setHead(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const project = await projectsService.setHead(
        u.id,
        u.orgId,
        u.role,
        req.params.id,
        req.body.headId
      );
      res.json({ ok: true, project });
    } catch (e) {
      next(e);
    }
  },

  async assignAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const project = await projectsService.assignAdmin(
        u.id,
        u.orgId,
        u.role,
        req.params.id,
        req.body.adminId
      );
      res.json({ ok: true, project });
    } catch (e) {
      next(e);
    }
  },

  async assignElite(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const project = await projectsService.assignElite(
        u.id,
        u.orgId,
        u.role,
        req.params.id,
        req.body.eliteId
      );
      res.json({ ok: true, project });
    } catch (e) {
      next(e);
    }
  },

  async listMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const members = await projectsService.listMembers(
        u.id,
        u.orgId,
        u.role,
        req.params.id
      );
      res.json({ ok: true, members });
    } catch (e) {
      next(e);
    }
  },

  async addMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const result = await projectsService.addMembers(
        u.id,
        u.orgId,
        u.role,
        req.params.id,
        req.body.userIds
      );
      res.json({ ok: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const result = await projectsService.removeMember(
        u.id,
        u.orgId,
        u.role,
        req.params.id,
        req.params.userId
      );
      res.json({ ok: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  async deleteProject(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const result = await projectsService.deleteProject(
        u.id,
        u.orgId,
        u.role,
        req.params.id
      );
      res.json({ ok: true, ...result });
    } catch (e) {
      next(e);
    }
  },
};
