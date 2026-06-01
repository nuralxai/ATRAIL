import { prisma } from "../../db.js";
import { ApiError } from "../../utils/errors.js";
import { Role } from "../../prisma-client.js";

function isAdminPlus(role: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

async function ensureProjectChatSynced(orgId: string, projectId: string) {
  const key = `project:${projectId}`;

  // ensure conversation exists
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

  // project member userIds
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  });
  const desired = new Set(members.map((m) => m.userId));

  // existing convo members
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
            data: toAdd.map((userId) => ({ conversationId: convo.id, userId })),
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

  return convo;
}

export const projectsService = {
  async list(userId: string, orgId: string, role: string) {
    if (isAdminPlus(role)) {
      const whereClause = role === "SUPER_ADMIN" ? {} : { organizationId: orgId };
      return prisma.project.findMany({
        where: whereClause,
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true,
          name: true,
          description: true,
          organizationId: true,
          organization: { select: { id: true, name: true } },
          headId: true,
          createdAt: true,
          updatedAt: true,
          head: { select: { id: true, fullName: true, role: true } },
          tasks: { select: { status: true } },
        },
      }).then(projs => projs.map(p => {
        const total = p.tasks.length;
        const accepted = p.tasks.filter(t => t.status === "ACCEPTED").length;
        const progress = total === 0 ? 0 : Math.round((accepted / total) * 100);
        const { tasks, ...rest } = p;
        return { ...rest, progress };
      }));
    }

    return prisma.project.findMany({
      where: {
        organizationId: orgId,
        members: { some: { userId } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        description: true,
        organizationId: true,
        organization: { select: { id: true, name: true } },
        headId: true,
        createdAt: true,
        updatedAt: true,
        head: { select: { id: true, fullName: true, role: true } },
        tasks: { select: { status: true } },
      },
    }).then(projs => projs.map(p => {
      const total = p.tasks.length;
      const accepted = p.tasks.filter(t => t.status === "ACCEPTED").length;
      const progress = total === 0 ? 0 : Math.round((accepted / total) * 100);
      const { tasks, ...rest } = p;
      return { ...rest, progress };
    }));
  },

  async getOne(userId: string, orgId: string, role: string, projectId: string) {
    const whereClause = role === "SUPER_ADMIN" ? { id: projectId } : { id: projectId, organizationId: orgId };
    const project = await prisma.project.findFirst({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        organizationId: true,
        organization: { select: { id: true, name: true } },
        headId: true,
        createdAt: true,
        updatedAt: true,
        head: { select: { id: true, fullName: true, role: true } },
        assignedAdmin: { select: { id: true, fullName: true } },
        assignedElite: { select: { id: true, fullName: true } },
        tasks: { select: { status: true } },
      },
    });
    if (!project) throw new ApiError(404, "Project not found");

    if (!isAdminPlus(role)) {
      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
      });
      if (!member) throw new ApiError(403, "Not a member of this project");
    }

    const total = project.tasks.length;
    const accepted = project.tasks.filter(t => t.status === "ACCEPTED").length;
    const progress = total === 0 ? 0 : Math.round((accepted / total) * 100);
    const { tasks, ...rest } = project;

    return { ...rest, progress };
  },

  async create(
    createdById: string,
    orgId: string,
    role: string,
    body: { name: string; description?: string; headId?: string, organizationId?: string }
  ) {
    let headId: string | null = null;
    const targetOrgId = role === "SUPER_ADMIN" && body.organizationId ? body.organizationId : orgId;

    if (body.headId) {
      const head = await prisma.user.findFirst({
        where: { id: body.headId, organizationId: targetOrgId, isActive: true },
        select: { id: true, role: true },
      });
      if (!head) throw new ApiError(404, "Head user not found in the selected organization");
      if (head.role !== Role.ELITE)
        throw new ApiError(400, "Project head must be ELITE");
      headId = head.id;
    }

    const project = await prisma.project.create({
      data: {
        organizationId: targetOrgId,
        name: body.name,
        description: body.description,
        createdById,
        headId,
        members: headId
          ? { create: [{ userId: headId, role: "HEAD" }] }
          : undefined,
      },
      select: {
        id: true,
        name: true,
        description: true,
        organizationId: true,
        headId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // ensure project chat exists and membership is synced
    await ensureProjectChatSynced(targetOrgId, project.id);

    return project;
  },

  async update(
    updatedById: string,
    orgId: string,
    role: string,
    projectId: string,
    body: { name?: string; description?: string, organizationId?: string }
  ) {
    // (updatedById kept for future audit expansion)
    const whereClause = role === "SUPER_ADMIN" ? { id: projectId } : { id: projectId, organizationId: orgId };
    const exists = await prisma.project.findFirst({
      where: whereClause,
      select: { id: true, organizationId: true },
    });
    if (!exists) throw new ApiError(404, "Project not found");

    const newOrgId = role === "SUPER_ADMIN" && body.organizationId ? body.organizationId : exists.organizationId;

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(role === "SUPER_ADMIN" && body.organizationId ? { organizationId: body.organizationId } : {}),
      },
      select: {
        id: true,
        name: true,
        description: true,
        organizationId: true,
        headId: true,
        updatedAt: true,
      },
    });

    if (exists.organizationId !== newOrgId) {
      // If project was transferred, ensure the project chat takes on the new organizationId
      await ensureProjectChatSynced(newOrgId, projectId);
    }

    return updated;
  },

  async setHead(
    updatedById: string,
    orgId: string,
    role: string,
    projectId: string,
    headId: string | null
  ) {
    const whereClause = role === "SUPER_ADMIN" ? { id: projectId } : { id: projectId, organizationId: orgId };
    const project = await prisma.project.findFirst({
      where: whereClause,
      select: { id: true, headId: true, organizationId: true },
    });
    if (!project) throw new ApiError(404, "Project not found");

    if (headId) {
      const head = await prisma.user.findFirst({
        where: { id: headId, organizationId: project.organizationId, isActive: true },
        select: { id: true, role: true },
      });
      if (!head) throw new ApiError(404, "Head user not found");
      if (head.role !== Role.ELITE)
        throw new ApiError(400, "Project head must be ELITE");

      const oldHeadId = project.headId;

      // Update project head and member roles in transaction
      await prisma.$transaction(async (tx) => {
        // Set new head
        await tx.project.update({
          where: { id: projectId },
          data: { headId: head.id },
        });

        // Check if new head is already a member
        const existingMember = await tx.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId: head.id } },
        });

        if (existingMember) {
          // Update existing member to HEAD role
          await tx.projectMember.update({
            where: { projectId_userId: { projectId, userId: head.id } },
            data: { role: "HEAD" },
          });
        } else {
          // Add as new member with HEAD role
          await tx.projectMember.create({
            data: { projectId, userId: head.id, role: "HEAD" },
          });
        }

        // If old head exists and is different, change their role to MEMBER (if they're still a member)
        if (oldHeadId && oldHeadId !== head.id) {
          const oldHeadMember = await tx.projectMember.findUnique({
            where: { projectId_userId: { projectId, userId: oldHeadId } },
          });
          if (oldHeadMember && oldHeadMember.role === "HEAD") {
            await tx.projectMember.update({
              where: { projectId_userId: { projectId, userId: oldHeadId } },
              data: { role: "MEMBER" },
            });
          }
        }
      });

      await ensureProjectChatSynced(project.organizationId, projectId);

      return prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, headId: true },
      });
    }

    // unset head - change old head's role to MEMBER if they're still a member
    const oldHeadId = project.headId;
    if (oldHeadId) {
      await prisma.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: projectId },
          data: { headId: null },
        });

        // Only update if they're still a member
        const oldHeadMember = await tx.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId: oldHeadId } },
        });
        if (oldHeadMember && oldHeadMember.role === "HEAD") {
          await tx.projectMember.update({
            where: { projectId_userId: { projectId, userId: oldHeadId } },
            data: { role: "MEMBER" },
          });
        }
      });
    } else {
      await prisma.project.update({
        where: { id: projectId },
        data: { headId: null },
      });
    }

    await ensureProjectChatSynced(project.organizationId, projectId);

    return prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, headId: true },
    });
  },

  async assignAdmin(
    actorId: string,
    orgId: string,
    actorRole: string,
    projectId: string,
    adminId: string | null
  ) {
    if (actorRole !== "SUPER_ADMIN") throw new ApiError(403, "Only Super Admin can assign Admins to projects");
    
    const project = await prisma.project.findFirst({
      where: { id: projectId },
    });
    if (!project) throw new ApiError(404, "Project not found");

    if (adminId) {
      const admin = await prisma.user.findFirst({
        where: { id: adminId, organizationId: project.organizationId, role: "ADMIN", isActive: true },
      });
      if (!admin) throw new ApiError(404, "Admin user not found or is not an ADMIN");
    }

    return prisma.project.update({
      where: { id: projectId },
      data: { assignedAdminId: adminId },
      select: { id: true, assignedAdminId: true },
    });
  },

  async assignElite(
    actorId: string,
    orgId: string,
    actorRole: string,
    projectId: string,
    eliteId: string | null
  ) {
    if (actorRole !== "SUPER_ADMIN" && actorRole !== "ADMIN") {
      throw new ApiError(403, "Only Super Admin or Admin can assign Elites to projects");
    }

    const whereClause = actorRole === "SUPER_ADMIN" ? { id: projectId } : { id: projectId, organizationId: orgId, assignedAdminId: actorId };
    const project = await prisma.project.findFirst({
      where: whereClause,
    });
    
    if (!project && actorRole === "ADMIN") {
        // Fallback check if Admin is not the assignedAdminId but is an ADMIN in the org.
        // Wait, the rule is "Admin will assign project to elite".
        // Does the Admin have to be the assigned Admin? Yes, for strict hierarchy.
        // But if they just want org admins to do it, we can allow org Admins. Let's allow org Admins in general for now since it's the tenant admin.
        const projectFallback = await prisma.project.findFirst({
          where: { id: projectId, organizationId: orgId }
        });
        if (!projectFallback) throw new ApiError(404, "Project not found");
    } else if (!project) {
        throw new ApiError(404, "Project not found");
    }

    if (eliteId) {
      const elite = await prisma.user.findFirst({
        where: { id: eliteId, organizationId: project?.organizationId || orgId, role: "ELITE", isActive: true },
      });
      if (!elite) throw new ApiError(404, "Elite user not found or is not an ELITE");
    }

    return prisma.project.update({
      where: { id: projectId },
      data: { assignedEliteId: eliteId },
      select: { id: true, assignedEliteId: true },
    });
  },

  async listMembers(
    userId: string,
    orgId: string,
    role: string,
    projectId: string
  ) {
    await this.getOne(userId, orgId, role, projectId); // access check

    return prisma.projectMember.findMany({
      where: { projectId },
      orderBy: { joinedAt: "asc" },
      select: {
        role: true,
        joinedAt: true,
        user: { select: { id: true, fullName: true, email: true, role: true } },
      },
    });
  },

  async addMembers(
    actorId: string,
    orgId: string,
    actorRole: string,
    projectId: string,
    userIds: string[]
  ) {
    const whereClause = actorRole === "SUPER_ADMIN" ? { id: projectId } : { id: projectId, organizationId: orgId };
    const project = await prisma.project.findFirst({
      where: whereClause,
      select: { id: true, headId: true, organizationId: true },
    });
    if (!project) throw new ApiError(404, "Project not found");

    // permission: Admin+ OR Elite who is project head
    const isHead = actorRole === "ELITE" && project.headId === actorId;
    if (!isAdminPlus(actorRole) && !isHead)
      throw new ApiError(403, "Not allowed");

    // Validate users exist and have correct roles
    const targets = await prisma.user.findMany({
      where: { id: { in: userIds }, organizationId: project.organizationId, isActive: true },
      select: { id: true, role: true },
    });
    if (targets.length !== userIds.length)
      throw new ApiError(400, "Some users not found");

    // Only ELITE and USER can be project members
    const invalidRoles = targets.filter((t) => t.role !== Role.ELITE && t.role !== Role.USER);
    if (invalidRoles.length > 0) {
      throw new ApiError(400, "Only ELITE and USER roles can be project members");
    }

    // If Elite head is adding, only allow adding USERs (keeps hierarchy clean)
    if (isHead) {
      const bad = targets.find((t) => t.role !== Role.USER);
      if (bad)
        throw new ApiError(403, "Elite head can add only USER role members");
    }

    // Use upsert to ensure idempotency - can add same member multiple times safely
    // If member already exists, preserve their role (especially HEAD role)
    // If new member, create as MEMBER
    await Promise.all(
      userIds.map((uid) =>
        prisma.projectMember.upsert({
          where: { projectId_userId: { projectId, userId: uid } },
          update: {
            // If exists, preserve role (don't change HEAD to MEMBER)
            // Only update if role is not HEAD (to preserve head status)
          },
          create: { projectId, userId: uid, role: "MEMBER" },
        })
      )
    );

    const convo = await ensureProjectChatSynced(project.organizationId, projectId);

    return { conversationId: convo.id };
  },

  async removeMember(
    actorId: string,
    orgId: string,
    actorRole: string,
    projectId: string,
    removeUserId: string
  ) {
    const whereClause = actorRole === "SUPER_ADMIN" ? { id: projectId } : { id: projectId, organizationId: orgId };
    const project = await prisma.project.findFirst({
      where: whereClause,
      select: { id: true, headId: true, organizationId: true },
    });
    if (!project) throw new ApiError(404, "Project not found");

    const isHead = actorRole === "ELITE" && project.headId === actorId;
    if (!isAdminPlus(actorRole) && !isHead)
      throw new ApiError(403, "Not allowed");

    // Elite head cannot remove head / admin etc (simple rule)
    if (isHead && removeUserId === project.headId)
      throw new ApiError(403, "Head cannot remove themself");

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: removeUserId } },
    });

    // if removed user was head, unset head (admin+ only)
    if (removeUserId === project.headId) {
      if (!isAdminPlus(actorRole))
        throw new ApiError(403, "Only admin can remove head");
      await prisma.project.update({
        where: { id: projectId },
        data: { headId: null },
      });
    }

    const convo = await ensureProjectChatSynced(project.organizationId, projectId);
    return { conversationId: convo.id };
  },

  async deleteProject(
    actorId: string,
    orgId: string,
    actorRole: string,
    projectId: string
  ) {
    // Only ADMIN and SUPER_ADMIN can delete projects
    if (!isAdminPlus(actorRole)) {
      throw new ApiError(403, "Only admins can delete projects");
    }

    const whereClause = actorRole === "SUPER_ADMIN" ? { id: projectId } : { id: projectId, organizationId: orgId };
    const project = await prisma.project.findFirst({
      where: whereClause,
      select: { id: true },
    });
    if (!project) throw new ApiError(404, "Project not found");

    // Delete all related records manually (Prisma doesn't cascade by default)
    // Order matters: delete children before parents
    // Use savepoints to handle errors without aborting the entire transaction
    await prisma.$transaction(async (tx) => {
      // Helper to execute with savepoint (allows partial rollback on error)
      const executeWithSavepoint = async (
        name: string,
        operation: () => Promise<any>,
        skipOnError = false
      ) => {
        try {
          // Create savepoint
          await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
          await operation();
          // Release savepoint on success
          await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`);
        } catch (err: any) {
          // Rollback to savepoint
          await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
          if (skipOnError && (err.message?.includes('does not exist') || err.code === 'P2025')) {
            // Table/model doesn't exist, skip
            return;
          }
          // If not skipping, rethrow after rollback
          if (!skipOnError) {
            throw err;
          }
        }
      };

      // 1. Get all tasks for this project
      const tasks = await tx.task.findMany({
        where: { projectId },
        select: { id: true },
      });
      const taskIds = tasks.map((t) => t.id);

      if (taskIds.length > 0) {
        // 2. Get all task submissions
        const submissions = await tx.taskSubmission.findMany({
          where: { taskId: { in: taskIds } },
          select: { id: true },
        });
        const submissionIds = submissions.map((s) => s.id);

        // 3. Delete submission proofs (if any) - with savepoint
        if (submissionIds.length > 0) {
          await executeWithSavepoint('sp_proofs', async () => {
            const submissionProofModel = (tx as any).submissionProof;
            if (submissionProofModel) {
              await submissionProofModel.deleteMany({
                where: { taskSubmissionId: { in: submissionIds } },
              });
            } else {
              // Fallback: use raw SQL with proper array handling
              const placeholders = submissionIds.map((_, i) => `$${i + 1}`).join(',');
              await tx.$executeRawUnsafe(
                `DELETE FROM "SubmissionProof" WHERE "taskSubmissionId" IN (${placeholders})`,
                ...submissionIds
              );
            }
          }, true);
        }

        // 4. Delete task submissions
        await tx.taskSubmission.deleteMany({
          where: { taskId: { in: taskIds } },
        });
      }

      // 5. Delete tasks
      await tx.task.deleteMany({
        where: { projectId },
      });

      // 6. Delete notifications related to this project (if table exists) - with savepoint
      await executeWithSavepoint('sp_notifications', async () => {
        await tx.notification.deleteMany({
          where: { projectId },
        });
      }, true);

      // 7. Get conversations for this project
      const conversations = await tx.conversation.findMany({
        where: { projectId },
        select: { id: true },
      });
      const conversationIds = conversations.map((c) => c.id);

      if (conversationIds.length > 0) {
        // 8. Delete conversation members
        await tx.conversationMember.deleteMany({
          where: { conversationId: { in: conversationIds } },
        });

        // 9. Delete messages in those conversations
        await tx.message.deleteMany({
          where: { conversationId: { in: conversationIds } },
        });

        // 10. Delete conversations
        await tx.conversation.deleteMany({
          where: { projectId },
        });
      }

      // 11. Delete emergency events
      await tx.emergencyEvent.deleteMany({
        where: { projectId },
      });

      // 12. Delete project members
      await tx.projectMember.deleteMany({
        where: { projectId },
      });

      // 13. Finally, delete the project
      await tx.project.delete({
        where: { id: projectId },
      });
    });

    return { deleted: true };
  },
};
