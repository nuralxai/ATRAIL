import { Router, Request, Response } from 'express';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { auditAction } from '../../lib/audit.js';

const router = Router();

// POST /tasks/:id/subtasks — Elite/Admin creates a sub-task
router.post('/:id/subtasks', requireAuth, requireRole('ELITE', 'ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const creator = (req as any).user;
  const { title, description, assignedToId, dueAt } = req.body;

  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) return res.status(404).json({ ok: false, message: 'Task not found' });

  const subTask = await prisma.subTask.create({
    data: {
      taskId: task.id,
      assignedToId,
      createdById: creator.id,
      title,
      description,
      dueAt: dueAt ? new Date(dueAt) : null,
    },
    include: { assignedTo: { select: { id: true, fullName: true } } },
  });

  await auditAction(creator.id, 'TASK_CREATED', 'SubTask', subTask.id, { parentTaskId: task.id, title });
  return res.json({ ok: true, subTask });
});

// GET /tasks/:id/subtasks
router.get('/:id/subtasks', requireAuth, async (req: Request, res: Response) => {
  const subTasks = await prisma.subTask.findMany({
    where: { taskId: req.params.id },
    include: {
      assignedTo: { select: { id: true, fullName: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return res.json({ ok: true, subTasks });
});

// PATCH /tasks/subtasks/:subTaskId
router.patch('/subtasks/:subTaskId', requireAuth, async (req: Request, res: Response) => {
  const { status } = req.body;
  const subTask = await prisma.subTask.update({
    where: { id: req.params.subTaskId },
    data: { status, ...(status === 'ACCEPTED' ? { completedAt: new Date() } : {}) },
  });
  return res.json({ ok: true, subTask });
});

// POST /tasks/:id/split — Elite splits task by cloning it to another user
router.post('/:id/split', requireAuth, requireRole('ELITE', 'ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const creator = (req as any).user;
  const { assignedToId, title, description, dueAt } = req.body;

  const original = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!original) return res.status(404).json({ ok: false, message: 'Task not found' });

  const splitTask = await prisma.task.create({
    data: {
      projectId: original.projectId,
      title: title || `[Split] ${original.title}`,
      description: description || original.description,
      assignedToId,
      assignedById: creator.id,
      dueAt: dueAt ? new Date(dueAt) : original.dueAt,
      priority: original.priority,
      splitFromId: original.id,
    },
  });

  await auditAction(creator.id, 'TASK_SPLIT', 'Task', splitTask.id, { originalTaskId: original.id, assignedToId });
  return res.json({ ok: true, task: splitTask });
});

// POST /tasks/:id/comments
router.post('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const orgId = (req as any).user.orgId;
  const { content, mentionedUserIds } = req.body;

  const comment = await prisma.taskComment.create({
    data: { taskId: req.params.id, userId, content, mentionedUserIds: mentionedUserIds || [] },
    include: { user: { select: { id: true, fullName: true } } },
  });

  if (mentionedUserIds?.length) {
    await Promise.all(
      mentionedUserIds.map((uid: string) =>
        prisma.notification.create({
          data: {
            organizationId: orgId,
            userId: uid,
            type: 'MENTION',
            title: 'You were mentioned in a task comment',
            message: content.substring(0, 100),
            taskId: req.params.id,
          },
        })
      )
    );
  }

  return res.json({ ok: true, comment });
});

// GET /tasks/:id/comments
router.get('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  const comments = await prisma.taskComment.findMany({
    where: { taskId: req.params.id },
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return res.json({ ok: true, comments });
});

export { router as taskExtensionsRouter };
