import { prisma } from "../../db.js";
import { ApiError } from "../../utils/errors.js";

export const noticesService = {
  async list(userId: string, orgId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, isActive: true },
      select: { id: true },
    });
    if (!user) throw new ApiError(401, "Unauthorized");

    const notices = await prisma.notice.findMany({
      where: {
        organizationId: orgId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        createdBy: { select: { id: true, fullName: true, role: true } },
        views: { where: { userId }, select: { id: true } },
      },
    });

    return notices.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      pinned: n.pinned,
      expiresAt: n.expiresAt,
      createdAt: n.createdAt,
      createdBy: n.createdBy,
      seen: n.views.length > 0,
    }));
  },

  async create(createdById: string, orgId: string, body: any) {
    return prisma.notice.create({
      data: {
        organizationId: orgId,
        createdById,
        title: body.title,
        content: body.content,
        pinned: !!body.pinned,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
      include: {
        createdBy: { select: { id: true, fullName: true, role: true } },
      },
    });
  },

  async markSeen(userId: string, orgId: string, noticeId: string) {
    const notice = await prisma.notice.findFirst({
      where: { id: noticeId, organizationId: orgId },
      select: { id: true },
    });
    if (!notice) throw new ApiError(404, "Notice not found");

    await prisma.noticeView.upsert({
      where: { noticeId_userId: { noticeId, userId } },
      update: { seenAt: new Date() },
      create: { noticeId, userId },
    });
  },

  async pin(orgId: string, noticeId: string, pinned: boolean) {
    const notice = await prisma.notice.findFirst({
      where: { id: noticeId, organizationId: orgId },
      select: { id: true },
    });
    if (!notice) throw new ApiError(404, "Notice not found");

    return prisma.notice.update({ where: { id: noticeId }, data: { pinned } });
  },
};
