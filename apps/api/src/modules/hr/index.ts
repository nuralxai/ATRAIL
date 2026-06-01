import { Router, Request, Response } from 'express';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

const router = Router();

// GET /hr/profile/:userId
router.get('/profile/:userId', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, fullName: true, email: true, role: true,
      profile: true,
      reportsTo: { select: { id: true, fullName: true, role: true } },
    },
  });
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
  return res.json({ ok: true, user });
});

// PATCH /hr/profile/:userId
router.patch('/profile/:userId', requireAuth, async (req: Request, res: Response) => {
  const requestor = (req as any).user;
  const { userId } = req.params;
  if (requestor.id !== userId && !['ADMIN', 'SUPER_ADMIN'].includes(requestor.role)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }
  const { department, phone, avatarUrl, joinDate, bio } = req.body;
  const profile = await prisma.userProfile.upsert({
    where: { userId },
    update: { department, phone, avatarUrl, joinDate: joinDate ? new Date(joinDate) : undefined, bio },
    create: { userId, department, phone, avatarUrl, joinDate: joinDate ? new Date(joinDate) : undefined, bio },
  });
  return res.json({ ok: true, profile });
});

// GET /hr/employees
router.get('/employees', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const orgId = (req as any).user.orgId;
  const employees = await prisma.user.findMany({
    where: { organizationId: orgId, isActive: true },
    select: {
      id: true, fullName: true, email: true, role: true,
      profile: true,
      reportsTo: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return res.json({ ok: true, employees });
});

// POST /hr/leave
router.post('/leave', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { type, fromDate, toDate, reason } = req.body;
  const leave = await prisma.leaveRequest.create({
    data: { userId, type, fromDate: new Date(fromDate), toDate: new Date(toDate), reason },
  });
  return res.json({ ok: true, leave });
});

// GET /hr/leave
router.get('/leave', requireAuth, async (req: Request, res: Response) => {
  const requestor = (req as any).user;
  const isManager = ['ADMIN', 'SUPER_ADMIN'].includes(requestor.role);
  const leaves = await prisma.leaveRequest.findMany({
    where: isManager ? { user: { organizationId: requestor.orgId } } : { userId: requestor.id },
    include: { user: { select: { id: true, fullName: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ ok: true, leaves });
});

// PATCH /hr/leave/:id
router.patch('/leave/:id', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const { status, reviewNote } = req.body;
  const leave = await prisma.leaveRequest.update({
    where: { id: req.params.id },
    data: { status, reviewedById: (req as any).user.id, reviewedAt: new Date(), reviewNote },
  });
  return res.json({ ok: true, leave });
});

// GET /hr/orgchart
router.get('/orgchart', requireAuth, async (req: Request, res: Response) => {
  const orgId = (req as any).user.orgId;
  const users = await prisma.user.findMany({
    where: { organizationId: orgId, isActive: true },
    select: {
      id: true, fullName: true, role: true, reportsToId: true,
      profile: { select: { avatarUrl: true, department: true } },
    },
  });
  return res.json({ ok: true, users });
});

// GET /hr/skills
router.get('/skills', requireAuth, async (req: Request, res: Response) => {
  const orgId = (req as any).user.orgId;
  const skills = await prisma.skill.findMany({
    where: { organizationId: orgId },
    orderBy: { name: 'asc' }, // usually sorting by name is better if category is optional
  });
  return res.json({ ok: true, skills });
});

// POST /hr/skills
router.post('/skills', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const orgId = (req as any).user.orgId;
  const { name, category } = req.body;
  if (!name) return res.status(400).json({ ok: false, message: 'Skill name is required' });
  
  try {
    const skill = await prisma.skill.create({
      data: { organizationId: orgId, name, category },
    });
    return res.json({ ok: true, skill });
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(400).json({ ok: false, message: 'Skill already exists' });
    throw error;
  }
});

// GET /hr/user-skills
router.get('/user-skills', requireAuth, async (req: Request, res: Response) => {
  const orgId = (req as any).user.orgId;
  const userSkills = await prisma.userSkill.findMany({
    where: { user: { organizationId: orgId, isActive: true } },
    include: {
      skill: true,
      user: { select: { id: true, fullName: true, profile: { select: { department: true } } } }
    },
  });
  return res.json({ ok: true, userSkills });
});

// POST /hr/user-skills
router.post('/user-skills', requireAuth, async (req: Request, res: Response) => {
  const requestor = (req as any).user;
  const { userId, skillId, proficiencyLevel } = req.body;
  
  // Only the user or an ADMIN can update skills
  if (requestor.id !== userId && !['ADMIN', 'SUPER_ADMIN'].includes(requestor.role)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const level = Math.max(1, Math.min(5, Number(proficiencyLevel) || 1));

  const userSkill = await prisma.userSkill.upsert({
    where: { userId_skillId: { userId, skillId } },
    update: { proficiencyLevel: level },
    create: { userId, skillId, proficiencyLevel: level },
    include: { skill: true }
  });
  return res.json({ ok: true, userSkill });
});

// ──────── ONBOARDING ────────

// GET /hr/onboarding
router.get('/onboarding', requireAuth, async (req: Request, res: Response) => {
  const requestor = (req as any).user;
  const orgId = requestor.orgId;
  
  // Get all steps applicable to user
  const steps = await prisma.onboardingStep.findMany({
    where: { 
      organizationId: orgId,
      OR: [
        { roleRequirement: null },
        { roleRequirement: requestor.role }
      ]
    },
  });

  const progress = await prisma.userOnboardingProgress.findMany({
    where: { userId: requestor.id },
  });

  return res.json({ ok: true, steps, progress });
});

// POST /hr/onboarding
router.post('/onboarding', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), async (req: Request, res: Response) => {
  const orgId = (req as any).user.orgId;
  const { title, description, roleRequirement } = req.body;
  if (!title) return res.status(400).json({ ok: false, message: 'Title required' });

  const step = await prisma.onboardingStep.create({
    data: { organizationId: orgId, title, description, roleRequirement },
  });
  return res.json({ ok: true, step });
});

// PATCH /hr/onboarding/:stepId/complete
router.patch('/onboarding/:stepId/complete', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { stepId } = req.params;
  const { completed } = req.body; // boolean

  const progress = await prisma.userOnboardingProgress.upsert({
    where: { userId_stepId: { userId, stepId } },
    update: { completed, completedAt: completed ? new Date() : null },
    create: { userId, stepId, completed: true, completedAt: new Date() },
  });
  return res.json({ ok: true, progress });
});

// ──────── OBJECTIVES & KEY RESULTS (OKRs) ────────

// GET /hr/okrs
router.get('/okrs', requireAuth, async (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;
  const orgId = (req as any).user.orgId;

  // If userId is provided, get that user's OKRs. Else, get user's own OKRs.
  // Admins could potentially see everyone's OKRs in the org, but we'll stick to targeted for now.
  const targetUserId = userId || (req as any).user.id;

  const objectives = await prisma.objective.findMany({
    where: { userId: targetUserId, user: { organizationId: orgId } },
    include: { keyResults: true },
    orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
  });

  return res.json({ ok: true, objectives });
});

// POST /hr/okrs
router.post('/okrs', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { title, description, quarter, year } = req.body;

  if (!title || !quarter || !year) return res.status(400).json({ ok: false, message: 'Missing required fields' });

  const objective = await prisma.objective.create({
    data: { userId, title, description, quarter: parseInt(quarter), year: parseInt(year) },
    include: { keyResults: true }
  });
  return res.json({ ok: true, objective });
});

// POST /hr/okrs/:objectiveId/key-results
router.post('/okrs/:objectiveId/key-results', requireAuth, async (req: Request, res: Response) => {
  const { objectiveId } = req.params;
  const { title, targetValue, unit } = req.body;
  if (!title || targetValue === undefined) return res.status(400).json({ ok: false, message: 'Missing fields' });

  const kr = await prisma.keyResult.create({
    data: { objectiveId, title, targetValue: parseFloat(targetValue), unit },
  });
  return res.json({ ok: true, keyResult: kr });
});

// PATCH /hr/okrs/key-results/:keyResultId
router.patch('/okrs/key-results/:keyResultId', requireAuth, async (req: Request, res: Response) => {
  const { keyResultId } = req.params;
  const { currentValue } = req.body;
  if (currentValue === undefined) return res.status(400).json({ ok: false, message: 'Missing currentValue' });

  const kr = await prisma.keyResult.update({
    where: { id: keyResultId },
    data: { currentValue: parseFloat(currentValue) },
  });
  return res.json({ ok: true, keyResult: kr });
});

export default router;
