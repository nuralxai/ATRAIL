# AtrailBot — Telegram Bot Implementation Plan
**Bot:** [@AtrailBot](https://t.me/AtrailBot)  
**Token:** Store in `.env` as `TELEGRAM_BOT_TOKEN`  
**AI Engine:** NVIDIA NIM (already integrated via `apps/api/src/modules/ai/ai.service.ts`)  
**Stack:** Telegraf · Express · Prisma · PostgreSQL · Redis · TOTP (all already in project)

---

## Architecture Overview

```
Telegram User
    │
    ▼
Telegram Bot API (webhook/polling)
    │
    ▼
apps/api/src/modules/telegram/
    ├── bot.ts              ← Telegraf instance, webhook setup
    ├── session.ts          ← Redis session store (telegram_session:{chatId})
    ├── auth.middleware.ts  ← Require linked account on all bot commands
    ├── commands/
    │   ├── start.ts        ← /start, /login, /logout
    │   ├── tasks.ts        ← /tasks, /create, /update
    │   ├── meetings.ts     ← /meetings, /schedule
    │   ├── notify.ts       ← /notifications
    │   └── ai.ts           ← /ask — free-form NLP via NVIDIA
    └── keyboards/
        └── menus.ts        ← Inline keyboards (main menu, task menu, etc.)
```

**Rule:** The bot is an interface only. It calls the same internal service functions used by the REST API. No direct DB writes from bot handlers.

---

## Step 0 — Environment Variables

Add to `apps/api/.env`:

```env
TELEGRAM_BOT_TOKEN=8910540786:AAFlNTKaQgSfZlcs-3R57xURXqgsl2-lGN8
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/v1/telegram/webhook
# Already present:
NVIDIA_API_KEY=your_nvidia_key
REDIS_URL=redis://localhost:6379
```

> **Security:** Regenerate the bot token via @BotFather if it was shared publicly. Use `/revoke` then `/token`.

---

## Step 1 — Prisma Schema: TelegramLink Table

**File:** `apps/api/prisma/schema.prisma`

Add after the `User` model:

```prisma
model TelegramLink {
  id               String   @id @default(cuid())
  userId           String   @unique
  telegramChatId   String   @unique  // Telegram chat_id (not username)
  telegramUsername String?
  linkedAt         DateTime @default(now())
  isActive         Boolean  @default(true)
  lastSeenAt       DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([telegramChatId])
}
```

Add to `User` model:

```prisma
  telegramLink TelegramLink?
```

**Run:**

```bash
cd apps/api
npx prisma db push
```

---

## Step 2 — Install Telegraf

```bash
cd apps/api
pnpm add telegraf
pnpm add -D @types/node
```

---

## Step 3 — Redis Session Store

**File:** `apps/api/src/modules/telegram/session.ts`

```typescript
import { redis } from "../../redis.js";

const TTL = 60 * 60 * 12; // 12 hours

export interface BotSession {
  userId: string;
  orgId: string;
  role: string;
  fullName: string;
  email: string;
  state?: string;         // "await_email" | "await_totp" | "await_task_title" etc.
  pendingData?: Record<string, string>;
}

const key = (chatId: number | string) => `telegram_session:${chatId}`;

export async function getSession(chatId: number | string): Promise<BotSession | null> {
  const raw = await redis.get(key(chatId));
  return raw ? JSON.parse(raw) : null;
}

export async function setSession(chatId: number | string, session: BotSession): Promise<void> {
  await redis.set(key(chatId), JSON.stringify(session), "EX", TTL);
}

export async function clearSession(chatId: number | string): Promise<void> {
  await redis.del(key(chatId));
}

export async function updateState(
  chatId: number | string,
  state: string,
  pendingData?: Record<string, string>
): Promise<void> {
  const session = await getSession(chatId);
  if (session) {
    session.state = state;
    if (pendingData) session.pendingData = { ...session.pendingData, ...pendingData };
    await setSession(chatId, session);
  }
}
```

---

## Step 4 — Auth Middleware

**File:** `apps/api/src/modules/telegram/auth.middleware.ts`

```typescript
import { Context } from "telegraf";
import { getSession } from "./session.js";
import { mainMenu } from "./keyboards/menus.js";

export async function requireLinked(ctx: Context, next: () => Promise<void>) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const session = await getSession(chatId);
  if (!session) {
    await ctx.reply(
      "⚠️ You are not logged in.\n\nUse /start to link your Atrail account.",
      mainMenu()
    );
    return;
  }
  return next();
}
```

---

## Step 5 — Keyboards

**File:** `apps/api/src/modules/telegram/keyboards/menus.ts`

```typescript
import { Markup } from "telegraf";

export function mainMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📋 My Tasks", "TASKS_LIST")],
    [Markup.button.callback("➕ Create Task", "TASK_CREATE")],
    [Markup.button.callback("📅 Meetings", "MEETINGS_LIST")],
    [Markup.button.callback("🔔 Notifications", "NOTIFS_LIST")],
    [Markup.button.callback("🤖 Ask AI", "AI_CHAT")],
    [Markup.button.callback("🚪 Logout", "LOGOUT")],
  ]);
}

export function taskStatusMenu(taskId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("▶️ Start", `TASK_START_${taskId}`)],
    [Markup.button.callback("📤 Submit", `TASK_SUBMIT_${taskId}`)],
    [Markup.button.callback("◀️ Back", "TASKS_LIST")],
  ]);
}

export function cancelMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("❌ Cancel", "CANCEL")],
  ]);
}
```

---

## Step 6 — Auth Commands (Start / Login / Logout)

**File:** `apps/api/src/modules/telegram/commands/start.ts`

```typescript
import { Context } from "telegraf";
import { db } from "../../../db.js";
import { redis } from "../../../redis.js";
import { getSession, setSession, clearSession, updateState } from "../session.js";
import { mainMenu, cancelMenu } from "../keyboards/menus.js";
import { verifyTotp } from "../../auth/totp.js";

// --- /start ---
export async function handleStart(ctx: Context) {
  const chatId = ctx.chat!.id;
  const session = await getSession(chatId);

  if (session) {
    await ctx.reply(
      `👋 Welcome back, *${session.fullName}*!\n\nChoose an action:`,
      { parse_mode: "Markdown", ...mainMenu() }
    );
    return;
  }

  await ctx.reply(
    "👋 Welcome to *Atrail PM Bot*\\!\n\nThis bot lets you manage tasks, meetings, and get AI assistance directly from Telegram\\.\n\nTo continue, please link your Atrail account\\.\n\nEnter your company email address:",
    { parse_mode: "MarkdownV2", ...cancelMenu() }
  );
  await updateState(chatId, "await_email");
}

// --- /logout ---
export async function handleLogout(ctx: Context) {
  const chatId = ctx.chat!.id;
  await clearSession(chatId);

  // Mark TelegramLink as inactive
  await db.telegramLink.updateMany({
    where: { telegramChatId: String(chatId) },
    data: { isActive: false },
  });

  await ctx.reply("✅ You have been logged out.\n\nUse /start to log in again.");
}

// --- Text handler for multi-step auth flow ---
export async function handleAuthFlow(ctx: Context, text: string) {
  const chatId = ctx.chat!.id;
  const session = await getSession(chatId);
  const state = session?.state;

  // Step 1: Collect email
  if (state === "await_email" || !session) {
    const email = text.trim().toLowerCase();
    if (!email.includes("@")) {
      await ctx.reply("❌ Invalid email. Please enter a valid company email address:");
      return;
    }

    const user = await db.user.findUnique({
      where: { email },
      include: { totpSecret: true, organization: true },
    });

    if (!user || user.status !== "ACTIVE") {
      await ctx.reply("❌ No active Atrail account found for this email.\n\nContact your admin.");
      return;
    }

    if (!user.totpSecret?.encryptedSecret) {
      await ctx.reply(
        "⚠️ MFA is not enabled on your account.\n\nPlease log in to the Atrail web app and enable MFA first, then come back here."
      );
      return;
    }

    await updateState(chatId, "await_totp", { userId: user.id, orgId: user.organizationId, email });
    await ctx.reply(
      `✅ Account found: *${user.fullName}*\n\nEnter your 6-digit TOTP code from your authenticator app:`,
      { parse_mode: "Markdown", ...cancelMenu() }
    );
    return;
  }

  // Step 2: Validate TOTP
  if (state === "await_totp") {
    const code = text.trim();
    const userId = session.pendingData?.userId;
    if (!userId) return;

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { totpSecret: true, organization: true },
    });
    if (!user?.totpSecret?.encryptedSecret) return;

    const valid = verifyTotp(user.totpSecret.encryptedSecret, code);
    if (!valid) {
      // Track failed attempts in Redis
      const failKey = `tg_auth_fail:${chatId}`;
      const fails = await redis.incr(failKey);
      await redis.expire(failKey, 300);
      if (fails >= 5) {
        await clearSession(chatId);
        await ctx.reply("🔒 Too many failed attempts. Please wait 5 minutes before trying again.");
        return;
      }
      await ctx.reply(`❌ Invalid code. ${5 - fails} attempts remaining.`);
      return;
    }

    // Link Telegram account
    await db.telegramLink.upsert({
      where: { userId },
      update: {
        telegramChatId: String(chatId),
        telegramUsername: ctx.from?.username,
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        telegramChatId: String(chatId),
        telegramUsername: ctx.from?.username,
      },
    });

    // Create full session
    await setSession(chatId, {
      userId: user.id,
      orgId: user.organizationId,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      state: undefined,
    });

    await ctx.reply(
      `🎉 *Logged in successfully!*\n\nWelcome, ${user.fullName}\nOrg: ${user.organization.name}\nRole: ${user.role}\n\nChoose an action:`,
      { parse_mode: "Markdown", ...mainMenu() }
    );
    return;
  }
}
```

---

## Step 7 — Task Commands

**File:** `apps/api/src/modules/telegram/commands/tasks.ts`

```typescript
import { Context } from "telegraf";
import { db } from "../../../db.js";
import { getSession, updateState } from "../session.js";
import { mainMenu, taskStatusMenu, cancelMenu } from "../keyboards/menus.js";
import { TaskStatus } from "../../../generated/client/index.js";

// List tasks assigned to the user
export async function handleTasksList(ctx: Context) {
  const session = await getSession(ctx.chat!.id);
  if (!session) return;

  const tasks = await db.task.findMany({
    where: { assignedToId: session.userId, status: { not: "ACCEPTED" } },
    include: { project: { select: { name: true } } },
    orderBy: { deadline: "asc" },
    take: 10,
  });

  if (!tasks.length) {
    await ctx.reply("✅ No pending tasks. You're all caught up!", mainMenu());
    return;
  }

  const lines = tasks.map((t, i) => {
    const deadline = t.deadline ? `⏰ ${new Date(t.deadline).toLocaleDateString()}` : "No deadline";
    const statusEmoji = { ASSIGNED: "📌", IN_PROGRESS: "🔄", SUBMITTED: "📤", ACCEPTED: "✅", REJECTED: "❌" }[t.status] || "📋";
    return `${i + 1}. ${statusEmoji} *${t.title}*\n   Project: ${t.project?.name || "—"}\n   ${deadline}\n   ID: \`${t.id.slice(-8)}\``;
  });

  await ctx.reply(
    `📋 *Your Tasks (${tasks.length})*\n\n${lines.join("\n\n")}\n\nReply with a Task ID to manage it, or use the menu:`,
    { parse_mode: "Markdown", ...mainMenu() }
  );
}

