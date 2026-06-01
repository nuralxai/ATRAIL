import { redis } from "../../redis.js";

const SESSION_TTL = 60 * 60 * 12; // 12 hours

export interface BotSession {
  userId: string;
  orgId: string;
  role: string;
  fullName: string;
  email: string;
  state?: string;
  pendingData?: Record<string, string>;
}

const key = (chatId: number | string) => `tg_session:${chatId}`;

export async function getSession(chatId: number | string): Promise<BotSession | null> {
  const raw = await redis.get(key(chatId));
  return raw ? JSON.parse(raw) : null;
}

export async function setSession(chatId: number | string, session: BotSession): Promise<void> {
  await redis.set(key(chatId), JSON.stringify(session), "EX", SESSION_TTL);
}

export async function clearSession(chatId: number | string): Promise<void> {
  await redis.del(key(chatId));
}

export async function setState(
  chatId: number | string,
  state: string | undefined,
  pendingData?: Record<string, string>
): Promise<void> {
  const session = await getSession(chatId);
  if (!session) return;
  session.state = state;
  if (pendingData) session.pendingData = { ...session.pendingData, ...pendingData };
  await setSession(chatId, session);
}
