import { Request, Response } from "express";
import { scoringService } from "./service.js";

export class ScoringController {
  async scoreRenewal(req: Request, res: Response) {
    try {
      const { renewalId } = req.params;
      const likelihood = await scoringService.computeRenewalLikelihood(renewalId);
      const churnRisk = await scoringService.computeChurnRisk(renewalId);
      const upsellPotential = await scoringService.computeUpsellPotential(renewalId);

      res.json({
        ok: true,
        data: { renewalId, likelihood, churnRisk, upsellPotential },
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async batchScore(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const results = await scoringService.batchScoreRenewals(u.orgId);
      res.json({ ok: true, data: results, count: results.length });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }
}

export const scoringController = new ScoringController();
