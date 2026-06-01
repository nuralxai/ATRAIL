import { prisma } from "../../db.js";
import { ApiError } from "../../utils/errors.js";
import { canMessage } from "@amgi/shared";
import type { Role } from "../../prisma-client.js";
import { emitNewMessage, emitNewConversation } from "../../socket.js";
import { chatPermissionsService } from "./chat-permissions.service.js";

// Optional telegram relay (we will use a generic log for now since no explicit telegram service exists)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function directKey(a: string, b: string) {
  const [x, y] = a < b ? [a, b] : [b, a];
  return `direct:${x}:${y}`;
}

function projectKey(projectId: string) {
  return `project:${projectId}`;
}

// Check if user can INITIATE a new chat
function canInitiateChat(senderRole: Role, receiverRole: Role): boolean {
  if (senderRole === "SUPER_ADMIN") return true;

  if (senderRole === "ADMIN") {
    return receiverRole === "ELITE" || receiverRole === "TENANT" || receiverRole === "SUPER_ADMIN";
  }

  if (senderRole === "ELITE") {
    return receiverRole === "ADMIN" || receiverRole === "USER" || receiverRole === "TENANT" || receiverRole === "SUPER_ADMIN";
  }

  if (senderRole === "TENANT") {
    return receiverRole === "ADMIN" || receiverRole === "ELITE";
  }

  if (senderRole === "USER") {
    return receiverRole === "ELITE" || receiverRole === "USER" || receiverRole === "SUPER_ADMIN";
  }

  return false;
}

// Check if two users share a project (either as members or as head)
async function usersShareProject(userAId: string, userBId: string, userARole: Role, userBRole: Role): Promise<boolean> {
  // Check if they are members of the same project
  const sharedMemberships = await prisma.projectMember.findMany({
    where: { userId: userAId },
    select: { projectId: true }
  });
  
  const projectIds = sharedMemberships.map(m => m.projectId);
  if (projectIds.length === 0) return false;

  // Check if user B is a member of any of these projects
  const bMembership = await prisma.projectMember.findFirst({
    where: {
      userId: userBId,
      projectId: { in: projectIds }
    }
  });

  if (bMembership) return true;

  // Also check if user B is the Head of any of user A's projects (if B is ELITE)
  if (userBRole === "ELITE") {
    const isHead = await prisma.project.findFirst({
      where: {
        id: { in: projectIds },
        headId: userBId
      }
    });
    if (isHead) return true;
  }
  
  // Also check if user A is the Head of any of user B's projects (if A is ELITE)
  if (userARole === "ELITE") {
    const bMemberships = await prisma.projectMember.findMany({
      where: { userId: userBId },
      select: { projectId: true }
    });
    const bProjectIds = bMemberships.map(m => m.projectId);
    
    if (bProjectIds.length > 0) {
      const isHead = await prisma.project.findFirst({
        where: {
          id: { in: bProjectIds },
          headId: userAId
        }
      });
      if (isHead) return true;
    }
  }

  return false;
}

// Check if user can send message based on role hierarchy and permissions
async function checkCanSendMessage(
  senderRole: Role,
  receiverRole: Role,
  senderId: string,
  receiverId: string,
  conversationExists: boolean = false
): Promise<boolean> {
  // Strict Project Constraints for Interns/Users
  if (
    (senderRole === "USER" && receiverRole === "USER") ||
    (senderRole === "USER" && receiverRole === "ELITE") ||
    (senderRole === "ELITE" && receiverRole === "USER")
  ) {
    const sharesProject = await usersShareProject(senderId, receiverId, senderRole, receiverRole);
    if (!sharesProject) return false;
  }

  // Can send if they could initiate
  if (canInitiateChat(senderRole, receiverRole)) {
    return true;
  }

  // Allow replying if higher hierarchy initiated it, EXCEPT for Tenant->User boundary
  if (conversationExists) {
    if (senderRole === "TENANT" && receiverRole === "USER") return false;
    if (senderRole === "USER" && receiverRole === "TENANT") return false;
    if (senderRole === "USER" && receiverRole === "ADMIN") return true;
    if (senderRole === "TENANT" && receiverRole === "SUPER_ADMIN") return true;
  }

  return false;
}