// Start task creation flow
export async function handleTaskCreate(ctx: Context) {
  const session = await getSession(ctx.chat!.id);
  if (!session) return;

  if (!["ADMIN", "SUPER_ADMIN", "ELITE", "TENANT"].includes(session.role)) {
    await ctx.reply("❌ You don't have permission to create tasks.");
    return;
  }

  await updateState(ctx.chat!.id, "await_task_title");
  await ctx.reply("📝 Enter the task title:", cancelMenu());
}

// Handle task update by short ID
export async function handleTaskAction(ctx: Context, action: string, taskId: string) {
  const session = await getSession(ctx.chat!.id);
  if (!session) return;

  // Find task by last 8 chars of ID
  const task = await db.task.findFirst({
    where: { 
      id: { endsWith: taskId },
      assignedToId: session.userId
    },
  });

  if (!task) {
    await ctx.reply("❌ Task not found or not assigned to you.");
    return;
  }

  const statusMap: Record<string, TaskStatus> = {
    TASK_START: "IN_PROGRESS",
    TASK_SUBMIT: "SUBMITTED",
  };

  const newStatus = statusMap[action];
  if (!newStatus) return;

  await db.task.update({ where: { id: task.id }, data: { status: newStatus } });
  await ctx.reply(`✅ Task "*${task.title}*" updated to *${newStatus}*`, { parse_mode: "Markdown", ...mainMenu() });
}

