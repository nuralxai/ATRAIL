import { Request, Response } from "express";
import { quoteService } from "./service.js";

export class QuoteController {
  async generate(req: Request, res: Response) {
    try {
      const { renewalId } = req.params;
      const { items } = req.body;
      const quote = await quoteService.generateQuote(renewalId, items);
      res.json({ ok: true, data: quote });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }

  async getDetails(req: Request, res: Response) {
    try {
      const { renewalId } = req.params;
      const details = await quoteService.getQuoteDetails(renewalId);
      res.json({ ok: true, data: details });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  }
}

export const quoteController = new QuoteController();
