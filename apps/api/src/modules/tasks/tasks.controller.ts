import type { Request, Response, NextFunction } from "express";
import { tasksService } from "./tasks.service.js";

export const tasksController = {
  async myTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const data = await tasksService.myTasks(u.id, u.orgId);
      res.json({ ok: true, ...data });
    } catch (e) {
      next(e);
    }
  },

  async projectTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { projectId } = req.params;
      const data = await tasksService.projectTasks(
        u.id,
        u.orgId,
        u.role,
        projectId
      );
      res.json({ ok: true, ...data });
    } catch (e) {
      next(e);
    }
  },

  async getTask(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { taskId } = req.params;
      const data = await tasksService.getTask(u.id, u.orgId, u.role, taskId);
      res.json({ ok: true, task: data });
    } catch (e) {
      next(e);
    }
  },

  async createTask(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const task = await tasksService.createTask(
        u.id,
        u.orgId,
        u.role,
        req.body
      );
      res.json({ ok: true, task });
    } catch (e) {
      next(e);
    }
  },

  async setMyStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { taskId } = req.params;
      const task = await tasksService.setMyStatus(
        u.id,
        u.orgId,
        taskId,
        req.body.status
      );
      res.json({ ok: true, task });
    } catch (e) {
      next(e);
    }
  },

  async submitTask(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { taskId } = req.params;
      const files = (req.files as Express.Multer.File[]) ?? [];
      const submission = await tasksService.submitTask(
        u.id,
        u.orgId,
        taskId,
        req.body.notes,
        files
      );
      res.json({ ok: true, submission });
    } catch (e) {
      next(e);
    }
  },

  async reviewSubmission(req: Request, res: Response, next: NextFunction) {
    try {
      const u = (req as any).user;
      const { submissionId } = req.params;
      const out = await tasksService.reviewSubmission(
        u.id,
        u.orgId,
        u.role,
        submissionId,
        req.body.decision,
        req.body.comment
      );
      res.json({ ok: true, ...out });
    } catch (e) {
      next(e);
    }
  },
};
