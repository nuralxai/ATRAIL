import { prisma } from "../../db.js";
import { ApiError } from "../../utils/errors.js";
import {
  monthRangeInTz,
  minutesBetween,
  startOfDayInTz,
  startOfTodayInTz,
} from "../../utils/dates.js";

function canPunch(role: string) {
  return role === "ELITE" || role === "USER";
}

export const attendanceService = {
  async punchIn(userId: string, orgId: string, role: string) {
    if (!canPunch(role))
      throw new ApiError(403, "Only ELITE and USER can punch in/out");

    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, isActive: true },
      select: { id: true },
    });
    if (!user) throw new ApiError(401, "Unauthorized");

    const date = startOfTodayInTz();
    const now = new Date();

    // Unique(userId, date) exists
    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date } },
    });

    if (existing?.punchInAt)
      throw new ApiError(400, "Already punched in today");

    const record = await prisma.attendance.upsert({
      where: { userId_date: { userId, date } },
      update: { punchInAt: now },
      create: { userId, date, punchInAt: now },
    });

    return record;
  },

  async punchOut(userId: string, orgId: string, role: string) {
    if (!canPunch(role))
      throw new ApiError(403, "Only ELITE and USER can punch in/out");

    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, isActive: true },
      select: { id: true },
    });
    if (!user) throw new ApiError(401, "Unauthorized");

    const date = startOfTodayInTz();
    const now = new Date();

    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date } },
    });

    if (!existing || !existing.punchInAt)
      throw new ApiError(400, "Punch in first");
    if (existing.punchOutAt)
      throw new ApiError(400, "Already punched out today");

    const record = await prisma.attendance.update({
      where: { id: existing.id },
      data: { punchOutAt: now },
    });

    return record;
  },

  async today(userId: string, orgId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, isActive: true },
      select: { id: true },
    });
    if (!user) throw new ApiError(401, "Unauthorized");

    const date = startOfTodayInTz();

    const record = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date } },
    });

    const totalMinutes = minutesBetween(record?.punchInAt, record?.punchOutAt) ?? 0;

    // Frontend expects: { status: "OUT" | "IN", punchedInAt, punchedOutAt, totalMinutes }
    return {
      status: record?.punchInAt ? (record.punchOutAt ? "OUT" : "IN") : "OUT",
      punchedInAt: record?.punchInAt?.toISOString() ?? null,
      punchedOutAt: record?.punchOutAt?.toISOString() ?? null,
      totalMinutes,
    };
  },

  async myHistory(
    userId: string,
    orgId: string,
    q: { month?: string; from?: string; to?: string; days?: string }
  ) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, isActive: true },
      select: { id: true },
    });
    if (!user) throw new ApiError(401, "Unauthorized");

    let start: Date;
    let endExclusive: Date;

    if (q.month) {
      ({ start, endExclusive } = monthRangeInTz(q.month));
    } else if (q.from && q.to) {
      start = startOfDayInTz(q.from);
      // endExclusive = start of next day after "to"
      const endDay = startOfDayInTz(q.to);
      endExclusive = new Date(endDay.getTime() + 24 * 60 * 60 * 1000);
    } else {
      // Support days query param (frontend sends ?days=7)
      const days = q.days ? parseInt(q.days, 10) : 7;
      const today = startOfTodayInTz();
      start = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
      endExclusive = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    }

    const rows = await prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: start, lt: endExclusive },
      },
      orderBy: { date: "desc" },
      select: { id: true, punchInAt: true, punchOutAt: true },
    });

    // Frontend expects: { id, punchedInAt, punchedOutAt, minutes }
    const history = rows.map((r) => ({
      id: r.id,
      punchedInAt: r.punchInAt?.toISOString() ?? "",
      punchedOutAt: r.punchOutAt?.toISOString() ?? null,
      minutes: minutesBetween(r.punchInAt, r.punchOutAt) ?? 0,
    }));

    return { history };
  },

  // Admin dashboard: view all ELITE + USER attendance records
  async adminDashboard(
    viewerId: string,
    orgId: string,
    viewerRole: string,
    filters: {
      userId?: string;
      role?: string;
      from?: string;
      to?: string;
    }
  ) {
    // Only ADMIN and SUPER_ADMIN can access
    if (viewerRole !== "ADMIN" && viewerRole !== "SUPER_ADMIN") {
      throw new ApiError(403, "Only admins can view attendance dashboard");
    }

    const where: any = {
      user: {
        organizationId: orgId,
        isActive: true,
        role: { in: ["ELITE", "USER"] }, // Only show ELITE and USER
      },
    };

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.role) {
      where.user = { ...where.user, role: filters.role };
    }

    if (filters.from || filters.to) {
      const start = filters.from ? startOfDayInTz(filters.from) : undefined;
      const end = filters.to
        ? new Date(startOfDayInTz(filters.to).getTime() + 24 * 60 * 60 * 1000)
        : undefined;
      where.date = {};
      if (start) where.date.gte = start;
      if (end) where.date.lt = end;
    }

    const records = await prisma.attendance.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      take: 500, // Limit for performance
    });

    return {
      records: records.map((r) => ({
        id: r.id,
        userId: r.userId,
        user: r.user,
        date: r.date.toISOString(),
        punchInAt: r.punchInAt?.toISOString() ?? null,
        punchOutAt: r.punchOutAt?.toISOString() ?? null,
        minutes: minutesBetween(r.punchInAt, r.punchOutAt) ?? 0,
      })),
    };
  },
};
