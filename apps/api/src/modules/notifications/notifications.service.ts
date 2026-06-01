import { prisma } from "../../db.js";
import { NotificationType } from "../../prisma-client.js";
import { sendPushToUser } from "./push.js";
import { sendEmailToUser } from "./email.js";
import { sendTelegramNotification } from "../telegram/notify.js";

export const notificationsService = {
  async createNotification(
    orgId: string,
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: {
      taskId?: string;
      projectId?: string;
      submissionId?: string;
    }
  ) {
    const notif = await prisma.notification.create({
      data: {
        organizationId: orgId,
        userId,
        type,
        title,
        message,
        taskId: metadata?.taskId,
        projectId: metadata?.projectId,
        submissionId: metadata?.submissionId,
      },
    });

    sendPushToUser(userId, title, message, { notificationId: notif.id, ...metadata })
      .catch(e => console.error("Push delivery error:", e));

    sendEmailToUser(
      userId,
      title,
      `<h3>${title}</h3><p>${message}</p>`
    ).catch(e => console.error("Email delivery error:", e));

    sendTelegramNotification(userId, `🔔 *${title}*\n${message}`)
      .catch(e => console.error("Telegram push error:", e));

    return notif;
  },

  async list(userId: string, orgId: string, unreadOnly?: boolean) {
    const where: any = {
      userId,
      organizationId: orgId,
    };
    if (unreadOnly) {
      where.read = false;
    }

    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
      },
    });
  },

  async markRead(userId: string, orgId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
        organizationId: orgId,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  },

  async markAllRead(userId: string, orgId: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        organizationId: orgId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  },
};
