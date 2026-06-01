import { Context } from "telegraf";
import { createRequire } from "module";
import { prisma } from "../../../db.js";
import { redis } from "../../../redis.js";
import { getSession, setSession, clearSession, setState } from "../session.js";
import { mainMenu, cancelMenu, confirmMenu } from "../keyboards/menus.js";

const require = createRequire(import.meta.url);
const speakeasy = require("speakeasy");

function verifyTotp(secret: string, token: string): boolean {
  return speakeasy.totp.verify({ secret, encoding: "base32", token: token.trim(), window: 1 });
}

export async function handleStart(ctx: Context) {
  const chatId = ctx.chat!.id;
  const session = await getSession(chatId);

  if (session && session.userId) {
    await ctx.reply(
      `👋 Welcome back, *${session.fullName}*!\n\nChoose an action:`,
      { parse_mode: "Markdown", ...mainMenu() }
    );
    return;
  }

  // Wipe any stale pending state
  await clearSession(chatId);

  await ctx.reply(
    "👋 Welcome to *AtrailBot*!\n\nThis bot lets you manage tasks, get AI assistance, and receive real-time notifications from your Atrail workspace.\n\nTo continue, please enter your company email address:",
    { parse_mode: "Markdown", ...cancelMenu() }
  );

  // Bootstrap a partial session to hold state
  await setSession(chatId, {
    userId: "",
    orgId: "",
    role: "",
    fullName: "",
    email: "",
    state: "await_email",
  });
}

export async function handleLogout(ctx: Context) {
  const chatId = ctx.chat!.id;
  const session = await getSession(chatId);

  if (session?.userId) {
    await prisma.telegramLink.updateMany({
      where: { telegramChatId: String(chatId) },
      data: { isActive: false },
    });
  }

  await clearSession(chatId);
  await ctx.reply("✅ You have been logged out.\n\nSend /start to log in again.");
}

export async function handleAuthFlow(ctx: Context, text: string) {
  const chatId = ctx.chat!.id;
  const session = await getSession(chatId);
  const state = session?.state;

  // ── Step 1: collect email ──────────────────────────────────────
  if (state === "await_email") {
    const email = text.trim().toLowerCase();
    if (!email.includes("@") || !email.includes(".")) {
      await ctx.reply("❌ That doesn't look like a valid email. Please enter your company email:");
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { totpSecret: true, organization: true },
    });

    if (!user || user.status !== "ACTIVE") {
      await ctx.reply(
        "❌ No active Atrail account found for that email.\n\nPlease contact your administrator."
      );
      return;
    }

    if (!user.totpSecret?.verified) {
      await ctx.reply(
        "⚠️ *MFA is not enabled* on your account.\n\nPlease log in to the Atrail web app, enable MFA under Settings → Security, then come back here.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    await setState(chatId, "await_totp", { userId: user.id, orgId: user.organizationId, emailFound: email });
    await ctx.reply(
      `✅ Account found: *${user.fullName}*\n\nPlease enter your 6-digit TOTP code from your authenticator app:`,
      { parse_mode: "Markdown", ...cancelMenu() }
    );
    return;
  }

  // ── Step 2: validate TOTP ─────────────────────────────────────
  if (state === "await_totp") {
    const code = text.trim().replace(/\s/g, "");
    const userId = session?.pendingData?.userId;
    if (!userId) {
      await ctx.reply("Something went wrong. Please send /start to try again.");
      return;
    }

    // Brute-force guard (5 attempts per 5 min)
    const failKey = `tg_auth_fail:${chatId}`;
    const fails = await redis.incr(failKey);
    if (fails === 1) await redis.expire(failKey, 300);

    if (fails > 5) {
      await clearSession(chatId);
      await ctx.reply("🔒 Too many failed attempts. Please wait 5 minutes before trying again.");
      return;
    }

    const totpRecord = await prisma.tOTPSecret.findUnique({ where: { userId } });
    if (!totpRecord?.verified) {
      await ctx.reply("⚠️ MFA setup not found. Please enable MFA in the web app first.");
      return;
    }

    const valid = verifyTotp(totpRecord.secret, code);
    if (!valid) {
      await ctx.reply(`❌ Invalid TOTP code. ${5 - fails} attempt(s) remaining.`);
      return;
    }

    // Clear fail counter on success
    await redis.del(failKey);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true, profile: true },
    });
    if (!user) return;

    // Transition to await_confirm state and ask user to confirm details
    await setSession(chatId, {
      userId: "", // Keep it empty for security until confirmed
      orgId: user.organizationId,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      state: "await_confirm",
      pendingData: { userId: user.id },
    });

    const msg = `🔐 *Confirm Your Details*\n\nPlease verify that the details below are correct before connecting this Telegram account:\n\n👤 *Name:* ${user.fullName}\n🏢 *Company:* ${user.companyName || user.organization.name}\n🔑 *Role:* ${user.role}\n👥 *Team:* ${user.profile?.department || "N/A"}`;
    await ctx.reply(msg, { parse_mode: "Markdown", ...confirmMenu("LINK") });
  }
}
