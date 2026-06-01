import { prisma } from '../db.js';
import { AuditAction } from "../generated/client/index.js";

export async function auditAction(
  actorId: string,
  action: AuditAction,
  targetModel?: string,
  targetId?: string,
  metadata?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, targetModel, targetId, metadata, ipAddress, userAgent },
    });
  } catch (err) {
    console.error('[AuditLog Error]', err);
  }
}
