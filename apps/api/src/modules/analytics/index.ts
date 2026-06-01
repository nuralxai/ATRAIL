import { Router, Request, Response } from 'express';
import { prisma } from '../../db.js';
import { requireAuth } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/auth.js';

const router = Router();

// GET /analytics/overview
router.get('/overview', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const orgId = user.orgId;

  const [totalProjects, totalTasks, totalUsers, activeEmergencies, pendingLeaves] = await Promise.all([
    prisma.project.count({ where: { organizationId: orgId } }),
    prisma.task.count({ where: { project: { organizationId: orgId } } }),
    prisma.user.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.emergencyEvent.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
    prisma.leaveRequest.count({ where: { user: { organizationId: orgId }, status: 'PENDING' } }),
  ]);

  const tasksByStatus = await prisma.task.groupBy({
    by: ['status'],
    where: { project: { organizationId: orgId } },
    _count: { id: true },
  });

  return res.json({ ok: true, overview: { totalProjects, totalTasks, totalUsers, activeEmergencies, pendingLeaves, tasksByStatus } });
});

// GET /analytics/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  
  const [totalProjects, totalTasks, activeEmergencies] = await Promise.all([
    prisma.project.count({
      where: {
        organizationId: user.orgId,
        members: { some: { id: user.id } }
      }
    }),
    prisma.task.count({ where: { assignedToId: user.id } }),
    prisma.emergencyEvent.count({ where: { organizationId: user.orgId, status: 'ACTIVE' } })
  ]);

  const tasksByStatus = await prisma.task.groupBy({
    by: ['status'],
    where: { assignedToId: user.id },
    _count: { id: true },
  });

  return res.json({ 
    ok: true, 
    overview: { 
      totalProjects, 
      totalTasks, 
      activeEmergencies, 
      tasksByStatus 
    } 
  });
});

// GET /analytics/task-stats
router.get('/task-stats', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const orgId = (req as any).user.orgId;

  const users = await prisma.user.findMany({
    where: { organizationId: orgId, isActive: true },
    select: {
      id: true, fullName: true, role: true,
      tasksAssignedTo: { select: { id: true, status: true, priority: true } },
    },
  });

  const stats = users.map((u) => {
    const total = u.tasksAssignedTo.length;
    const accepted = u.tasksAssignedTo.filter((t) => t.status === 'ACCEPTED').length;
    const rejected = u.tasksAssignedTo.filter((t) => t.status === 'REJECTED').length;
    const inProgress = u.tasksAssignedTo.filter((t) => t.status === 'IN_PROGRESS').length;
    const submitted = u.tasksAssignedTo.filter((t) => t.status === 'SUBMITTED').length;
    return { userId: u.id, fullName: u.fullName, role: u.role, total, accepted, rejected, inProgress, submitted };
  });

  return res.json({ ok: true, stats });
});

// GET /analytics/attendance-summary
router.get('/attendance-summary', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const orgId = (req as any).user.orgId;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const records = await prisma.attendance.findMany({
    where: { date: { gte: startOfMonth }, user: { organizationId: orgId } },
    include: { user: { select: { id: true, fullName: true } } },
  });

  const grouped: Record<string, { fullName: string; days: number; totalHours: number; avgHours: number }> = {};
  for (const r of records) {
    const uid = r.user.id;
    if (!grouped[uid]) grouped[uid] = { fullName: r.user.fullName, days: 0, totalHours: 0, avgHours: 0 };
    grouped[uid].days++;
    if (r.punchInAt && r.punchOutAt) {
      grouped[uid].totalHours += (r.punchOutAt.getTime() - r.punchInAt.getTime()) / 3_600_000;
    }
  }
  Object.values(grouped).forEach((g) => { g.avgHours = g.days > 0 ? +(g.totalHours / g.days).toFixed(2) : 0; });

  return res.json({ ok: true, summary: Object.values(grouped) });
});

export default router;
