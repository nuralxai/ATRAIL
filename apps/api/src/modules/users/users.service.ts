import { prisma } from "../../db.js";
import { ApiError } from "../../utils/errors.js";
import { canMessage } from "@amgi/shared";
import { UserStatus, Role, Gender } from "../../prisma-client.js";
import bcrypt from "bcryptjs";
import { hrService } from "../hr/hr.service.js";

export const usersService = {
  async createUser(data: any, orgId: string) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ApiError(400, "User with this email already exists");

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        organizationId: orgId,
        fullName: data.fullName,
        email: data.email,
        passwordHash,
        role: data.role as Role,
        companyName: data.companyName,
        phone: data.phone,
        status: UserStatus.ACTIVE,
        isActive: true,
      },
      select: { id: true, fullName: true, email: true, role: true },
    });

    await hrService.allocateDefaultLeaveBalances(user.id);

    return user;
  },

  async changeRole(actorId: string, actorRole: string, targetUserId: string, newRole: string, orgId: string) {
    if (actorId === targetUserId) throw new ApiError(400, "Cannot change your own role");
    
    const target = await prisma.user.findFirst({
      where: { id: targetUserId, organizationId: orgId }
    });
    if (!target) throw new ApiError(404, "User not found");

    const validRoles = Object.values(Role);
    if (!validRoles.includes(newRole as any)) throw new ApiError(400, "Invalid role specified");

    // Enforce Hierarchy for role changes
    if (actorRole === "SUPER_ADMIN") {
      // Super Admin can change any role
    } else if (actorRole === "ADMIN") {
      // Admin can only manage ELITE, USER, INTERN
      if (target.role === "SUPER_ADMIN" || target.role === "ADMIN" || target.role === "TENANT") {
        throw new ApiError(403, "Admins cannot change roles of Super Admins, Admins, or Tenants");
      }
      if (newRole === "SUPER_ADMIN" || newRole === "ADMIN" || newRole === "TENANT") {
        throw new ApiError(403, "Admins can only assign ELITE, USER, or INTERN roles");
      }
    } else if (actorRole === "ELITE") {
      // Elite can only manage USER, INTERN
      if (target.role !== "USER" && target.role !== "INTERN") {
        throw new ApiError(403, "Elites can only change roles of Users and Interns");
      }
      if (newRole !== "USER" && newRole !== "INTERN") {
        throw new ApiError(403, "Elites can only assign USER or INTERN roles");
      }
    } else {
      throw new ApiError(403, "You do not have permission to change roles");
    }

    return prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole as Role },
      select: { id: true, fullName: true, email: true, role: true }
    });
  },

  async listMessagable(userId: string, orgId: string) {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, organizationId: true },
    });
    if (!me || me.organizationId !== orgId)
      throw new ApiError(401, "Unauthorized");

    const users = await prisma.user.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, fullName: true, email: true, role: true },
    });

    return users
      .filter((u) => u.id !== userId)
      .filter((u) => canMessage(me.role as any, u.role as any))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  async listAll(orgId: string) {
    return prisma.user.findMany({
      where: { organizationId: orgId, isActive: true },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async listPending(orgId: string) {
    return prisma.user.findMany({
      where: { organizationId: orgId, status: UserStatus.PENDING },
      select: {
        id: true,
        fullName: true,
        email: true,
        companyName: true,
        phone: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async approveUser(userId: string, orgId: string, role: string, actorRole: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });
    if (!user) throw new ApiError(404, "User not found");
    if (user.status !== UserStatus.PENDING)
      throw new ApiError(400, "User is not in PENDING status");

    const validRoles = Object.values(Role);
    if (!validRoles.includes(role as any))
      throw new ApiError(400, "Invalid role specified");

    // Strictly enforce Role assignment Hierarchy
    if (actorRole === "SUPER_ADMIN") {
      // Can assign anything
    } else if (actorRole === "ADMIN") {
      if (role !== "ELITE" && role !== "USER") {
        throw new ApiError(403, "Admins can only assign ELITE and USER roles");
      }
    } else if (actorRole === "ELITE") {
      if (role !== "INTERN" && role !== "USER") {
        throw new ApiError(403, "Elites can only assign INTERN and USER roles");
      }
    } else {
      throw new ApiError(403, "You do not have permission to approve users");
    }

    const userUpdate = await prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.ACTIVE,
        role: role as Role,
        isActive: true,
      },
    });

    await hrService.allocateDefaultLeaveBalances(userUpdate.id);

    return userUpdate;
  },

  // Admin/Super Admin can view all users grouped by role and project assignment
  async listOrgDirectory(orgId: string) {
    const users = await prisma.user.findMany({
      where: { organizationId: orgId, isActive: true },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        phone: true,
        companyName: true,
        status: true,
        createdAt: true,
        projectMembers: {
          select: {
            role: true,
            project: { select: { id: true, name: true } }
          }
        },
        headedProjects: {
          select: { id: true, name: true }
        },
        reportsTo: {
          select: { id: true, fullName: true, role: true }
        }
      },
      orderBy: [{ role: "asc" }, { fullName: "asc" }]
    });

    // Group by role for structured display
    const grouped: Record<string, typeof users> = {};
    for (const user of users) {
      const roleKey = user.role as string;
      if (!grouped[roleKey]) grouped[roleKey] = [];
      grouped[roleKey].push(user);
    }

    return { users, grouped };
  },

  // Update who a user reports to (Elite assigns users; Admin assigns Elites)
  async assignReportsTo(actorId: string, targetUserId: string, reportsToId: string, orgId: string) {
    const [actor, target, reportsTo] = await Promise.all([
      prisma.user.findUnique({ where: { id: actorId }, select: { role: true, organizationId: true } }),
      prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true, organizationId: true } }),
      prisma.user.findUnique({ where: { id: reportsToId }, select: { role: true, organizationId: true } }),
    ]);

    if (!actor || actor.organizationId !== orgId) throw new ApiError(401, "Unauthorized");
    if (!target || target.organizationId !== orgId) throw new ApiError(404, "Target user not found");
    if (!reportsTo || reportsTo.organizationId !== orgId) throw new ApiError(404, "Reporting user not found");

    if (actor.role === "SUPER_ADMIN") {
      // Super Admin can do anything
    } else if (actor.role === "ADMIN") {
      if (target.role !== "ELITE") throw new ApiError(403, "Admins can only assign Elites");
    } else if (actor.role === "ELITE") {
      if (target.role !== "USER" && target.role !== "INTERN") throw new ApiError(403, "Elites can only assign Interns or Users");
    } else {
      throw new ApiError(403, "Insufficient permissions to assign reports");
    }

    return prisma.user.update({
      where: { id: targetUserId },
      data: { reportsToId: reportsToId },
      select: { id: true, fullName: true, role: true, reportsToId: true }
    });
  },

  async updateFcmToken(userId: string, token: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { fcmToken: token },
      select: { id: true, fcmToken: true }
    });
  },

  async updateExternalReminders(userId: string, enabled: boolean) {
    return prisma.user.update({
      where: { id: userId },
      data: { externalReminders: enabled },
      select: { id: true, externalReminders: true }
    });
  },

  async getMyProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        reportsTo: { select: { id: true, fullName: true, role: true } },
        skills: { include: { skill: true } }
      }
    });
    if (!user) throw new ApiError(404, "User not found");

    const isComplete = !!(
      user.fullName &&
      user.phone &&
      user.profile?.gender &&
      user.dob &&
      user.companyName &&
      user.profile?.department &&
      user.skills.length > 0 &&
      (["SUPER_ADMIN", "ADMIN", "TENANT"].includes(user.role) || user.reportsToId)
    );

    return {
      user,
      isComplete
    };
  },

  async updateMyProfile(userId: string, data: any) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, "User not found");

    const { fullName, gender, dob, companyName, department, reportsToId, skills, phone } = data;

    // Update main User fields (excluding role/email/status for security)
    await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: fullName || undefined,
        dob: dob ? new Date(dob) : undefined,
        companyName: companyName || undefined,
        reportsToId: reportsToId || undefined,
        phone: phone || undefined,
      }
    });

    // Update Profile (department / team name, gender)
    await prisma.userProfile.upsert({
      where: { userId },
      update: { 
        department: department || undefined,
        gender: gender as Gender || undefined
      },
      create: { 
        userId, 
        department: department || "",
        gender: gender as Gender || "PREFER_NOT_TO_SAY"
      }
    });

    // Sync Skills
    if (Array.isArray(skills)) {
      await prisma.userSkill.deleteMany({ where: { userId } });
      for (const skillName of skills) {
        if (!skillName || typeof skillName !== "string") continue;
        const normalized = skillName.trim();
        if (!normalized) continue;

        let skill = await prisma.skill.findFirst({
          where: { name: normalized, organizationId: user.organizationId }
        });
        if (!skill) {
          skill = await prisma.skill.create({
            data: { name: normalized, organizationId: user.organizationId }
          });
        }
        await prisma.userSkill.create({
          data: { userId, skillId: skill.id, proficiencyLevel: 3 }
        });
      }
    }

    return this.getMyProfile(userId);
  },

  async listManagers(userId: string, orgId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, "User not found");

    let allowedRoles: Role[] = [];
    if (user.role === "USER" || user.role === "INTERN") {
      allowedRoles = ["ELITE", "ADMIN", "SUPER_ADMIN"];
    } else if (user.role === "ELITE") {
      allowedRoles = ["ADMIN", "SUPER_ADMIN"];
    } else {
      allowedRoles = []; // Admins/Super Admins don't select a manager
    }

    return prisma.user.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        role: { in: allowedRoles },
        id: { not: userId }
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        email: true
      },
      orderBy: { fullName: "asc" }
    });
  }
};

