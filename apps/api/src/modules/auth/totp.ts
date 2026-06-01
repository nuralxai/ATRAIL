import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { prisma } from '../../db.js';
import { requireAuth } from '../../middlewares/auth.js';
import { redis } from '../../redis.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const speakeasy = require('speakeasy');

const totp = {
  generateSecret: (): string => speakeasy.generateSecret({ length: 20 }).base32,
  generate: (secret: string): string =>
    speakeasy.totp({ secret, encoding: 'base32' }),
  verify: (token: string, secret: string): boolean =>
    speakeasy.totp.verify({ secret, encoding: 'base32', token: token.trim(), window: 1 }),
  keyuri: (email: string, issuer: string, secret: string): string =>
    `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`,
};

async function checkTotpRateLimit(userId: string): Promise<{ limited: boolean; waitMin: number }> {
  const key = `totp-rl:${userId}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) {
    await redis.expire(key, 5 * 60); // 5 minutes window
  }
  if (attempts > 5) {
    const ttl = await redis.ttl(key);
    return { limited: true, waitMin: Math.ceil(ttl / 60) };
  }
  return { limited: false, waitMin: 0 };
}

async function resetTotpRateLimit(userId: string): Promise<void> {
  const key = `totp-rl:${userId}`;
  await redis.del(key);
}

const router = Router();

// POST /auth/2fa/setup
router.post('/setup', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

  const existing = await prisma.tOTPSecret.findUnique({ where: { userId } });
  if (existing?.verified) {
    return res.status(400).json({ ok: false, message: '2FA is already enabled on this account' });
  }

  const secret = totp.generateSecret();
  await prisma.tOTPSecret.upsert({
    where:  { userId },
    update: { secret, verified: false },
    create: { userId, secret, verified: false },
  });

  const otpAuthUrl = totp.keyuri(user.email, 'ATRAIL', secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

  return res.json({ ok: true, qrCode: qrCodeDataUrl, secret });
});

// POST /auth/2fa/verify — verifies code & marks 2FA enabled
router.post('/verify', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { token } = req.body;

  if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token.trim())) {
    return res.status(400).json({ ok: false, message: 'A 6-digit TOTP code is required' });
  }

  const rl = await checkTotpRateLimit(userId);
  if (rl.limited) {
    return res.status(429).json({ ok: false, message: `Too many failed attempts. Try again in ${rl.waitMin} minute(s).` });
  }

  const record = await prisma.tOTPSecret.findUnique({ where: { userId } });
  if (!record) {
    return res.status(400).json({ ok: false, message: 'Call /setup first to generate a secret' });
  }

  const expected = totp.generate(record.secret);
  console.log('[2FA verify] submitted:', token.trim(), '| expected:', expected);

  const valid = totp.verify(token.trim(), record.secret);
  if (!valid) {
    return res.status(400).json({ ok: false, message: 'Invalid or expired code — try again' });
  }

  await resetTotpRateLimit(userId);
  await prisma.tOTPSecret.update({ where: { userId }, data: { verified: true } });
  try { await (prisma.user as any).update({ where: { id: userId }, data: { twoFactorEnabled: true } }); } catch { /* ignore if field missing */ }

  return res.json({ ok: true, message: '2FA enabled successfully' });
});

// GET /auth/2fa/debug-code — DEV: returns expected current TOTP code
router.get('/debug-code', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const record = await prisma.tOTPSecret.findUnique({ where: { userId } });
  if (!record) return res.status(404).json({ ok: false, message: 'No secret — call /setup first' });
  const currentCode = totp.generate(record.secret);
  const timeRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);
  return res.json({ ok: true, currentCode, timeRemaining, secret: record.secret });
});

// POST /auth/2fa/disable — requires current TOTP code
router.post('/disable', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { token } = req.body;

  const record = await prisma.tOTPSecret.findUnique({ where: { userId } });
  if (!record || !record.verified) {
    return res.status(400).json({ ok: false, message: '2FA is not currently enabled' });
  }

  if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token.trim())) {
    return res.status(400).json({ ok: false, message: 'Your current 6-digit 2FA code is required to disable 2FA' });
  }

  const rl = await checkTotpRateLimit(userId);
  if (rl.limited) {
    return res.status(429).json({ ok: false, message: `Too many failed attempts. Try again in ${rl.waitMin} minute(s).` });
  }

  const valid = totp.verify(token.trim(), record.secret);
  if (!valid) {
    return res.status(401).json({ ok: false, message: 'Invalid 2FA code — cannot disable without verification' });
  }

  await resetTotpRateLimit(userId);
  await prisma.tOTPSecret.deleteMany({ where: { userId } });
  try { await (prisma.user as any).update({ where: { id: userId }, data: { twoFactorEnabled: false } }); } catch { /* ignore */ }
  return res.json({ ok: true, message: '2FA disabled' });
});

// POST /auth/2fa/validate — step-up auth check
router.post('/validate', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { token } = req.body;

  const record = await prisma.tOTPSecret.findUnique({ where: { userId } });
  if (!record || !record.verified) return res.json({ ok: true, required: false });

  if (!token || typeof token !== 'string' || !/^\d{6}$/.test(token.trim())) {
    return res.status(400).json({ ok: false, message: '6-digit TOTP code required' });
  }

  const rl = await checkTotpRateLimit(userId);
  if (rl.limited) {
    return res.status(429).json({ ok: false, message: `Too many failed attempts. Try again in ${rl.waitMin} minute(s).` });
  }

  const valid = totp.verify(token.trim(), record.secret);
  if (!valid) return res.status(401).json({ ok: false, message: 'Invalid 2FA code' });

  await resetTotpRateLimit(userId);
  return res.json({ ok: true, required: true, verified: true });
});

export default router;
