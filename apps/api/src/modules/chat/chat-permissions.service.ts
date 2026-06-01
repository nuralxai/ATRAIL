import { prisma } from "../../db.js";
import { ApiError } from "../../utils/errors.js";
import { Role } from "../../prisma-client.js";

export const chatPermissionsService = {
  async createRequest(eliteId: string, orgId: string, adminId: string) {
    // Verify elite user
    const elite = await prisma.user.findFirst({
      where: { id: eliteId, organizationId: orgId, isActive: true },
      select: { id: true, role: true },
    });
    if (!elite || elite.role !== Role.ELITE)
      throw new ApiError(403, "Only ELITE can create chat requests");

    // Verify admin user
    const admin = await prisma.user.findFirst({
      where: { id: adminId, organizationId: orgId, isActive: true },
      select: { id: true, role: true },
    });
    if (!admin || admin.role !== Role.ADMIN)
      throw new ApiError(400, "Target user must be an ADMIN");

    // Check if request already exists
    const existing = await prisma.chatPermission.findUnique({
      where: { adminId_eliteId: { adminId, eliteId } },
    });

    if (existing) {
      if (existing.status === "ACCEPTED") {
        return existing; // Already accepted, return it
      }
      if (existing.status === "BLOCKED") {
        throw new ApiError(403, "You are blocked from messaging this admin");
      }
      if (existing.status === "PENDING") {
        return existing; // Already pending, return it
      }
      // If REJECTED, create new PENDING request
    }

    const permission = await prisma.chatPermission.upsert({
      where: { adminId_eliteId: { adminId, eliteId } },
      update: { status: "PENDING" },
      create: {
        adminId,
        eliteId,
        status: "PENDING",
      },
      include: {
        elite: { select: { id: true, fullName: true, email: true } },
        admin: { select: { id: true, fullName: true, email: true } },
      },
    });

    return permission;
  },

  async listInbox(adminId: string, orgId: string) {
    const admin = await prisma.user.findFirst({
      where: { id: adminId, organizationId: orgId, isActive: true },
      select: { id: true, role: true },
    });
    if (!admin || admin.role !== Role.ADMIN)
      throw new ApiError(403, "Only ADMIN can view inbox");

    const requests = await prisma.chatPermission.findMany({
      where: { adminId, status: "PENDING" },
      include: {
        elite: { select: { id: true, fullName: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return requests;
  },

  async accept(adminId: string, orgId: string, requestId: string) {
    const admin = await prisma.user.findFirst({
      where: { id: adminId, organizationId: orgId, isActive: true },
      select: { id: true, role: true },
    });
    if (!admin || admin.role !== Role.ADMIN)
      throw new ApiError(403, "Only ADMIN can accept requests");

    const request = await prisma.chatPermission.findFirst({
      where: { id: requestId, adminId },
    });
    if (!request) throw new ApiError(404, "Request not found");
    if (request.status !== "PENDING")
      throw new ApiError(400, "Request is not pending");

    const updated = await prisma.chatPermission.update({
      where: { id: requestId },
      data: { status: "ACCEPTED" },
      include: {
        elite: { select: { id: true, fullName: true, email: true } },
      },
    });

    return updated;
  },

  async reject(adminId: string, orgId: string, requestId: string) {
    const admin = await prisma.user.findFirst({
      where: { id: adminId, organizationId: orgId, isActive: true },
      select: { id: true, role: true },
    });
    if (!admin || admin.role !== Role.ADMIN)
      throw new ApiError(403, "Only ADMIN can reject requests");

    const request = await prisma.chatPermission.findFirst({
      where: { id: requestId, adminId },
    });
    if (!request) throw new ApiError(404, "Request not found");
    if (request.status !== "PENDING")
      throw new ApiError(400, "Request is not pending");

    const updated = await prisma.chatPermission.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    });

    return updated;
  },

  async block(adminId: string, orgId: string, requestId: string) {
    const admin = await prisma.user.findFirst({
      where: { id: adminId, organizationId: orgId, isActive: true },
      select: { id: true, role: true },
    });
    if (!admin || admin.role !== Role.ADMIN)
      throw new ApiError(403, "Only ADMIN can block users");

    const request = await prisma.chatPermission.findFirst({
      where: { id: requestId, adminId },
    });
    if (!request) throw new ApiError(404, "Request not found");

    const updated = await prisma.chatPermission.update({
      where: { id: requestId },
      data: { status: "BLOCKED" },
    });

    return updated;
  },

  async checkPermission(eliteId: string, adminId: string): Promise<boolean> {
    const permission = await prisma.chatPermission.findUnique({
      where: { adminId_eliteId: { adminId, eliteId } },
    });
    return permission?.status === "ACCEPTED";
  },

  async getPermissionStatus(eliteId: string, adminId: string) {
    const permission = await prisma.chatPermission.findUnique({
      where: { adminId_eliteId: { adminId, eliteId } },
      select: { id: true, status: true },
    });
    return permission?.status ?? "NONE";
  },
};
