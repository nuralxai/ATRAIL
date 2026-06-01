import { Request, Response } from "express";
import { integrationsService } from "./integrations.service.js";
import { jiraService, linearService } from "./jira-linear.service.js";
import { prisma } from "../../db.js";

export const integrationsController = {
  async list(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const accounts = await integrationsService.listAccounts(u.id);
      const telegramLink = await prisma.telegramLink.findUnique({
        where: { userId: u.id },
        select: { id: true, telegramUsername: true, isActive: true },
      });
      res.json({ ok: true, accounts, telegramLink });
    } catch (e: any) {
      res.status(500).json({ ok: false, message: e.message });
    }
  },

  async disconnect(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const id = req.params.id;
      if (id === "telegram") {
        await prisma.telegramLink.deleteMany({
          where: { userId: u.id }
        });
        res.json({ ok: true, deleted: true });
        return;
      }
      await integrationsService.disconnectAccount(u.id, id);
      res.json({ ok: true, deleted: true });
    } catch (e: any) {
      res.status(500).json({ ok: false, message: e.message });
    }
  },

  // Google OAuth
  async googleAuthUrl(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      // Encode JWT in state so we can identify user on callback (browser GET redirect)
      const state = Buffer.from(JSON.stringify({ userId: u.id, token: req.headers.authorization?.split(' ')[1] })).toString('base64url');
      const url = integrationsService.getGoogleAuthUrl(state);
      res.json({ ok: true, url });
    } catch (e: any) {
      res.status(500).json({ ok: false, message: e.message });
    }
  },

  // Browser GET redirect from Google
  async googleCallback(req: Request, res: Response) {
    try {
      const { code, state } = req.query as { code?: string; state?: string };
      if (!code || !state) return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/integrations?error=google_auth_failed`);

      let userId: string;
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
        userId = decoded.userId;
      } catch {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/integrations?error=invalid_state`);
      }

      await integrationsService.handleGoogleCallback(userId, code);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/integrations?connected=google`);
    } catch (e: any) {
      console.error('Google OAuth callback error:', e.message);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/integrations?error=google_auth_failed`);
    }
  },

  // Microsoft OAuth
  async microsoftAuthUrl(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const state = Buffer.from(JSON.stringify({ userId: u.id })).toString('base64url');
      const url = await integrationsService.getMicrosoftAuthUrl(state);
      res.json({ ok: true, url });
    } catch (e: any) {
      res.status(500).json({ ok: false, message: e.message });
    }
  },

  async microsoftCallback(req: Request, res: Response) {
    try {
      const { code, state } = req.query as { code?: string; state?: string };
      if (!code || !state) return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/integrations?error=ms_auth_failed`);

      let userId: string;
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
        userId = decoded.userId;
      } catch {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/integrations?error=invalid_state`);
      }

      await integrationsService.handleMicrosoftCallback(userId, code);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/integrations?connected=microsoft`);
    } catch (e: any) {
      console.error('Microsoft OAuth callback error:', e.message);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/integrations?error=ms_auth_failed`);
    }
  },

  // Syncing
  async getCalendarEvents(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const accounts = await integrationsService.listAccounts(u.id);
      
      let allEvents: any[] = [];
      for (const acc of accounts) {
        if (acc.provider === 'GOOGLE') {
          const evs = await integrationsService.getGoogleCalendarEvents(acc.id).catch(() => []);
          allEvents = allEvents.concat(evs);
        } else if (acc.provider === 'MICROSOFT') {
          const evs = await integrationsService.getMicrosoftCalendarEvents(acc.id).catch(() => []);
          allEvents = allEvents.concat(evs);
        }
      }
      res.json({ ok: true, events: allEvents });
    } catch (e: any) {
      res.status(500).json({ ok: false, message: e.message });
    }
  },

  async getMails(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const accounts = await integrationsService.listAccounts(u.id);
      
      let allMails: any[] = [];
      for (const acc of accounts) {
        if (acc.provider === 'GOOGLE') {
          const ms = await integrationsService.getGoogleMails(acc.id).catch(() => []);
          allMails = allMails.concat(ms);
        } else if (acc.provider === 'MICROSOFT') {
          const ms = await integrationsService.getMicrosoftMails(acc.id).catch(() => []);
          allMails = allMails.concat(ms);
        }
      }
      res.json({ ok: true, mails: allMails });
    } catch (e: any) {
      res.status(500).json({ ok: false, message: e.message });
    }
  },

  // ── Google Drive ──────────────────────────────────────
  async driveListFiles(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const { folderId } = req.query as { folderId?: string };
      const files = await integrationsService.listDriveFiles(u.id, folderId);
      res.json({ ok: true, files });
    } catch (e: any) {
      res.status(e.statusCode || 500).json({ ok: false, message: e.message });
    }
  },

  async driveSearchFiles(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const { q } = req.query as { q?: string };
      if (!q) return res.status(400).json({ ok: false, message: 'Query is required' });
      const files = await integrationsService.searchDriveFiles(u.id, q);
      res.json({ ok: true, files });
    } catch (e: any) {
      res.status(e.statusCode || 500).json({ ok: false, message: e.message });
    }
  },

  async driveGetShareLink(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const { fileId } = req.params;
      const result = await integrationsService.getDriveShareLink(u.id, fileId);
      res.json({ ok: true, ...result });
    } catch (e: any) {
      res.status(e.statusCode || 500).json({ ok: false, message: e.message });
    }
  },

  // ── Jira ──────────────────────────────────────────────
  async jiraConnect(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const { baseUrl, email, apiKey } = req.body;
      if (!baseUrl || !email || !apiKey)
        return res.status(400).json({ ok: false, message: "baseUrl, email and apiKey are required" });
      const result = await jiraService.connect(u.id, { baseUrl, email, apiKey });
      res.json({ ok: true, ...result });
    } catch (e: any) {
      res.status(e.statusCode || 500).json({ ok: false, message: e.message });
    }
  },

  async jiraIssues(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const issues = await jiraService.getMyIssues(u.id);
      res.json({ ok: true, issues });
    } catch (e: any) {
      res.status(e.statusCode || 500).json({ ok: false, message: e.message });
    }
  },

  async jiraProjects(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const projects = await jiraService.getProjects(u.id);
      res.json({ ok: true, projects });
    } catch (e: any) {
      res.status(e.statusCode || 500).json({ ok: false, message: e.message });
    }
  },

  async jiraCreateIssue(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const issue = await jiraService.createIssue(u.id, req.body);
      res.json({ ok: true, issue });
    } catch (e: any) {
      res.status(e.statusCode || 500).json({ ok: false, message: e.message });
    }
  },

  // ── Linear ────────────────────────────────────────────
  async linearConnect(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const { apiKey } = req.body;
      if (!apiKey) return res.status(400).json({ ok: false, message: "apiKey is required" });
      const result = await linearService.connect(u.id, apiKey);
      res.json({ ok: true, ...result });
    } catch (e: any) {
      res.status(e.statusCode || 500).json({ ok: false, message: e.message });
    }
  },

  async linearIssues(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const issues = await linearService.getMyIssues(u.id);
      res.json({ ok: true, issues });
    } catch (e: any) {
      res.status(e.statusCode || 500).json({ ok: false, message: e.message });
    }
  },

  async linearTeams(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const teams = await linearService.getTeams(u.id);
      res.json({ ok: true, teams });
    } catch (e: any) {
      res.status(e.statusCode || 500).json({ ok: false, message: e.message });
    }
  },

  async linearCreateIssue(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const issue = await linearService.createIssue(u.id, req.body);
      res.json({ ok: true, issue });
    } catch (e: any) {
      res.status(e.statusCode || 500).json({ ok: false, message: e.message });
    }
  },
};
