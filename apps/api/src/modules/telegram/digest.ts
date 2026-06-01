import { prisma } from "../../db.js";
import { chat } from "../ai/ai.service.js";
import { sendTelegramNotification } from "./notify.js";

async function generateDigestForUser(userId: string, fullName: string, orgId: string): Promise<string> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [pendingTasks, completedTasks, overdueTasks, upcomingMilestones] = await Promise.all([
    prisma.task.count({ where: { assignedToId: userId, status: { notIn: ["ACCEPTED"] } } }),
    prisma.task.count({ where: { assignedToId: userId, status: "ACCEPTED", updatedAt: { gte: weekAgo } } }),
    prisma.task.count({ where: { assignedToId: userId, status: { notIn: ["ACCEPTED"] }, dueAt: { lt: now } } }),
    prisma.milestone.findMany({
      where: { organizationId: orgId, completed: false, dueDate: { gte: now, lte: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) } },
      select: { title: true, dueDate: true },
      take: 3,
    }),
  ]);

  const milestoneText = upcomingMilestones.length
    ? upcomingMilestones.map(m => `- ${m.title} (due ${m.dueDate.toLocaleDateString("en-IN")})`).join("\n")
    : "No upcoming milestones.";

  const summary = await chat(
    [
      {
        role: "user",
        content: `Generate a concise weekly work digest for ${fullName}.
Stats: ${pendingTasks} pending tasks, ${completedTasks} completed this week, ${overdueTasks} overdue.
Upcoming milestones:\n${milestoneText}

Write a short, motivational 3-sentence summary. Then list 2-3 actionable priorities for this week. Keep it friendly and professional. Plain text only.`,
      },
    ],
    { maxTokens: 250, temperature: 0.7 }
  );

  return `📊 *Weekly Digest — ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}*\n\n${summary}\n\n📌 *Quick Stats:*\n✅ Completed: ${completedTasks}\n⏳ Pending: ${pendingTasks}\n🔴 Overdue: ${overdueTasks}`;
}

export async function sendWeeklyDigest() {
  console.log("[WeeklyDigest] Starting digest delivery...");

  // Find all active users with a linked Telegram account
  const users = await prisma.user.findMany({
    where: { isActive: true, telegramLink: { isActive: true } },
    select: { id: true, fullName: true, organizationId: true },
  });

  let sent = 0;
  for (const user of users) {
    try {
      const message = await generateDigestForUser(user.id, user.fullName, user.organizationId);
      const ok = await sendTelegramNotification(user.id, message);
      if (ok) sent++;
    } catch (err: any) {
      console.error(`[WeeklyDigest] Failed for user ${user.id}:`, err?.message);
    }
  }

  console.log(`[WeeklyDigest] Delivered to ${sent}/${users.length} users.`);
}

export function scheduleWeeklyDigest() {
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  // Fire on startup if it's Monday 9am, otherwise schedule for next Monday 9am
  function getNextMondayMs() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon
    const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 0, 0, 0);
    return nextMonday.getTime() - now.getTime();
  }

  const msUntilFirst = getNextMondayMs();
  console.log(`[WeeklyDigest] First digest in ${Math.round(msUntilFirst / 3600000)}h`);

  setTimeout(() => {
    sendWeeklyDigest();
    setInterval(sendWeeklyDigest, WEEK_MS);
  }, msUntilFirst);
}
