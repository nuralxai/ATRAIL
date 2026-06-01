import { Request, Response } from "express";
import { customerService } from "./service.js";

export class CustomerController {
  async create(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const customer = await customerService.createCustomer(u.orgId, req.body);
      res.json({ ok: true, data: customer });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async get360(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const u = (req as any).user;
      const customer = await customerService.getCustomer360(id);
      if (!customer) return res.status(404).json({ ok: false, message: "Customer not found" });

      // Enforce org isolation
      if (!["GOD", "DEVELOPER"].includes(u?.role) && customer.organizationId !== u?.orgId) {
        return res.status(404).json({ ok: false, message: "Customer not found" });
      }

      res.json({ ok: true, data: customer });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const u = (req as any).user;
      const { churnRisk, healthScoreMin, healthScoreMax } = req.query;
      const customers = await customerService.listCustomers(u.orgId, {
        churnRisk: churnRisk as any,
        healthScoreMin: healthScoreMin ? Number(healthScoreMin) : undefined,
        healthScoreMax: healthScoreMax ? Number(healthScoreMax) : undefined,
      });
      res.json({ ok: true, data: customers, count: customers.length });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async addContact(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      const contact = await customerService.addContact(customerId, req.body);
      res.json({ ok: true, data: contact });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }
}

export const customerController = new CustomerController();