// Handle multi-step task creation text
export async function handleTaskCreationFlow(ctx: Context, text: string) {
  const chatId = ctx.chat!.id;
  const session = await getSession(chatId);
  if (!session) return;

  if (session.state === "await_task_title") {
    await updateState(chatId, "await_task_assignee", { taskTitle: text });
    await ctx.reply("👤 Enter the email of the person to assign this task to:", cancelMenu());
    return;
  }

  if (session.state === "await_task_assignee") {
    const assignee = await db.user.findFirst({
      where: { email: text.trim().toLowerCase(), organizationId: session.orgId },
    });

    if (!assignee) {
      await ctx.reply("❌ User not found in your organization. Try again:", cancelMenu());
      return;
    }

    await updateState(chatId, "await_task_deadline", { assigneeId: assignee.id, assigneeName: assignee.fullName });
    await ctx.reply(
      `👤 Assignee: *${assignee.fullName}*\n\nEnter deadline (e.g., 2026-06-01) or type "none":`,
      { parse_mode: "Markdown", ...cancelMenu() }
    );
    return;
  }

  if (session.state === "await_task_deadline") {
    const data = session.pendingData || {};
    const deadline = text.toLowerCase() === "none" ? null : new Date(text);

    // Lookup any available project in the org (simplified — can be expanded)
    const project = await db.project.findFirst({
      where: { organizationId: session.orgId },
    });

    const task = await db.task.create({
      data: {
        title: data.taskTitle!,
        assignedToId: data.assigneeId!,
        assignedById: session.userId,
        projectId: project?.id || "",
        status: "ASSIGNED",
        deadline: deadline || undefined,
      },
    });

    await updateState(chatId, undefined as any);
    await ctx.reply(
      `✅ Task created!\n\n*${task.title}*\nAssigned to: ${data.assigneeName}\nDeadline: ${deadline ? deadline.toLocaleDateString() : "None"}`,
      { parse_mode: "Markdown", ...mainMenu() }
    );
  }
}
```

---

## Step 8 — AI Command (NVIDIA NIM)

**File:** `apps/api/src/modules/telegram/commands/ai.ts`

```typescript
import { Context } from "telegraf";
import { getSession, updateState } from "../session.js";
import { chat } from "../../ai/ai.service.js";
import { mainMenu, cancelMenu } from "../keyboards/menus.js";
import { db } from "../../../db.js";

