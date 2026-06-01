import { Router, Request, Response } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import { prisma } from "../../db.js";

export const milestonesRouter = Router();

// GET /milestones — list for org (optionally filter by project)
milestonesRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { projectId } = req.query;

  const milestones = await prisma.milestone.findMany({
    where: {
      organizationId: user.organizationId,
      ...(projectId ? { projectId: String(projectId) } : {}),
    },
    include: {
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 100,
  });

  return res.json({ ok: true, milestones });
});

// POST /milestones — create
milestonesRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { title, description, dueDate, projectId } = req.body;

  if (!title || !dueDate) {
    return res.status(400).json({ ok: false, message: "title and dueDate are required" });
  }

  const milestone = await prisma.milestone.create({
    data: {
      organizationId: user.organizationId,
      createdById: user.id,
      title,
      description: description || null,
      dueDate: new Date(dueDate),
      projectId: projectId || null,
    },
  });

  return res.json({ ok: true, milestone });
});

// PATCH /milestones/:id — toggle complete or update
milestonesRouter.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { completed, title, description, dueDate } = req.body;

  const milestone = await prisma.milestone.updateMany({
    where: { id: req.params.id, organizationId: user.organizationId },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(dueDate !== undefined ? { dueDate: new Date(dueDate) } : {}),
      ...(completed !== undefined ? { completed, completedAt: completed ? new Date() : null } : {}),
    },
  });

  return res.json({ ok: true, milestone });
});

// DELETE /milestones/:id
milestonesRouter.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  await prisma.milestone.deleteMany({
    where: { id: req.params.id, organizationId: user.organizationId },
  });
  return res.json({ ok: true });
});
