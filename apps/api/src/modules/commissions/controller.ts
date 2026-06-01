import { Request, Response } from "express";
import { commissionService } from "./service.js";

export class CommissionController {
  async getWallet(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const wallet = await commissionService.getOrCreateWallet(u.id, u.orgId);
      res.json({ ok: true, data: wallet });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async getHistory(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const wallet = await commissionService.getOrCreateWallet(u.id, u.orgId);
      const history = await commissionService.getCommissionHistory(wallet.id);
      res.json({ ok: true, data: history });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async requestPayout(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const { amount } = req.body;
      const wallet = await commissionService.getOrCreateWallet(u.id, u.orgId);
      const result = await commissionService.payoutCommission(wallet.id, amount);
      res.json({ ok: true, data: result });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async getLeaderboard(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const leaderboard = await commissionService.getLeaderboard(u.orgId);
      res.json({ ok: true, data: leaderboard });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }
}

export const commissionController = new CommissionController();
