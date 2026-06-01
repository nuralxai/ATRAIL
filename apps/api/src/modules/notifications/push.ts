import { Router, Request, Response } from 'express';
import webpush from 'web-push';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

const router = Router();

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@amgi.local';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

// POST /notifications/subscribe
router.post('/subscribe', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ ok: false, message: 'Invalid subscription' });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });

  return res.json({ ok: true, message: 'Subscribed' });
});

// DELETE /notifications/unsubscribe
router.delete('/unsubscribe', requireAuth, async (req: Request, res: Response) => {
  const { endpoint } = req.body;
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return res.json({ ok: true, message: 'Unsubscribed' });
});

// GET /notifications/vapid-public-key
router.get('/vapid-public-key', (_req: Request, res: Response) => {
  return res.json({ ok: true, publicKey: VAPID_PUBLIC });
});

// GET /notifications/audit-logs (SUPER_ADMIN only)
router.get('/audit-logs', requireAuth, requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const { page = '1', limit = '50', action } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: action ? { action: action as any } : {},
      include: { actor: { select: { id: true, fullName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit as string),
    }),
    prisma.auditLog.count({ where: action ? { action: action as any } : {} }),
  ]);

  return res.json({ ok: true, logs, total, page: parseInt(page as string) });
});

import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
} catch(e) { console.error("Firebase Admin Init Error", e); }

export async function sendPushToUser(userId: string, title: string, body: string, data?: any) {
  const user = await prisma.user.findUnique({ 
    where: { id: userId },
    include: { connectedAccounts: true }
  });
  if (!user) return;

  // 1. Existing VAPID Web Push
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    const payload = JSON.stringify({ title, body, data });
    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      } catch (err: any) {
        if (err.statusCode === 410) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
        }
      }
    }
  }

  // 2. Firebase Cloud Messaging (FCM)
  if (user.fcmToken && admin.apps.length > 0) {
     try {
       await admin.messaging().send({
         token: user.fcmToken,
         notification: { title, body }
       });
     } catch (e) {
       console.error("FCM Send Error:", e);
     }
  }

  // 3. External Reminders via OAuth (Google / Microsoft Gmail)
  if (user.externalReminders && user.connectedAccounts && user.connectedAccounts.length > 0) {
     for (const acc of user.connectedAccounts) {
        if (acc.provider === 'GOOGLE' && acc.accessToken) {
           try {
              const oauth2Client = new google.auth.OAuth2();
              oauth2Client.setCredentials({ access_token: acc.accessToken });
              const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
              const subject = `AGMI Notification: ${title}`;
              const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
              const messageParts = [
                `To: ${user.email}`,
                `Subject: ${utf8Subject}`,
                'Content-Type: text/html; charset=utf-8',
                'MIME-Version: 1.0',
                '',
                `<h2>${title}</h2><p>${body}</p>`
              ];
              const message = messageParts.join('\n');
              const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
              
              await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
           } catch(e) { console.error("Google Mail Dispatch Error", e); }
        } else if (acc.provider === 'MICROSOFT' && acc.accessToken) {
           try {
              const client = Client.init({ authProvider: (done) => done(null, acc.accessToken!) });
              const mail = {
                 message: {
                    subject: `AGMI Notification: ${title}`,
                    body: { contentType: "HTML", content: `<h2>${title}</h2><p>${body}</p>` },
                    toRecipients: [{ emailAddress: { address: user.email } }]
                 }
              };
              await client.api('/me/sendMail').post(mail);
           } catch(e) { console.error("Microsoft Mail Dispatch Error", e); }
        }
     }
  }
}

export default router;