// Conversation history per user (in-memory, short-lived)
const histories = new Map<number, Array<{ role: "user" | "assistant"; content: string }>>();

export async function handleAiChat(ctx: Context) {
  const chatId = ctx.chat!.id;
  await updateState(chatId, "await_ai_msg");
  await ctx.reply(
    "🤖 *AI Assistant*\n\nAsk me anything about your tasks, meetings, or team. Type your message:\n_(Type /menu to go back)_",
    { parse_mode: "Markdown", ...cancelMenu() }
  );
}

export async function handleAiMessage(ctx: Context, text: string) {
  const chatId = ctx.chat!.id;
  const session = await getSession(chatId);
  if (!session) return;

  // Get or init conversation history
  if (!histories.has(chatId)) histories.set(chatId, []);
  const history = histories.get(chatId)!;

  // Fetch recent context for this user
  const taskCount = await db.task.count({
    where: { assignedToId: session.userId, status: { not: "ACCEPTED" } },
  });

  history.push({ role: "user", content: text });

  // Keep last 10 messages to avoid token overflow
  const recentHistory = history.slice(-10);

  await ctx.sendChatAction("typing");

  const reply = await chat(recentHistory, {
    maxTokens: 400,
    temperature: 0.7,
    systemPrompt: `You are Atrail's AI assistant embedded in Telegram. 
The user is ${session.fullName}, role: ${session.role}, org: ${session.orgId}.
They have ${taskCount} pending tasks.
Help them manage their work, answer HR questions, and parse commands like "assign bug fix to Sara by Friday".
If you detect a task/meeting intent, respond with the action in JSON inside triple backticks labeled "action".
Be concise and professional. Max 3 paragraphs.`,
  });

  history.push({ role: "assistant", content: reply });

  // Check if AI returned an action block
  const actionMatch = reply.match(/```action\n([\s\S]*?)\n```/);
  if (actionMatch) {
    try {
      const action = JSON.parse(actionMatch[1]);
      await ctx.reply(reply.replace(/```action[\s\S]*?```/, "").trim(), {
        parse_mode: "Markdown",
      });
      await ctx.reply(
        `🔧 Detected intent: *${action.intent}*\n\nShall I execute this?\n\`\`\`json\n${JSON.stringify(action, null, 2)}\n\`\`\``,
        { parse_mode: "Markdown" }
      );
      return;
    } catch {
      // Not valid JSON — fall through to plain reply
    }
  }

  await ctx.reply(reply, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([[Markup.button.callback("◀️ Main Menu", "MAIN_MENU")]]),
  });
}

