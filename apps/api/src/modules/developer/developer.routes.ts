import { Router } from "express";
import { prisma } from "../../db.js";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

export const developerRouter = Router();

developerRouter.use(requireAuth);
developerRouter.use(requireRole("GOD", "DEVELOPER"));

// ─── List all orgs with billing info ────────────────────────────────────────
developerRouter.get("/orgs", async (req, res) => {
  try {
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        logoUrl: true,
        orgType: true,
        billingStatus: true,
        billingDueDate: true,
        billingAmount: true,
        billingNote: true,
        billingUpdatedAt: true,
        billingUpdatedBy: true,
        trialEndsAt: true,
        planName: true,
        createdAt: true,
        _count: { select: { users: true, customers: true, renewals: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ ok: true, data: orgs });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ─── Get single org billing detail ──────────────────────────────────────────
developerRouter.get("/orgs/:orgId", async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.orgId },
      include: {
        _count: { select: { users: true, customers: true, renewals: true } },
      },
    });
    if (!org) return res.status(404).json({ ok: false, message: "Org not found" });
    res.json({ ok: true, data: org });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ─── Update org billing status ───────────────────────────────────────────────
developerRouter.patch("/orgs/:orgId/billing", async (req, res) => {
  try {
    const u = (req as any).user;
    const {
      billingStatus,
      billingDueDate,
      billingAmount,
      billingNote,
      trialEndsAt,
      planName,
      orgType,
    } = req.body;

    const allowed = ["ACTIVE", "TRIALING", "PAST_DUE", "SUSPENDED", "CANCELLED"];
    if (billingStatus && !allowed.includes(billingStatus)) {
      return res.status(400).json({ ok: false, message: `billingStatus must be one of ${allowed.join(", ")}` });
    }

    const org = await prisma.organization.update({
      where: { id: req.params.orgId },
      data: {
        ...(billingStatus  !== undefined && { billingStatus }),
        ...(billingDueDate !== undefined && { billingDueDate: billingDueDate ? new Date(billingDueDate) : null }),
        ...(billingAmount  !== undefined && { billingAmount }),
        ...(billingNote    !== undefined && { billingNote }),
        ...(trialEndsAt    !== undefined && { trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null }),
        ...(planName       !== undefined && { planName }),
        ...(orgType        !== undefined && { orgType }),
        billingUpdatedAt: new Date(),
        billingUpdatedBy: u.id,
      },
    });

    // Log this action for audit trail
    await prisma.notification.create({
      data: {
        organizationId: req.params.orgId,
        userId: u.id,
        title: "Billing status updated",
        message: `Status changed to ${billingStatus ?? "unchanged"}${billingNote ? ` — ${billingNote}` : ""}`,
        type: "SYSTEM",
      },
    }).catch(() => {}); // don't fail if notification model has different shape

    res.json({ ok: true, data: org });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ─── Billing status endpoint any org user can call (to show banner) ──────────
// This is intentionally NOT behind requireRole — any auth'd user can see their own org status
developerRouter.get("/billing/my-status", async (req, res) => {
  try {
    const u = (req as any).user;
    if (!u?.orgId) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const org = await prisma.organization.findUnique({
      where: { id: u.orgId },
      select: {
        billingStatus: true,
        billingDueDate: true,
        billingNote: true,
        trialEndsAt: true,
        planName: true,
        orgType: true,
      },
    });

    if (!org) return res.status(404).json({ ok: false, message: "Org not found" });

    // Compute days overdue / days until due
    let daysUntilDue: number | null = null;
    if (org.billingDueDate) {
      daysUntilDue = Math.ceil((new Date(org.billingDueDate).getTime() - Date.now()) / 86400000);
    }

    res.json({ ok: true, data: { ...org, daysUntilDue } });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ─── Quick suspend/activate shortcuts ────────────────────────────────────────
developerRouter.post("/orgs/:orgId/suspend", async (req, res) => {
  try {
    const u = (req as any).user;
    const { reason } = req.body;
    const org = await prisma.organization.update({
      where: { id: req.params.orgId },
      data: {
        billingStatus: "SUSPENDED",
        billingNote: reason || "Suspended by administrator",
        billingUpdatedAt: new Date(),
        billingUpdatedBy: u.id,
      },
    });
    res.json({ ok: true, data: org });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

developerRouter.post("/orgs/:orgId/activate", async (req, res) => {
  try {
    const u = (req as any).user;
    const { note } = req.body;
    const org = await prisma.organization.update({
      where: { id: req.params.orgId },
      data: {
        billingStatus: "ACTIVE",
        billingNote: note || "Activated by administrator",
        billingUpdatedAt: new Date(),
        billingUpdatedBy: u.id,
      },
    });
    res.json({ ok: true, data: org });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});
