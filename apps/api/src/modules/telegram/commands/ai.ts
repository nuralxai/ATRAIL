import { Context, Markup } from "telegraf";
import { prisma } from "../../../db.js";
import { getSession, setState } from "../session.js";
import { chat, ChatMessage } from "../../ai/ai.service.js";
import { mainMenu, cancelMenu } from "../keyboards/menus.js";

// In-memory conversation history per Telegram chat (cleared on logout/restart)
const histories = new Map<number, ChatMessage[]>();

export async function handleAiChat(ctx: Context) {
  const chatId = ctx.chat!.id;
  await setState(chatId, "await_ai_msg");
  await ctx.reply(
    "🤖 *AI Assistant (NVIDIA NIM)*\n\nAsk me anything — tasks, meetings, HR, or just say:\n_\"assign bug fix to Sara by Friday\"_\n\nSend /menu to go back.",
    { parse_mode: "Markdown", ...cancelMenu() }
  );
}

export async function handleAiMessage(ctx: Context, text: string) {
  const chatId = ctx.chat!.id;
  const session = await getSession(chatId);
  if (!session) return;

  // Init history
  if (!histories.has(chatId)) histories.set(chatId, []);
  const history = histories.get(chatId)!;

  // Fetch live context
  const [dbUser, pendingTasks, unreadNotifs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      include: { organization: true, profile: true },
    }),
    prisma.task.count({ where: { assignedToId: session.userId, status: { notIn: ["ACCEPTED"] } } }),
    prisma.notification.count({ where: { userId: session.userId, read: false } }),
  ]);

  history.push({ role: "user", content: text });
  const recentHistory = history.slice(-12); // keep last 12 messages

  await ctx.sendChatAction("typing");

  let reply: string;
  try {
    reply = await chat(recentHistory, {
      maxTokens: 500,
      temperature: 0.65,
      systemPrompt: `You are AtrailBot's AI assistant, powered by NVIDIA NIM (LLaMA 3.1).
User Name: ${dbUser?.fullName || session.fullName}
Company Name: ${dbUser?.companyName || dbUser?.organization?.name || "N/A"}
Role: ${dbUser?.role || session.role}
Team Name: ${dbUser?.profile?.department || "N/A"}
Pending tasks: ${pendingTasks} | Unread notifications: ${unreadNotifs}

Your job: help users manage their work naturally via Telegram.
- Answer questions about tasks, meetings, HR policies, attendance.
- If the user describes an action (create task, assign, schedule meeting), extract intent and respond with a JSON block inside triple backticks labeled "action":
  \`\`\`action
  {"intent":"create_task","title":"...","assigneeEmail":"...","deadline":"ISO date or null"}
  \`\`\`
- Be concise (max 3 short paragraphs). Use plain text, avoid markdown symbols.
- Confirm before executing any action.`,
    });
  } catch (err: any) {
    await ctx.reply("⚠️ AI is temporarily unavailable. Please try again in a moment.", mainMenu());
    return;
  }

  history.push({ role: "assistant", content: reply });

  // Check for action block
  const actionMatch = reply.match(/```action\s*([\s\S]*?)\s*```/);
  if (actionMatch) {
    try {
      const action = JSON.parse(actionMatch[1]);
      const cleanReply = reply.replace(/```action[\s\S]*?```/, "").trim();

      if (cleanReply) await ctx.reply(cleanReply);

      await ctx.reply(
        `🔧 Detected action: *${action.intent}*\n\nDetails:\n${JSON.stringify(action, null, 2)}\n\nShall I proceed?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("✅ Yes, do it", `AI_ACTION_${JSON.stringify(action).slice(0, 60)}`),
             Markup.button.callback("❌ No", "CANCEL")],
          ]),
        }
      );
      return;
    } catch {
      // Not valid JSON — fall through
    }
  }

  await ctx.reply(reply, {
    ...Markup.inlineKeyboard([[Markup.button.callback("◀️ Main Menu", "MAIN_MENU")]]),
  });
}

export async function handleNotifications(ctx: Context) {
  const session = await getSession(ctx.chat!.id);
  if (!session) return;

  const notifs = await prisma.notification.findMany({
    where: { userId: session.userId, read: false },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (!notifs.length) {
    await ctx.reply("✅ No unread notifications.", mainMenu());
    return;
  }

  const lines = notifs.map((n, i) => `${i + 1}. *${n.title}*\n   ${n.message}`);
  await ctx.reply(
    `🔔 *Unread Notifications (${notifs.length})*\n\n${lines.join("\n\n")}`,
    { parse_mode: "Markdown", ...mainMenu() }
  );

  // Mark all read
  await prisma.notification.updateMany({
    where: { userId: session.userId, read: false },
    data: { read: true, readAt: new Date() },
  });
}

export function clearHistory(chatId: number) {
  histories.delete(chatId);
}