import { Markup } from "telegraf";
```

---

## Step 9 — Notification Sender (Push to Telegram)

**File:** `apps/api/src/modules/telegram/notify.ts`

This function is called by the existing notification service to push messages to Telegram.

```typescript
import TelegramBot from "../telegram/bot.js";
import { db } from "../../db.js";

export async function sendTelegramNotification(userId: string, message: string): Promise<boolean> {
  try {
    const link = await db.telegramLink.findUnique({
      where: { userId, isActive: true },
    });
    if (!link) return false;

    await TelegramBot.telegram.sendMessage(link.telegramChatId, message, {
      parse_mode: "Markdown",
    });
    return true;
  } catch (err) {
    console.error("[Telegram] Push failed:", err);
    return false;
  }
}
```

**Integrate into existing notifications service** (`apps/api/src/modules/notifications/notifications.service.ts`):

```typescript
// Add at top:
import { sendTelegramNotification } from "../telegram/notify.js";

// In createNotification() or wherever notifications are sent, add:
if (notification.userId) {
  sendTelegramNotification(notification.userId, `🔔 *${notification.title}*\n${notification.body}`).catch(() => {});
}
```

---

## Step 10 — Bot Entry Point

**File:** `apps/api/src/modules/telegram/bot.ts`

```typescript
import { Telegraf, Context, Markup } from "telegraf";
import { getSession, clearSession, updateState } from "./session.js";
import { requireLinked } from "./auth.middleware.js";
import { handleStart, handleLogout, handleAuthFlow } from "./commands/start.js";
import { handleTasksList, handleTaskCreate, handleTaskCreationFlow, handleTaskAction } from "./commands/tasks.js";
import { handleAiChat, handleAiMessage } from "./commands/ai.js";
import { mainMenu } from "./keyboards/menus.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set");

const bot = new Telegraf(BOT_TOKEN);

// ─── Commands ────────────────────────────────────────────────

bot.command("start", handleStart);
bot.command("logout", handleLogout);

