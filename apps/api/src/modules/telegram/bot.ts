import { Telegraf, Context } from "telegraf";
import { getSession, clearSession, setState } from "./session.js";
import { requireLinked } from "./auth.middleware.js";
import { handleStart, handleLogout, handleAuthFlow } from "./commands/start.js";
import { handleTasksList, handleTaskCreate, handleTaskCreationFlow, handleTaskAction } from "./commands/tasks.js";
import { handleAiChat, handleAiMessage, handleNotifications, clearHistory } from "./commands/ai.js";
import { handlePasswordChangeFlow } from "./commands/password.js";
import { mainMenu, cancelMenu } from "./keyboards/menus.js";
import { setBotInstance } from "./notify.js";
import { prisma } from "../../db.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set in environment");

export const bot = new Telegraf(TOKEN);

// Register bot instance for push notifications
setBotInstance(bot);

// ── Commands ─────────────────────────────────────────────────────────────────

bot.command("start", handleStart);
bot.command("logout", handleLogout);

bot.command("menu", async (ctx) => {
  const session = await getSession(ctx.chat.id);
  if (!session?.userId) {
    await handleStart(ctx);
    return;
  }
  await ctx.reply("Choose an action:", mainMenu());
});

bot.command("tasks", requireLinked, handleTasksList);
bot.command("ai",    requireLinked, handleAiChat);
bot.command("notif", requireLinked, handleNotifications);
bot.command("password", requireLinked, async (ctx) => {
  const chatId = ctx.chat.id;
  await setState(chatId, "password_change_await_totp");
  await ctx.reply(
    "🔐 *Password Change Request*\n\nPlease enter your 6-digit TOTP code from your authenticator app to verify your identity:",
    { parse_mode: "Markdown", ...cancelMenu() }
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    "*AtrailBot Commands*\n\n" +
    "/start — Login / link your Atrail account\n" +
    "/menu — Show main menu\n" +
    "/tasks — View your pending tasks\n" +
    "/ai — Open AI assistant\n" +
    "/notif — View unread notifications\n" +
    "/logout — Log out\n\n" +
    "You can also use the inline buttons to navigate.",
    { parse_mode: "Markdown" }
  );
});

// ── Callback Queries ──────────────────────────────────────────────────────────

bot.action("MAIN_MENU", async (ctx) => {
  await ctx.answerCbQuery();
  const session = await getSession(ctx.chat!.id);
  if (!session?.userId) { await handleStart(ctx as any); return; }
  await ctx.reply("Choose an action:", mainMenu());
});

bot.action("TASKS_LIST", requireLinked, async (ctx) => {
  await ctx.answerCbQuery();
  await handleTasksList(ctx as any);
});

bot.action("TASK_CREATE", requireLinked, async (ctx) => {
  await ctx.answerCbQuery();
  await handleTaskCreate(ctx as any);
});

bot.action("AI_CHAT", requireLinked, async (ctx) => {
  await ctx.answerCbQuery();
  await handleAiChat(ctx as any);
});

bot.action("NOTIFS_LIST", requireLinked, async (ctx) => {
  await ctx.answerCbQuery();
  await handleNotifications(ctx as any);
});

bot.action("LOGOUT", async (ctx) => {
  await ctx.answerCbQuery();
  clearHistory(ctx.chat!.id);
  await handleLogout(ctx as any);
});

