import { Request, Response } from "express";
import { renewalService } from "./service.js";
import { RenewalStatus, ChurnRiskLevel, PaymentStatus } from "../../prisma-client.js";

export class RenewalController {
  // ─────────────────────────────────────────────────────────────────────────────
  // CRUD Endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  async createRenewal(req: Request, res: Response) {
    try {
      const { customerId, amId, vendorId, renewalDate, expiryDate, cycleStartDate, renewalCost, renewalType, assetId } =
        req.body;
      const u = (req as any).user;
      const organizationId = u?.orgId;

      if (!organizationId || !customerId || !amId || !vendorId || !renewalDate || !renewalCost) {
        return res.status(400).json({
          ok: false,
          message: "Missing required fields: customerId, amId, vendorId, renewalDate, renewalCost",
        });
      }

      const renewal = await renewalService.createRenewal({
        organizationId,
        customerId,
        amId,
        vendorId,
        renewalDate: new Date(renewalDate),
        expiryDate: new Date(expiryDate || renewalDate),
        cycleStartDate: new Date(cycleStartDate || new Date()),
        renewalCost,
        renewalType,
        assetId,
      });

      res.json({ ok: true, data: renewal });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async getRenewal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const u = (req as any).user;
      const renewal = await renewalService.getRenewal(id);

      if (!renewal) {
        return res.status(404).json({ ok: false, message: "Renewal not found" });
      }

      // Enforce org isolation — GOD/DEVELOPER can read any org
      if (!["GOD", "DEVELOPER"].includes(u?.role) && renewal.organizationId !== u?.orgId) {
        return res.status(404).json({ ok: false, message: "Renewal not found" });
      }

      res.json({ ok: true, data: renewal });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async listRenewals(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const organizationId = u?.orgId;
      const { customerId, amId, status, churnRisk, paymentStatus } = req.query;

      if (!organizationId) {
        return res.status(401).json({ ok: false, message: "Unauthorized" });
      }

      const renewals = await renewalService.listRenewals(organizationId, {
        customerId: customerId as string | undefined,
        amId: amId as string | undefined,
        status: status as RenewalStatus | undefined,
        churnRisk: churnRisk as ChurnRiskLevel | undefined,
        paymentStatus: paymentStatus as PaymentStatus | undefined,
      });

      res.json({ ok: true, data: renewals, count: renewals.length });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async updateRenewal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const u = (req as any).user;

      // Allowlist — prevent mass assignment of internal scoring/org fields
      const ALLOWED = [
        "renewalDate", "expiryDate", "cycleStartDate", "renewalCost", "margin",
        "marginPercent", "renewalType", "reminderCadence", "notes", "doRef",
        "invoiceRef", "nextAction", "lastOutreach", "quoteSent", "quoteSentDate",
        "discountRequested", "discountApproved", "paidAmount", "paymentDate",
        "customerPORef", "paymentStatus", "vendorId", "assetId",
      ] as const;

      const updates: Record<string, unknown> = {};
      for (const key of ALLOWED) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }

      const renewal = await renewalService.updateRenewal(id, updates as any);

      res.json({ ok: true, data: renewal });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async deleteRenewal(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await renewalService.deleteRenewal(id);

      res.json({ ok: true, message: "Renewal deleted" });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Workflow Stage Endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  async captureRenewal(req: Request, res: Response) {
    try {
      const { customerId, amId, vendorId, renewalDate, renewalCost, source } = req.body;
      const u = (req as any).user;
      const organizationId = u?.orgId;

      if (!organizationId) return res.status(401).json({ ok: false, message: "Unauthorized" });

      const renewal = await renewalService.captureRenewal({
        organizationId,
        customerId,
        amId,
        vendorId,
        renewalDate: new Date(renewalDate),
        renewalCost,
        source,
      });

      res.json({ ok: true, data: renewal, stage: "CAPTURE" });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async enrichRenewal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const renewal = await renewalService.enrichRenewal(id);

      res.json({ ok: true, data: renewal, stage: "ENRICH" });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async scoreRenewal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const renewal = await renewalService.scoreRenewal(id);

      res.json({ ok: true, data: renewal, stage: "SCORE" });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async scheduleRenewal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const renewal = await renewalService.scheduleRenewal(id);

      res.json({ ok: true, data: renewal, stage: "SCHEDULE" });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async engageRenewal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { channel } = req.body;

      const renewal = await renewalService.engageRenewal(id, channel || "email");

      res.json({ ok: true, data: renewal, stage: "ENGAGE" });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async quoteRenewal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { items, discount } = req.body;

      const renewal = await renewalService.quoteRenewal(id, { items, discount });

      res.json({ ok: true, data: renewal, stage: "QUOTE" });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async negotiateRenewal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { discountRequested, feedback } = req.body;

      const renewal = await renewalService.negotiateRenewal(id, {
        discountRequested,
        feedback,
      });

      res.json({ ok: true, data: renewal, stage: "NEGOTIATE" });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async closeRenewal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { paymentAmount, eSignatureId, poRef } = req.body;

      if (!paymentAmount) {
        return res.status(400).json({ ok: false, message: "paymentAmount is required" });
      }

      const renewal = await renewalService.closeRenewal(id, {
        paymentAmount,
        eSignatureId,
        poRef,
      });

      res.json({ ok: true, data: renewal, stage: "CLOSE" });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async provisionRenewal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { vendorRefId, provisionedDate } = req.body;

      const renewal = await renewalService.provisionRenewal(id, {
        vendorRefId,
        provisionedDate: provisionedDate ? new Date(provisionedDate) : undefined,
      });

      res.json({ ok: true, data: renewal, stage: "PROVISION" });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async reconcileRenewal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { invoiceRef, commissionAmount } = req.body;

      const renewal = await renewalService.reconcileRenewal(id, {
        invoiceRef,
        commissionAmount,
      });

      res.json({ ok: true, data: renewal, stage: "RECONCILE" });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async reflectRenewal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { npsScore, customerFeedback } = req.body;

      const renewal = await renewalService.reflectRenewal(id, {
        npsScore,
        customerFeedback,
      });

      res.json({ ok: true, data: renewal, stage: "REFLECT" });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper Endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  async getActionQueue(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const organizationId = u?.orgId;
      // Default to the authenticated user's own queue; admins can pass ?amId=xxx to see any AM
      const amId = (req.query.amId as string) || u?.id;

      if (!organizationId || !amId) {
        return res.status(400).json({ ok: false, message: "Unauthorized or missing amId" });
      }

      const queue = await renewalService.getAMActionQueue(organizationId, amId);

      res.json({ ok: true, data: queue });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async getPendingRenewals(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const organizationId = u?.orgId;
      const amId = req.query.amId as string | undefined;

      if (!organizationId) {
        return res.status(401).json({ ok: false, message: "Unauthorized" });
      }

      const renewals = await renewalService.getPendingRenewals(organizationId, amId);

      res.json({ ok: true, data: renewals, count: renewals.length });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async autoProcess(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const renewal = await renewalService.autoProcessRenewal(id);

      res.json({
        ok: true,
        data: renewal,
        message: "Renewal processed through stages: ENRICH → SCORE → SCHEDULE",
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }
}

export const renewalController = new RenewalController();