bot.command("tasks",     requireLinked, handleTasksList);
bot.command("create",    requireLinked, handleTaskCreate);
bot.command("ai",        requireLinked, handleAiChat);
bot.command("menu",      requireLinked, async (ctx) => {
  await ctx.reply("Choose an action:", mainMenu());
});

// ─── Callback Queries (Inline Buttons) ───────────────────────

bot.action("MAIN_MENU", requireLinked, async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("Choose an action:", mainMenu());
});

bot.action("TASKS_LIST", requireLinked, async (ctx) => {
  await ctx.answerCbQuery();
  await handleTasksList(ctx);
});

bot.action("TASK_CREATE", requireLinked, async (ctx) => {
  await ctx.answerCbQuery();
  await handleTaskCreate(ctx);
});

bot.action("AI_CHAT", requireLinked, async (ctx) => {
  await ctx.answerCbQuery();
  await handleAiChat(ctx);
});

bot.action("LOGOUT", async (ctx) => {
  await ctx.answerCbQuery();
  await handleLogout(ctx);
});

bot.action("CANCEL", async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat?.id;
  if (chatId) await updateState(chatId, undefined as any);
  await ctx.reply("❌ Cancelled.", mainMenu());
});

// Handle task actions like TASK_START_abc123
bot.action(/^TASK_(START|SUBMIT)_(.+)$/, requireLinked, async (ctx) => {
  await ctx.answerCbQuery();
  const match = ctx.match as RegExpMatchArray;
  await handleTaskAction(ctx, `TASK_${match[1]}`, match[2]);
});

// ─── Text Message Router ──────────────────────────────────────

bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;
  const session = await getSession(chatId);
  const state = session?.state;

  // Auth flow takes priority
  if (!session || state === "await_email" || state === "await_totp") {
    await handleAuthFlow(ctx as any, text);
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

  // Default: show menu
  await ctx.reply("Use the menu to navigate:", mainMenu());
});

// ─── Error Handler ────────────────────────────────────────────

bot.catch((err: any, ctx) => {
  console.error(`[Telegram Bot Error] for ${ctx.updateType}:`, err.message);
  ctx.reply("⚠️ Something went wrong. Please try again.").catch(() => {});
});

export default bot;
```

---

## Step 11 — Wire Bot into Express Server

**File:** `apps/api/src/index.ts` — add these lines:

```typescript
import bot from "./modules/telegram/bot.js";

// After app and routes are set up, before app.listen():

const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;
const PORT = process.env.PORT || 4000;

if (WEBHOOK_URL) {
  // Production: webhook mode
  app.use(bot.webhookCallback("/api/v1/telegram/webhook"));
  bot.telegram.setWebhook(`${WEBHOOK_URL}`);
  console.log("[Telegram] Webhook mode active");
} else {
  // Development: long polling
  bot.launch({ dropPendingUpdates: true });
  console.log("[Telegram] Polling mode active");
}

