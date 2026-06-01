import { Router, Request, Response } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import { prisma } from "../../db.js";

export const financeRouter = Router();

// GET /finance/invoices — list invoices for org
financeRouter.get("/invoices", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const invoices = await prisma.invoice.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return res.json({ ok: true, invoices });
});

// POST /finance/invoices — create invoice
financeRouter.post("/invoices", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { clientName, clientEmail, items, dueDate, notes } = req.body;

  if (!clientName || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, message: "clientName and items are required" });
  }

  const subtotal = items.reduce((sum: number, item: any) => sum + (item.qty * item.rate), 0);
  const tax = Math.round(subtotal * 0.18 * 100) / 100;
  const total = subtotal + tax;

  const invNumber = `INV-${Date.now().toString().slice(-6)}`;

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: user.organizationId,
      createdById: user.id,
      invoiceNumber: invNumber,
      clientName,
      clientEmail: clientEmail || null,
      items: JSON.stringify(items),
      subtotal,
      tax,
      total,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
      status: "DRAFT",
    },
  });

  return res.json({ ok: true, invoice });
});

// PATCH /finance/invoices/:id/status
financeRouter.patch("/invoices/:id/status", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { status } = req.body;
  const allowed = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"];
  if (!allowed.includes(status)) return res.status(400).json({ ok: false, message: "Invalid status" });

  const invoice = await prisma.invoice.updateMany({
    where: { id: req.params.id, organizationId: user.organizationId },
    data: { status },
  });
  return res.json({ ok: true, invoice });
});

// DELETE /finance/invoices/:id
financeRouter.delete("/invoices/:id", requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  await prisma.invoice.deleteMany({
    where: { id: req.params.id, organizationId: user.organizationId },
  });
  return res.json({ ok: true });
});
