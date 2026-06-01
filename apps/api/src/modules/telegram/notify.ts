import { prisma } from "../../db.js";

let botInstance: any = null;

export function setBotInstance(bot: any) {
  botInstance = bot;
}

export async function sendTelegramNotification(userId: string, message: string): Promise<boolean> {
  if (!botInstance) return false;
  try {
    const link = await prisma.telegramLink.findUnique({
      where: { userId },
      select: { telegramChatId: true, isActive: true },
    });
    if (!link?.isActive) return false;

    await botInstance.telegram.sendMessage(link.telegramChatId, message, {
      parse_mode: "Markdown",
    });
    return true;
  } catch (err: any) {
    console.error("[TelegramBot] Push failed:", err?.message);
    return false;
  }
}