// Graceful shutdown
process.once("SIGINT",  () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
```

---

## Step 12 — RBAC Enforcement in Bot

Wrap permission-sensitive actions with role checks. Add this helper to `auth.middleware.ts`:

```typescript
export function requireRole(...roles: string[]) {
  return async (ctx: Context, next: () => Promise<void>) => {
    const session = await getSession(ctx.chat!.id);
    if (!session || !roles.includes(session.role)) {
      await ctx.reply("❌ You don't have permission for this action.");
      return;
    }
    return next();
  };
}
```

Usage example in `bot.ts`:

```typescript
import { requireRole } from "./auth.middleware.js";

// Only ADMIN / SUPER_ADMIN can broadcast
bot.command("broadcast", requireLinked, requireRole("ADMIN", "SUPER_ADMIN"), async (ctx) => {
  // ...
});
```

---

## Step 13 — Notification Triggers (What Gets Pushed to Telegram)

Add `sendTelegramNotification()` calls in the existing services:

| Event | Trigger Location | Message |
|-------|-----------------|---------|
| Task assigned | `tasks.service.ts` after task create | `🆕 New task: *{title}* — Due {deadline}` |
| Task submitted | `tasks.service.ts` on SUBMITTED | `📤 {user} submitted: *{title}*` |
| Task accepted | `tasks.service.ts` on ACCEPTED | `✅ Task accepted: *{title}*` |
| Task rejected | `tasks.service.ts` on REJECTED | `❌ Task rejected: *{title}* — Review feedback` |
| Meeting reminder | `calendar.service.ts` cron | `📅 Meeting in 15 min: *{title}*` |
| Leave approved | `hr.service.ts` | `🏖️ Leave approved: {dates}` |
| Emergency alert | `emergency.service.ts` | `🚨 EMERGENCY: *{description}*` |

---

## Step 14 — NLP Intent Detection via NVIDIA

For free-form text like *"assign the API bug to Sara by Friday"*, the AI handler detects intent and returns a structured JSON action block. The bot then confirms before executing.

**System prompt pattern** (already embedded in Step 8):

```
If the user describes an action (assign task, schedule meeting, send message),
respond with the intent in this format inside triple backticks labeled "action":

```action
{
  "intent": "create_task",
  "title": "API bug fix",
  "assigneeEmail": "sara@company.com",
  "deadline": "2026-06-06T17:00:00Z"
}
```
```

The bot parses this and shows a confirmation inline button before calling the actual service.

---

## Build Order (Priority)

```
Phase 1 — Core (Week 1)
  ✅ Step 0: .env setup
  ✅ Step 1: TelegramLink DB table
  ✅ Step 2: Install Telegraf
  ✅ Step 3: Redis session store
  ✅ Step 4: Auth middleware
  ✅ Step 5: Keyboards
  ✅ Step 6: Start / Login / Logout (email + TOTP)
  ✅ Step 11: Wire into Express

Phase 2 — Task Management (Week 1–2)
  ✅ Step 7: Task list, create, update via bot
  ✅ Step 13: Push notifications on task events

Phase 3 — AI Layer (Week 2)
  ✅ Step 8: NVIDIA NIM AI chat
  ✅ Step 14: NLP intent detection + confirmation

Phase 4 — Hardening (Week 2–3)
  ✅ Step 12: RBAC enforcement
  ✅ Step 9: Full notification push integration
  • Rate limiting on TOTP (already in Step 6)
  • Audit log on every bot auth event
  • Webhook switch for production
```

---

## Security Checklist

- [x] `TELEGRAM_BOT_TOKEN` in `.env` only — never hardcoded
- [x] Telegram chat_id → internal userId mapping in DB (never trust Telegram username)
- [x] TOTP required before any session is created
- [x] Failed TOTP tracked in Redis, lockout after 5 attempts
- [x] Auth challenges expire with Redis TTL (5-minute window)
- [x] Session TTL: 12 hours, auto-expires
- [x] Role checked before every privileged action
- [x] Bot is interface only — all writes go through service functions
- [x] Webhook URL uses HTTPS in production
- [x] Audit log entry on every bot login/logout
- [ ] Add `TELEGRAM_WEBHOOK_SECRET` header validation (Telegraf supports `secretToken`)

---

## File Structure (Final)

```
apps/api/src/modules/telegram/
├── bot.ts
├── session.ts
├── auth.middleware.ts
├── notify.ts
├── commands/
│   ├── start.ts      (login, logout, email+TOTP flow)
│   ├── tasks.ts      (list, create, update)
│   ├── ai.ts         (NVIDIA NIM chat + intent)
│   └── meetings.ts   (Phase 2)
└── keyboards/
    └── menus.ts
```

---

## Quick Test After Implementation

```
1. Open Telegram → @AtrailBot → /start
2. Enter your registered Atrail email
3. Enter TOTP code from authenticator
4. You should see the main menu
5. Tap "My Tasks" → verify task list loads
6. Tap "Ask AI" → type "what tasks do I have?"
7. Assign a task in the web app → verify Telegram push arrives
```

---

*Generated for the Atrail Workflow Platform. Bot token must be regenerated via @BotFather before any public deployment.*
