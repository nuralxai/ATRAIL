import { Context } from "telegraf";
import { createRequire } from "module";
import { prisma } from "../../../db.js";
import { getSession, setState } from "../session.js";
import { mainMenu, cancelMenu } from "../keyboards/menus.js";
import bcrypt from "bcryptjs";

const require = createRequire(import.meta.url);
const speakeasy = require("speakeasy");

function verifyTotp(secret: string, token: string): boolean {
  return speakeasy.totp.verify({ secret, encoding: "base32", token: token.trim(), window: 1 });
}

export async function handlePasswordChangeFlow(ctx: Context, text: string) {
  const chatId = ctx.chat!.id;
  const session = await getSession(chatId);
  const state = session?.state;
  const userId = session?.userId;

  if (!userId) {
    await ctx.reply("You must be logged in to change your password. Use /start to login.");
    return;
  }

  // State 1: Awaiting TOTP
  if (state === "password_change_await_totp") {
    const code = text.trim().replace(/\s/g, "");
    
    // verify TOTP
    const totpRecord = await prisma.tOTPSecret.findUnique({ where: { userId } });
    if (!totpRecord?.verified) {
      await setState(chatId, undefined);
      await ctx.reply("⚠️ MFA setup not found. Please enable MFA in the web app first under Settings → Security.", mainMenu());
      return;
    }

    const valid = verifyTotp(totpRecord.secret, code);
    if (!valid) {
      await ctx.reply("❌ Invalid TOTP code. Please try again or click Cancel:", cancelMenu());
      return;
    }

    // TOTP verified! Move to new password state.
    await setState(chatId, "password_change_await_new_password");
    await ctx.reply("🔓 TOTP verified successfully!\n\nPlease enter your new password:", cancelMenu());
    return;
  }

  // State 2: Awaiting new password
  if (state === "password_change_await_new_password") {
    const newPassword = text.trim();
    if (newPassword.length < 8) {
      await ctx.reply("❌ Password must be at least 8 characters long. Please enter a stronger password:", cancelMenu());
      return;
    }

    // Save temporary new password in session pendingData
    await setState(chatId, "password_change_await_confirm_password", { tempNewPassword: newPassword });
    await ctx.reply("✍️ Please re-enter (confirm) your new password:", cancelMenu());
    return;
  }

  // State 3: Awaiting confirm password
  if (state === "password_change_await_confirm_password") {
    const confirmPassword = text.trim();
    const tempNewPassword = session?.pendingData?.tempNewPassword;

    if (confirmPassword !== tempNewPassword) {
      // Passwords do not match. Restart password entering
      await setState(chatId, "password_change_await_new_password");
      await ctx.reply("❌ Passwords do not match!\n\nPlease enter your new password again:", cancelMenu());
      return;
    }

    // Hash and update password in DB, and revoke all active auth sessions
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(confirmPassword, salt);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      prisma.authSession.updateMany({
        where: { userId },
        data: { revokedAt: new Date() },
      }),
    ]);

    // Clear Telegram bot state
    const cleanSession = { ...session };
    delete cleanSession.state;
    if (cleanSession.pendingData) {
      delete cleanSession.pendingData.tempNewPassword;
    }
    // Update session
    const { setSession } = await import("../session.js");
    await setSession(chatId, cleanSession);

    await ctx.reply("🎉 *Password changed successfully!*\n\nYou have been logged out of all active web sessions. Please log in again using your new password.", { parse_mode: "Markdown", ...mainMenu() });
  }
}
