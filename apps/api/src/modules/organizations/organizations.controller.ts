import { Request, Response } from "express";
import { prisma } from "../../db.js";
import { z } from "zod";

export const organizationsController = {
  async list(req: Request, res: Response) {
    try {
      const orgs = await prisma.organization.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { users: true, projects: true },
          },
        },
      });
      res.json({ ok: true, organizations: orgs });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const schema = z.object({
        name: z.string().min(2),
      });
      const parsed = schema.parse(req.body);

      const existing = await prisma.organization.findUnique({
        where: { name: parsed.name },
      });

      if (existing) {
        return res.status(400).json({ ok: false, message: "Organization already exists" });
      }

      const org = await prisma.organization.create({
        data: { name: parsed.name },
      });

      res.status(201).json({ ok: true, organization: org });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ ok: false, message: "Invalid input" });
      } else {
        res.status(500).json({ ok: false, message: err.message });
      }
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const schema = z.object({
        name: z.string().min(2).optional(),
        logoUrl: z.string().url().optional().nullable(),
      });
      const parsed = schema.parse(req.body);

      const org = await prisma.organization.update({
        where: { id },
        data: parsed,
      });

      res.json({ ok: true, organization: org });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ ok: false, message: "Invalid input" });
      } else {
        res.status(500).json({ ok: false, message: err.message });
      }
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Prevent deleting the organization if there are users other than possible seed users or depending on strictness
      const usersCount = await prisma.user.count({ where: { organizationId: id } });
      if (usersCount > 0) {
        return res.status(400).json({ ok: false, message: "Cannot delete organization with active users. Please remove them first." });
      }

      await prisma.organization.delete({
        where: { id },
      });

      res.json({ ok: true, deleted: true });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  },
};
