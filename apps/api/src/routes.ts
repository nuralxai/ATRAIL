import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { chatRouter } from "./modules/chat/chat.routes.js";
import { projectsRouter } from "./modules/projects/projects.routes.js";
import { attendanceRouter } from "./modules/attendance/attendance.routes.js";
import { tasksRouter } from "./modules/tasks/tasks.routes.js";
import { noticesRouter } from "./modules/notices/notices.routes.js";
import { emergencyRouter } from "./modules/emergency/emergency.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import totpRouter from "./modules/auth/totp.js";
import analyticsRouter from "./modules/analytics/index.js";
import hrRouter from "./modules/hr/index.js";
import documentsRouter from "./modules/documents/index.js";
import pushRouter from "./modules/notifications/push.js";
import { taskExtensionsRouter } from "./modules/tasks/extensions.js";
import { calendarRouter } from "./modules/calendar/calendar.routes.js";
import aiRouter from "./modules/ai/ai.routes.js";

import { organizationsRouter } from "./modules/organizations/organizations.routes.js";
import { integrationsRouter } from "./modules/integrations/integrations.routes.js";
import { assetsRouter } from "./modules/assets/assets.routes.js";
import { licensesRouter } from "./modules/licenses/licenses.routes.js";
import { searchRouter } from "./modules/search/search.routes.js";
import { financeRouter } from "./modules/finance/finance.routes.js";
import { milestonesRouter } from "./modules/finance/milestones.routes.js";
import renewalsRouter from "./modules/renewals/routes.js";
import customersRouter from "./modules/customers/routes.js";
import scoringRouter from "./modules/scoring/routes.js";
import commissionsRouter from "./modules/commissions/routes.js";
import quotesRouter from "./modules/quotes/routes.js";
import { developerRouter } from "./modules/developer/developer.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/auth/2fa", totpRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/chat", chatRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/attendance", attendanceRouter);
apiRouter.use("/tasks", tasksRouter);
apiRouter.use("/tasks", taskExtensionsRouter);
apiRouter.use("/notices", noticesRouter);
apiRouter.use("/emergency", emergencyRouter);
apiRouter.use("/notifications", pushRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/hr", hrRouter);
apiRouter.use("/documents", documentsRouter);
apiRouter.use("/calendar", calendarRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/organizations", organizationsRouter);
apiRouter.use("/integrations", integrationsRouter);
apiRouter.use("/assets", assetsRouter);
apiRouter.use("/licenses", licensesRouter);
apiRouter.use("/search", searchRouter);
apiRouter.use("/finance", financeRouter);
apiRouter.use("/milestones", milestonesRouter);
apiRouter.use("/renewals", renewalsRouter);
apiRouter.use("/customers", customersRouter);
apiRouter.use("/scoring", scoringRouter);
apiRouter.use("/commissions", commissionsRouter);
apiRouter.use("/quotes", quotesRouter);
apiRouter.use("/developer", developerRouter);

// Billing status — any authenticated user can fetch their own org status (for the banner)
import { requireAuth } from "./middlewares/auth.js";
import { prisma } from "./db.js";
apiRouter.get("/billing/my-status", requireAuth, async (req, res) => {
  try {
    const u = (req as any).user;
    if (!u?.orgId) return res.status(401).json({ ok: false, message: "Unauthorized" });
    const org = await prisma.organization.findUnique({
      where: { id: u.orgId },
      select: { billingStatus: true, billingDueDate: true, billingNote: true, trialEndsAt: true, planName: true, orgType: true },
    });
    if (!org) return res.status(404).json({ ok: false, message: "Org not found" });
    const daysUntilDue = org.billingDueDate
      ? Math.ceil((new Date(org.billingDueDate).getTime() - Date.now()) / 86400000)
      : null;
    res.json({ ok: true, data: { ...org, daysUntilDue } });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});