import { prisma } from "../../db.js";
import { ApiError } from "../../utils/errors.js";
import { emitEmergencyStatus } from "../../socket.js";

const CANCEL_WINDOW_MS = 10_000;

// Get or create emergency conversation for an emergency event
async function getOrCreateEmergencyConversation(
  orgId: string,
  eventId: string,
  projectId?: string | null
) {
  const key = projectId
    ? `emergency:${eventId}:project:${projectId}`
    : `emergency:${eventId}`;

  // Check if conversation already exists
  const existing = await prisma.conversation.findUnique({
    where: { key },
  });

  if (existing) {
    return existing;
  }

  // Get all active users in the organization (or project if specified)
  let userIds: string[] = [];
  if (projectId) {
    // Project-specific emergency: include all project members
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });
    userIds = members.map((m) => m.userId);
  } else {
    // Organization-wide emergency: include all active users
    const users = await prisma.user.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true },
    });
    userIds = users.map((u) => u.id);
  }

  // Create conversation
  const conversation = await prisma.conversation.create({
    data: {
      organizationId: orgId,
      type: "PROJECT", // Use PROJECT type for group chats
      projectId: projectId ?? undefined,
      key,
      members: {
        create: userIds.map((uid) => ({ userId: uid })),
      },
    },
  });

  return conversation;
}

export const emergencyService = {
  async trigger(
    userId: string,
    orgId: string,
    body: { reason?: string; projectId?: string }
  ) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, isActive: true },
      select: { id: true },
    });
    if (!user) throw new ApiError(401, "Unauthorized");

    const event = await prisma.emergencyEvent.create({
      data: {
        organizationId: orgId,
        projectId: body.projectId,
        triggeredById: userId,
        reason: body.reason,
        status: "ACTIVE",
      },
      include: {
        triggeredBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    // Create emergency conversation
    const conversation = await getOrCreateEmergencyConversation(
      orgId,
      event.id,
      body.projectId
    );

    // Emit emergency status change to all org members
    emitEmergencyStatus(orgId, {
      id: event.id,
      status: "ACTIVE",
      triggeredAt: event.triggeredAt.toISOString(),
      triggeredBy: event.triggeredBy,
      reason: event.reason,
      conversationId: conversation.id,
    });

    return { ...event, conversationId: conversation.id };
  },

  async cancel(userId: string, orgId: string, eventId: string) {
    const event = await prisma.emergencyEvent.findFirst({
      where: { id: eventId, organizationId: orgId },
      include: {
        triggeredBy: { select: { id: true, fullName: true, role: true } },
      },
    });
    if (!event) throw new ApiError(404, "Event not found");
    if (event.triggeredById !== userId)
      throw new ApiError(403, "Only triggerer can cancel");
    if (event.status !== "ACTIVE") throw new ApiError(400, "Not active");

    if (Date.now() - event.triggeredAt.getTime() > CANCEL_WINDOW_MS) {
      throw new ApiError(400, "Cancel window expired");
    }

    const cancelled = await prisma.emergencyEvent.update({
      where: { id: eventId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    // Emit emergency cancelled status
    emitEmergencyStatus(orgId, {
      id: cancelled.id,
      status: "CANCELLED",
      triggeredAt: event.triggeredAt.toISOString(),
      resolvedAt: cancelled.resolvedAt?.toISOString() ?? null,
      triggeredBy: event.triggeredBy,
      reason: event.reason,
    });

    return cancelled;
  },

  async active(orgId: string) {
    const events = await prisma.emergencyEvent.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      orderBy: { triggeredAt: "desc" },
      include: {
        triggeredBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    // Get conversation IDs for each emergency
    const eventsWithConversations = await Promise.all(
      events.map(async (event) => {
        const key = event.projectId
          ? `emergency:${event.id}:project:${event.projectId}`
          : `emergency:${event.id}`;
        const conversation = await prisma.conversation.findUnique({
          where: { key },
          select: { id: true },
        });
        return {
          ...event,
          conversationId: conversation?.id ?? null,
        };
      })
    );

    return eventsWithConversations;
  },

  async getEmergencyConversation(orgId: string, eventId: string) {
    const event = await prisma.emergencyEvent.findFirst({
      where: { id: eventId, organizationId: orgId },
      select: { id: true, projectId: true },
    });
    if (!event) throw new ApiError(404, "Emergency event not found");

    const conversation = await getOrCreateEmergencyConversation(
      orgId,
      eventId,
      event.projectId
    );

    return conversation;
  },

  async getEmergencyByConversationId(orgId: string, conversationId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId: orgId },
      select: { key: true },
    });
    if (!conversation) throw new ApiError(404, "Conversation not found");

    // Check if this is an emergency conversation
    if (!conversation.key?.startsWith("emergency:")) {
      return null;
    }

    // Extract event ID from key (format: emergency:{eventId} or emergency:{eventId}:project:{projectId})
    const match = conversation.key.match(/^emergency:([^:]+)/);
    if (!match) return null;

    const eventId = match[1];
    const event = await prisma.emergencyEvent.findFirst({
      where: { id: eventId, organizationId: orgId },
      include: {
        triggeredBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    return event;
  },

  async resolve(handlerId: string, orgId: string, eventId: string) {
    const event = await prisma.emergencyEvent.findFirst({
      where: { id: eventId, organizationId: orgId },
      select: { id: true, status: true },
    });
    if (!event) throw new ApiError(404, "Event not found");
    if (event.status !== "ACTIVE") throw new ApiError(400, "Not active");

    const resolved = await prisma.emergencyEvent.update({
      where: { id: eventId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        handledById: handlerId,
      },
      include: {
        triggeredBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    // Emit emergency resolved status
    emitEmergencyStatus(orgId, {
      id: resolved.id,
      status: "RESOLVED",
      triggeredAt: resolved.triggeredAt.toISOString(),
      resolvedAt: resolved.resolvedAt?.toISOString() ?? null,
      triggeredBy: resolved.triggeredBy,
      reason: resolved.reason,
    });

    return resolved;
  },
};
