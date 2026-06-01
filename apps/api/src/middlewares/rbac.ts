import type { Request, Response, NextFunction, RequestHandler } from "express";
import { ApiError } from "../utils/errors.js";

export enum RenewalOSRole {
  ORG_OWNER = "ORG_OWNER",
  ORG_ADMIN = "ORG_ADMIN",
  SALES_MANAGER = "SALES_MANAGER",
  ACCOUNT_MANAGER = "ACCOUNT_MANAGER",
  FINANCE = "FINANCE",
  READ_ONLY = "READ_ONLY",
  EXTERNAL_CUSTOMER = "EXTERNAL_CUSTOMER",
}

// Role hierarchy: higher roles can do what lower roles can
const roleHierarchy: Record<RenewalOSRole, number> = {
  [RenewalOSRole.ORG_OWNER]: 100,
  [RenewalOSRole.ORG_ADMIN]: 90,
  [RenewalOSRole.SALES_MANAGER]: 80,
  [RenewalOSRole.ACCOUNT_MANAGER]: 70,
  [RenewalOSRole.FINANCE]: 60,
  [RenewalOSRole.READ_ONLY]: 20,
  [RenewalOSRole.EXTERNAL_CUSTOMER]: 10,
};

export function requireRoles(...requiredRoles: RenewalOSRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return next(new ApiError(401, "Unauthorized"));
    }

    const userRole = user.role as RenewalOSRole;
    const hasRequiredRole = requiredRoles.some(
      (role) => roleHierarchy[userRole] >= roleHierarchy[role]
    );

    if (!hasRequiredRole) {
      return next(new ApiError(403, `Forbidden: Requires one of ${requiredRoles.join(", ")}`));
    }

    next();
  };
}

export function requirePermission(permission: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return next(new ApiError(401, "Unauthorized"));
    }

    const userRole = user.role as RenewalOSRole;
    const permissions = getPermissionsForRole(userRole);

    if (!permissions.includes(permission)) {
      return next(new ApiError(403, `Forbidden: Missing permission "${permission}"`));
    }

    next();
  };
}

export function getPermissionsForRole(role: RenewalOSRole): string[] {
  const basePermissions: Record<RenewalOSRole, string[]> = {
    [RenewalOSRole.ORG_OWNER]: [
      "manage_billing",
      "manage_organization",
      "delete_organization",
      "manage_users",
      "view_all_data",
      "edit_all_renewals",
      "manage_commissions",
    ],
    [RenewalOSRole.ORG_ADMIN]: [
      "manage_users",
      "manage_integrations",
      "manage_masters",
      "view_all_data",
      "edit_all_renewals",
      "manage_commissions",
    ],
    [RenewalOSRole.SALES_MANAGER]: [
      "view_all_pipelines",
      "reassign_accounts",
      "run_reports",
      "view_all_renewals",
      "edit_team_renewals",
      "view_commissions",
    ],
    [RenewalOSRole.ACCOUNT_MANAGER]: [
      "manage_own_customers",
      "execute_renewals",
      "create_quotes",
      "close_deals",
      "view_own_renewals",
      "request_payout",
      "view_own_commissions",
    ],
    [RenewalOSRole.FINANCE]: [
      "view_payments",
      "view_invoices",
      "manage_ar",
      "reconcile_commissions",
      "view_dso_reports",
      "view_financial_reports",
    ],
    [RenewalOSRole.READ_ONLY]: [
      "view_all_data",
    ],
    [RenewalOSRole.EXTERNAL_CUSTOMER]: [
      "view_own_renewals",
      "approve_quotes",
      "make_payments",
    ],
  };

  return basePermissions[role] || [];
}

export function canAccessResource(userRole: RenewalOSRole, resourceOwnerId: string, userId: string): boolean {
  // OWNER and ADMIN can access anything
  if (
    roleHierarchy[userRole] >= roleHierarchy[RenewalOSRole.ORG_ADMIN]
  ) {
    return true;
  }

  // Other roles can only access their own resources
  return resourceOwnerId === userId;
}

export function validateOrgContext(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const requestOrgId = req.params.orgId || req.body?.organizationId || (req as any).query?.orgId;

    if (!user) {
      return next(new ApiError(401, "Unauthorized"));
    }

    // If org is specified in request, verify it matches user's org
    if (requestOrgId && requestOrgId !== user.orgId) {
      return next(new ApiError(403, "Organization mismatch"));
    }

    next();
  };
}

export const roleBasedDataFilter = (userRole: RenewalOSRole, data: any[]): any[] => {
  // OWNER and ADMIN see all data
  if (roleHierarchy[userRole] >= roleHierarchy[RenewalOSRole.ORG_ADMIN]) {
    return data;
  }

  // Other roles might have restricted data based on their role
  // (this is basic - extend as needed)
  return data;
};