export const chatService = {
  async listConversations(userId: string, orgId: string) {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!me) throw new ApiError(401, "Unauthorized");

    let conversations: any[] = [];
    const includeConfig = {
      project: { select: { id: true, name: true } },
      members: {
        include: {
          user: { select: { id: true, fullName: true, role: true } },
        },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: { id: true, body: true, createdAt: true, senderId: true, fileUrl: true, fileType: true },
      },
    };

    if (me.role === "SUPER_ADMIN") {
      conversations = await prisma.conversation.findMany({
        where: { organizationId: orgId },
        include: includeConfig,
        orderBy: { updatedAt: "desc" },
      });
    } else if (me.role === "ADMIN" || me.role === "TENANT") {
      conversations = await prisma.conversation.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { type: "PROJECT" },
            { members: { some: { userId } } }
          ]
        },
        include: includeConfig,
        orderBy: { updatedAt: "desc" },
      });
    } else {
      const memberships = await prisma.conversationMember.findMany({
        where: {
          userId,
          conversation: { organizationId: orgId },
        },
        include: {
          conversation: {
            include: includeConfig,
          },
        },
        orderBy: { conversation: { updatedAt: "desc" } },
      });
      conversations = memberships.map((m) => m.conversation);
    }

    return Promise.all(
      conversations.map(async (c) => {
        let otherUser: { id: string; fullName: string; role: Role } | null = null;
        const myMember = c.members.find((m: any) => m.user.id === userId);
        const isParticipant = !!myMember;
        let canSend = isParticipant;

        let unreadCount = 0;
        if (myMember) {
          if (myMember.lastReadMessageId) {
            const lastReadMsg = await prisma.message.findUnique({
              where: { id: myMember.lastReadMessageId },
              select: { createdAt: true }
            });
            if (lastReadMsg) {
              unreadCount = await prisma.message.count({
                where: {
                  conversationId: c.id,
                  createdAt: { gt: lastReadMsg.createdAt },
                  senderId: { not: userId },
                  deletedAt: null
                }
              });
            }
          } else {
            unreadCount = await prisma.message.count({
              where: {
                conversationId: c.id,
                senderId: { not: userId },
                deletedAt: null
              }
            });
          }
        }

        if (c.type === "DIRECT") {
          otherUser = c.members.map((mm: any) => mm.user).find((u: any) => u.id !== userId) ?? null;
          
          if (otherUser && isParticipant) {
            canSend = await checkCanSendMessage(me.role, otherUser.role, userId, otherUser.id, true);
          }
        } else if (c.type === "PROJECT" && c.project) {
          if (c.project.name.toLowerCase().includes("announcement")) {
            if (me.role !== "ADMIN" && me.role !== "SUPER_ADMIN") {
              canSend = false;
            }
          }
        }

        return {
          id: c.id,
          type: c.type,
          project: c.project ?? null,
          otherUser,
          lastMessage: c.messages[0] ?? null,
          canSend,
          isParticipant,
          unreadCount,
        };
      })
    );
  },

  async getOrCreateDirect(fromUserId: string, orgId: string, toUserId: string) {
    if (fromUserId === toUserId)
      throw new ApiError(400, "Cannot chat with yourself");

    const [me, other] = await Promise.all([
      prisma.user.findUnique({
        where: { id: fromUserId },
        select: { role: true, organizationId: true },
      }),
      prisma.user.findUnique({
        where: { id: toUserId },
        select: {
          role: true,
          organizationId: true,
          isActive: true,
          fullName: true,
        },
      }),
    ]);

    if (!me || me.organizationId !== orgId)
      throw new ApiError(401, "Unauthorized");
    if (!other || other.organizationId !== orgId || !other.isActive)
      throw new ApiError(404, "User not found");

    const key = directKey(fromUserId, toUserId);

    // Check if conversation already exists
    const existing = await prisma.conversation.findUnique({
      where: { key },
      include: {
        members: {
          include: {
            user: { select: { id: true, role: true } },
          },
        },
      },
    });

    // If conversation exists, allow both parties to access it (for replying)
    if (existing) {
      return existing;
    }

    // For NEW conversations, check initiation rules
    if (!canInitiateChat(me.role, other.role)) {
      if (
        me.role === "USER" &&
        (other.role === "ADMIN" || other.role === "SUPER_ADMIN")
      ) {
        throw new ApiError(
          403,
          "You cannot start a chat with this user. They must initiate the conversation first."
        );
      }
      if (me.role === "ELITE" && other.role === "SUPER_ADMIN") {
        throw new ApiError(
          403,
          "You cannot start a chat with this user. They must initiate the conversation first."
        );
      }
      throw new ApiError(403, "You cannot start a chat with this user");
    }

    // Create new conversation
    const convo = await prisma.conversation.create({
      data: {
        organizationId: orgId,
        type: "DIRECT",
        key,
        members: {
          create: [{ userId: fromUserId }, { userId: toUserId }],
        },
      },
      include: {
        project: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, fullName: true, role: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, body: true, createdAt: true, senderId: true },
        },
      },
    });

    // Format conversation for frontend (matching listConversations format)
    const meInConvo = convo.members.find((m) => m.user.id === fromUserId)?.user;
    const otherInConvo = convo.members.find(
      (m) => m.user.id !== fromUserId
    )?.user;

    const formattedConvo = {
      id: convo.id,
      type: convo.type,
      project: convo.project ?? null,
      otherUser: otherInConvo
        ? {
            id: otherInConvo.id,
            fullName: otherInConvo.fullName,
            role: otherInConvo.role,
          }
        : null,
      lastMessage: convo.messages[0] ?? null,
      canSend: true, // New conversation, can send
    };

    // Notify both users about the new conversation via Socket.IO
    emitNewConversation(orgId, fromUserId, toUserId, formattedConvo);

    return convo;
  },

  async getOrCreateProject(
    userId: string,
    orgId: string,
    role: Role,
    projectId: string
  ) {
    // Check if project exists
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      select: { id: true },
    });
    if (!project) throw new ApiError(404, "Project not found");

    // Admin and Super Admin can access any project chat
    const isAdminPlus = role === "ADMIN" || role === "SUPER_ADMIN";

    // Elite and User need to be project members
    if (!isAdminPlus) {
      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
      });
      if (!member) throw new ApiError(403, "Not a member of this project");
    }

    const key = projectKey(projectId);

    // Ensure conversation exists and sync membership
    const convo = await prisma.conversation.upsert({
      where: { key },
      update: {},
      create: {
        organizationId: orgId,
        type: "PROJECT",
        key,
        projectId,
      },
    });

    // Sync conversation members with project members
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });
    const desired = new Set(members.map((m) => m.userId));

    // Always add the current user to desired members (especially for ADMIN/SUPER_ADMIN)
    desired.add(userId);

    const existing = await prisma.conversationMember.findMany({
      where: { conversationId: convo.id },
      select: { userId: true },
    });
    const existingSet = new Set(existing.map((m) => m.userId));

    const toAdd = [...desired].filter((id) => !existingSet.has(id));
    const toRemove = [...existingSet].filter((id) => !desired.has(id));

    await prisma.$transaction([
      ...(toAdd.length
        ? [
            prisma.conversationMember.createMany({
              data: toAdd.map((userId) => ({
                conversationId: convo.id,
                userId,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
      ...(toRemove.length
        ? [
            prisma.conversationMember.deleteMany({
              where: { conversationId: convo.id, userId: { in: toRemove } },
            }),
          ]
        : []),
    ]);

    return prisma.conversation.findUnique({
      where: { id: convo.id },
      include: { project: { select: { id: true, name: true } } },
    });
  },

  async getMessages(
    userId: string,
    orgId: string,
    conversationId: string,
    opts: { limit: number; cursor?: string }
  ) {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!me) throw new ApiError(401, "Unauthorized");

    const convo = await prisma.conversation.findUnique({
      where: { id: conversationId, organizationId: orgId },
      include: {
        project: { select: { id: true, name: true } },
      }
    });
    if (!convo) throw new ApiError(404, "Conversation not found");

    const member = await prisma.conversationMember.findFirst({
      where: { conversationId, userId },
      include: { user: { select: { role: true } } },
    });

    const isParticipant = !!member;
    let canRead = isParticipant;

    if (!isParticipant) {
      if (me.role === "SUPER_ADMIN") canRead = true;
      else if ((me.role === "ADMIN" || me.role === "TENANT") && convo.type === "PROJECT") canRead = true;
    }

    if (!canRead) throw new ApiError(403, "Not allowed to read this conversation");

    if (isParticipant && convo.type === "PROJECT" && convo.project) {
      const isAdminPlus = me.role === "ADMIN" || me.role === "SUPER_ADMIN";
      if (!isAdminPlus) {
        const projectMember = await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: convo.project.id, userId } },
        });
        if (!projectMember) {
          throw new ApiError(403, "No longer a member of this project");
        }
      }
    }

    const where: any = { conversationId };
    if (opts.cursor) where.id = { lt: opts.cursor };

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.limit,
      select: { id: true, body: true, senderId: true, createdAt: true, deletedAt: true, fileUrl: true, fileName: true, fileType: true, mentionedUserIds: true },
    });

    const items = messages.map(m => ({
      ...m,
      body: m.deletedAt ? "This message was deleted" : m.body,
      fileUrl: m.deletedAt ? null : m.fileUrl,
      fileName: m.deletedAt ? null : m.fileName,
      fileType: m.deletedAt ? null : m.fileType,
      deletedAt: !!m.deletedAt
    })).reverse();

    const nextCursor =
      messages.length === opts.limit ? messages[messages.length - 1].id : null;

    const receiptMembers = await prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true, lastReadMessageId: true, lastDeliveredMessageId: true }
    });

    return { messages: items, nextCursor, receiptMembers };
  },

  async sendMessage(
    userId: string,
    orgId: string,
    conversationId: string,
    body: string,
    file?: { url: string; name: string; type: string }
  ) {
    const trimmed = (body ?? "").trim();
    if (!trimmed && !file) throw new ApiError(400, "Message body or file required");

    const member = await prisma.conversationMember.findFirst({
      where: {
        conversationId,
        userId,
        conversation: { organizationId: orgId },
      },
      include: {
        conversation: {
          include: {
            project: { select: { id: true, name: true } },
            members: {
              include: { user: { select: { id: true, role: true, fullName: true } } },
            },
          },
        },
        user: { select: { role: true, fullName: true } },
      },
    });
    if (!member) throw new ApiError(403, "Not a member of this conversation");

    const convo = member.conversation;

    // For project conversations, verify ELITE/USER are still project members
    if (convo.type === "PROJECT" && convo.project) {
      const isAdminPlus =
        member.user.role === "ADMIN" || member.user.role === "SUPER_ADMIN";

      // Enforce Read-Only Announcements Channels
      if (convo.project.name.toLowerCase().includes("announcement") && !isAdminPlus) {
        throw new ApiError(403, "This is a read-only announcements channel. Only Admins can post messages.");
      }

      if (!isAdminPlus) {
        const projectMember = await prisma.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: convo.project.id,
              userId,
            },
          },
        });
        if (!projectMember) {
          throw new ApiError(403, "No longer a member of this project");
        }
      }
    }

    if (convo.type === "DIRECT") {
      const me = convo.members.find((m) => m.user.id === userId)?.user;
      const other = convo.members.find((m) => m.user.id !== userId)?.user;

      if (!me || !other) throw new ApiError(400, "Invalid direct conversation");

      // Check if user can send messages (conversation exists, so allow replies)
      const canSend = await checkCanSendMessage(
        me.role,
        other.role,
        userId,
        other.id,
        true // conversation exists
      );

      if (!canSend) {
        throw new ApiError(403, "You are not allowed to message this user");
      }
    }

    // Parse Mentions
    const mentionRegex = /@(\w+)/g;
    const mentions = [...trimmed.matchAll(mentionRegex)].map(m => m[1].toLowerCase());
    let mentionedUserIds: string[] = [];

    if (mentions.length > 0) {
      const mentionedMembers = convo.members.filter(m => 
        mentions.includes(m.user.id.toLowerCase()) || 
        mentions.includes(m.user.fullName.toLowerCase().replace(/\s+/g, ''))
      );
      mentionedUserIds = mentionedMembers.map(m => m.user.id);
    }

    const msg = await prisma.message.create({
      data: { 
        conversationId, 
        senderId: userId, 
        body: trimmed,
        fileUrl: file?.url,
        fileName: file?.name,
        fileType: file?.type,
        mentionedUserIds
      },
      select: { id: true, body: true, senderId: true, createdAt: true, fileUrl: true, fileName: true, fileType: true, mentionedUserIds: true },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Create notifications for mentions
    if (mentionedUserIds.length > 0) {
      await prisma.notification.createMany({
        data: mentionedUserIds.filter(id => id !== userId).map(id => ({
          organizationId: orgId,
          userId: id,
          type: "MENTION",
          title: `You were mentioned`,
          message: `You were mentioned in a chat by ${member.user.fullName ?? 'someone'}`,
        }))
      });
    }

    // Telegram Relay for DM
    if (convo.type === "DIRECT") {
      const other = convo.members.find(m => m.user.id !== userId)?.user;
      if (other && TELEGRAM_BOT_TOKEN) {
        // Fetch if other has telegram link active
        const tgLink = await prisma.telegramLink.findUnique({ where: { userId: other.id } });
        if (tgLink && tgLink.isActive) {
          try {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: tgLink.telegramChatId,
                text: `[AMGI Chat] New message from ${member.user.fullName}:\n${trimmed}`
              })
            });
          } catch (err) {
            console.error("Failed to relay DM to Telegram", err);
          }
        }
      }
    }

    // ✅ Real-time push
    emitNewMessage(conversationId, msg);

    return msg;
  },

  async markConversationRead(userId: string, orgId: string, conversationId: string) {
    const latestMessage = await prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      select: { id: true }
    });

    if (latestMessage) {
      await prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadMessageId: latestMessage.id }
      });
    }
    return { success: true };
  },

  async deleteMessage(userId: string, orgId: string, messageId: string) {
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true }
    });
    if (!msg) throw new ApiError(404, "Message not found");
    if (msg.conversation.organizationId !== orgId) throw new ApiError(403, "Unauthorized");

    const me = await prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = me?.role === "ADMIN" || me?.role === "SUPER_ADMIN";

    if (msg.senderId !== userId && !isAdmin) {
      throw new ApiError(403, "Not allowed to delete this message");
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() }
    });

    return { success: true };
  },
};
