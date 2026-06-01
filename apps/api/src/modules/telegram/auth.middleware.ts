import { Context } from "telegraf";
import { getSession } from "./session.js";
import { mainMenu } from "./keyboards/menus.js";

export async function requireLinked(ctx: Context, next: () => Promise<void>) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const session = await getSession(chatId);
  if (!session) {
    await ctx.reply(
      "⚠️ You are not logged in.\n\nSend /start to link your Atrail account.",
      mainMenu()
    );
    return;
  }
  return next();
}

export function requireRole(...roles: string[]) {
  return async (ctx: Context, next: () => Promise<void>) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;
    const session = await getSession(chatId);
    if (!session || !roles.includes(session.role)) {
      await ctx.reply("❌ You don't have permission to perform this action.");
      return;
    }
    return next();
  };
}