// ── CONFIRM_LINK: user confirmed their details — create TelegramLink record ───
bot.action("CONFIRM_LINK", async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat!.id;
  const session = await getSession(chatId);

  if (session?.state !== "await_confirm" || !session.pendingData?.userId) {
    await ctx.reply("Session expired. Please send /start to try again.");
    return;
  }

  const userId = session.pendingData.userId;
  const tgUser = ctx.from;

  try {
    // Upsert the TelegramLink record
    await prisma.telegramLink.upsert({
      where: { userId },
      update: {
        telegramChatId: String(chatId),
        telegramUsername: tgUser?.username ?? null,
        isActive: true,
        linkedAt: new Date(),
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        telegramChatId: String(chatId),
        telegramUsername: tgUser?.username ?? null,
        isActive: true,
      },
    });

    // Fully activate session now that identity is confirmed
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, organizationId: true, role: true, email: true },
    });

    await getSession(chatId); // refresh
    const { setSession } = await import("./session.js");
    await setSession(chatId, {
      userId,
      orgId: user?.organizationId ?? "",
      role: user?.role ?? "",
      fullName: user?.fullName ?? "",
      email: user?.email ?? "",
      state: "idle",
    });

    await ctx.reply(
      `🎉 *Telegram linked successfully!*\n\nWelcome, *${user?.fullName}*!\n\nYou'll now receive renewal alerts, task notifications, and can use the bot for quick actions.\n\nUse /menu to get started.`,
      { parse_mode: "Markdown", ...mainMenu() }
    );
  } catch (err: any) {
    console.error("[AtrailBot] CONFIRM_LINK error:", err?.message);
    await ctx.reply("❌ Something went wrong linking your account. Please try /start again.");
  }
});

bot.action("CANCEL", async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat!.id;
  await setState(chatId, undefined);
  const session = await getSession(chatId);
  if (session?.userId) {
    await ctx.reply("❌ Cancelled.", mainMenu());
  } else {
    await ctx.reply("❌ Cancelled. Send /start to log in.");
  }
});

// Task action buttons: TASK_START_<shortId> / TASK_SUBMIT_<shortId>
bot.action(/^TASK_START_(.{8})$/, requireLinked, async (ctx) => {
  await ctx.answerCbQuery();
  const shortId = (ctx.match as RegExpMatchArray)[1];
  await handleTaskAction(ctx as any, "START", shortId);
});

bot.action(/^TASK_SUBMIT_(.{8})$/, requireLinked, async (ctx) => {
  await ctx.answerCbQuery();
  const shortId = (ctx.match as RegExpMatchArray)[1];
  await handleTaskAction(ctx as any, "SUBMIT", shortId);
});

// Meetings placeholder (Phase 2)
bot.action("MEETINGS_LIST", requireLinked, async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    "📅 *Meetings*\n\nMeeting management coming soon!\n\nYour upcoming calendar events will appear here.",
    { parse_mode: "Markdown", ...mainMenu() }
  );
});

// ── Text Message Router ───────────────────────────────────────────────────────

bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;

  // Skip commands (they're handled above)
  if (text.startsWith("/")) return;

  const session = await getSession(chatId);
  const state = session?.state;

  // Not logged in or in email/totp auth flow
  if (!session || !session.userId || state === "await_email" || state === "await_totp") {
    await handleAuthFlow(ctx as any, text);
    return;
  }

  // Password change flow
  if (state?.startsWith("password_change_")) {
    await handlePasswordChangeFlow(ctx as any, text);
    return;
  }

  // Trigger password change by typing "password change"
  if (text.trim().toLowerCase() === "password change") {
    await setState(chatId, "password_change_await_totp");
    await ctx.reply(
      "🔐 *Password Change Request*\n\nPlease enter your 6-digit TOTP code from your authenticator app to verify your identity:",
      { parse_mode: "Markdown", ...cancelMenu() }
    );
    return;
  }

  // AI conversation
  if (state === "await_ai_msg") {
    await handleAiMessage(ctx as any, text);
    return;
  }

  // Task creation flow
  if (state?.startsWith("await_task_")) {
    await handleTaskCreationFlow(ctx as any, text);
    return;
  }

  // Default fallback — show menu
  await ctx.reply(
    "Use the menu below to navigate, or send /help for all commands.",
    mainMenu()
  );
});

// ── Error Handler ─────────────────────────────────────────────────────────────

bot.catch((err: any, ctx) => {
  console.error(`[AtrailBot] Error for update ${ctx.updateType}:`, err?.message ?? err);
  ctx
    .reply("⚠️ Something went wrong. Please try again or send /menu.")
    .catch(() => {});
});

export default bot;
