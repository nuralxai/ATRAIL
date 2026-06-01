import { prisma } from "../../db.js";
import { ApiError } from "../../utils/errors.js";
import { CalendarEventType, RecurrenceFrequency, TaskPriority } from "../../prisma-client.js";

export const calendarService = {
  async listEvents(userId: string, orgId: string, projectId?: string) {
    const where: any = {
      organizationId: orgId,
    };

    if (projectId) {
      where.projectId = projectId;
    } else {
      // If no project specified, only show events user is invited to or created
      where.OR = [
        { createdById: userId },
        { attendees: { some: { userId } } },
        { projectId: null }, // Global org events
      ];
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      include: {
        attendees: { include: { user: { select: { id: true, fullName: true } } } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { startAt: "asc" },
    });

    // Also include tasks with due dates in the calendar view
    const taskWhere: any = {
      project: { organizationId: orgId },
      dueAt: { not: null },
    };

    if (projectId) {
      taskWhere.projectId = projectId;
    } else {
      taskWhere.assignedToId = userId;
    }

    const tasksAsEvents = await prisma.task.findMany({
      where: taskWhere,
      select: {
        id: true,
        title: true,
        dueAt: true,
        priority: true,
        status: true,
        projectId: true,
        project: { select: { id: true, name: true } },
      },
    });

    return { events, tasksAsEvents };
  },

  async createEvent(
    actorId: string,
    orgId: string,
    data: {
      title: string;
      description?: string;
      type: CalendarEventType;
      startAt: string;
      endAt?: string;
      allDay?: boolean;
      projectId?: string;
      attendeeIds?: string[];
      color?: string;
    }
  ) {
    const event = await prisma.calendarEvent.create({
      data: {
        organization: { connect: { id: orgId } },
        createdBy: { connect: { id: actorId } },
        project: data.projectId ? { connect: { id: data.projectId } } : undefined,
        title: data.title,
        description: data.description,
        type: data.type,
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : null,
        allDay: data.allDay ?? false,
        color: data.color,
        attendees: data.attendeeIds ? {
          create: data.attendeeIds.map(id => ({ user: { connect: { id } } }))
        } : undefined,
      },
      include: {
        attendees: { include: { user: { select: { id: true, fullName: true } } } },
      }
    });

    return event;
  },

  async createRecurringTask(
    actorId: string,
    orgId: string,
    data: {
      title: string;
      description?: string;
      projectId: string;
      assignedToId: string;
      frequency: RecurrenceFrequency;
      priority?: TaskPriority;
      firstDueAt: string;
      endAt?: string;
    }
  ) {
    const recurring = await prisma.recurringTask.create({
      data: {
        organization: { connect: { id: orgId } },
        createdBy: { connect: { id: actorId } },
        assignedTo: { connect: { id: data.assignedToId } },
        project: { connect: { id: data.projectId } },
        title: data.title,
        description: data.description,
        frequency: data.frequency,
        priority: data.priority ?? "NORMAL",
        nextDueAt: new Date(data.firstDueAt),
        endAt: data.endAt ? new Date(data.endAt) : null,
      }
    });

    return recurring;
  },

  async listRecurringTasks(orgId: string, projectId?: string) {
    return prisma.recurringTask.findMany({
      where: {
        organizationId: orgId,
        projectId,
        isActive: true,
      }
    });
  },

  /**
   * Background-style sync: Check all recurring tasks and generate actual Task instances if needed
   */
  async syncRecurringTasks(orgId: string) {
    const now = new Date();
    const recurring = await prisma.recurringTask.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        nextDueAt: { lte: now }
      }
    });

    const results = [];

    for (const rt of recurring) {
      // Create the live task
      const task = await prisma.task.create({
        data: {
          projectId: rt.projectId,
          assignedToId: rt.assignedToId,
          assignedById: rt.createdById,
          title: `[RECURRING] ${rt.title}`,
          description: rt.description,
          priority: rt.priority,
          dueAt: rt.nextDueAt,
          status: "ASSIGNED",
        }
      });

      // Calculate next occurrence
      let nextDue = new Date(rt.nextDueAt);
      if (rt.frequency === "DAILY") nextDue.setDate(nextDue.getDate() + 1);
      else if (rt.frequency === "WEEKLY") nextDue.setDate(nextDue.getDate() + 7);
      else if (rt.frequency === "MONTHLY") nextDue.setMonth(nextDue.getMonth() + 1);
      else if (rt.frequency === "YEARLY") nextDue.setFullYear(nextDue.getFullYear() + 1);

      // Check if we passed the end date
      const isActive = rt.endAt ? nextDue <= rt.endAt : true;

      await prisma.recurringTask.update({
        where: { id: rt.id },
        data: {
          nextDueAt: nextDue,
          isActive,
        }
      });

      results.push(task);
    }

    return results;
  }
};
