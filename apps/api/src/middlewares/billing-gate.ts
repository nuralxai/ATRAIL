import type { RequestHandler } from "express";
import { prisma } from "../db.js";

// Routes that are always allowed regardless of billing status
const BILLING_EXEMPT_PATHS = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/refresh",
  "/api/v1/auth/logout",
  "/api/v1/auth/register",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
  "/api/v1/auth/2fa",
  "/api/v1/billing/status",   // so frontend can always fetch their status
  "/health",
]);

// GOD and DEVELOPER bypass all billing gates
const BYPASS_ROLES = new Set(["GOD", "DEVELOPER"]);

export const billingGate: RequestHandler = async (req, res, next) => {
  const user = (req as any).user;

  // No user yet (handled by auth middleware later) — pass through
  if (!user) return next();

  // GOD / DEVELOPER always pass
  if (BYPASS_ROLES.has(user.role)) return next();

  // Exempt paths always pass
  if (BILLING_EXEMPT_PATHS.has(req.path)) return next();

  // Load org billing status (cached on user object if set, else DB lookup)
  let billingStatus: string = user.orgBillingStatus;
  if (!billingStatus && user.orgId) {
    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { billingStatus: true, billingDueDate: true, billingNote: true, planName: true, trialEndsAt: true },
    });
    if (org) {
      billingStatus = org.billingStatus;
      // Attach to user for this request so downstream code can read it
      (req as any).org = org;
    }
  }

  if (!billingStatus || billingStatus === "ACTIVE" || billingStatus === "TRIALING") {
    return next();
  }

  // PAST_DUE: allow reads, block writes (warn only)
  if (billingStatus === "PAST_DUE") {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return res.status(402).json({
        ok: false,
        billingStatus: "PAST_DUE",
        message: "Your account payment is overdue. Please contact your account manager to continue making changes.",
        action: "PAY_NOW",
      });
    }
    return next();
  }

  // SUSPENDED: block everything
  if (billingStatus === "SUSPENDED") {
    return res.status(402).json({
      ok: false,
      billingStatus: "SUSPENDED",
      message: "Your account has been suspended due to non-payment. Please contact support to reactivate.",
      action: "CONTACT_SUPPORT",
    });
  }

  // CANCELLED: block everything
  if (billingStatus === "CANCELLED") {
    return res.status(403).json({
      ok: false,
      billingStatus: "CANCELLED",
      message: "Your account has been cancelled. Please contact support if you believe this is an error.",
      action: "CONTACT_SUPPORT",
    });
  }

  next();
};
