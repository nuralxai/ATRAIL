import { Router, Request, Response } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import { prisma } from "../../db.js";

export const searchRouter = Router();

searchRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  const { q } = req.query;
  const user = (req as any).user;

  if (!q || typeof q !== "string" || q.trim().length < 2) {
    return res.json({ ok: true, results: [] });
  }

  const query = q.trim();
  const orgId = user.organizationId;

  const [tasks, projects, users, notices] = await Promise.all([
    prisma.task.findMany({
      where: {
        title: { contains: query, mode: "insensitive" },
        project: { organizationId: orgId },
      },
      select: { id: true, title: true, status: true, dueAt: true, project: { select: { name: true } } },
      take: 5,
    }),
    prisma.project.findMany({
      where: {
        organizationId: orgId,
        name: { contains: query, mode: "insensitive" },
      },
      select: { id: true, name: true, description: true },
      take: 5,
    }),
    prisma.user.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        fullName: { contains: query, mode: "insensitive" },
      },
      select: { id: true, fullName: true, email: true, role: true },
      take: 5,
    }),
    prisma.notice.findMany({
      where: {
        organizationId: orgId,
        title: { contains: query, mode: "insensitive" },
      },
      select: { id: true, title: true, createdAt: true },
      take: 5,
    }),
  ]);

  return res.json({
    ok: true,
    results: {
      tasks: tasks.map(t => ({ type: "task", id: t.id, title: t.title, subtitle: t.project.name, href: "/tasks", meta: t.status })),
      projects: projects.map(p => ({ type: "project", id: p.id, title: p.name, subtitle: p.description ?? "Project", href: `/projects/${p.id}`, meta: "" })),
      users: users.map(u => ({ type: "user", id: u.id, title: u.fullName, subtitle: u.email, href: "/directory", meta: u.role })),
      notices: notices.map(n => ({ type: "notice", id: n.id, title: n.title, subtitle: new Date(n.createdAt).toLocaleDateString("en-IN"), href: "/notices", meta: "" })),
    },
  });
});
