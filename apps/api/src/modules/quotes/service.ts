import { PrismaClient } from "../../prisma-client.js";
const prisma = new PrismaClient();

export class QuoteService {
  async generateQuote(renewalId: string, items?: Array<{ description: string; qty: number; rate: number }>) {
    const renewal = await prisma.renewal.findUnique({
      where: { id: renewalId },
      include: { customer: true, vendor: true, accountManager: true },
    });

    if (!renewal) throw new Error("Renewal not found");

    // Calculate totals
    const itemsData = items || [
      {
        description: renewal.renewalType || "Software License Renewal",
        qty: 1,
        rate: renewal.renewalCost,
      },
    ];

    const subtotal = itemsData.reduce((sum, item) => sum + item.qty * item.rate, 0);
    const tax = subtotal * 0.18; // 18% GST
    const total = subtotal + tax;

    const quoteData = {
      renewalId,
      customerId: renewal.customerId,
      vendorId: renewal.vendorId,
      amId: renewal.amId,
      items: JSON.stringify(itemsData),
      subtotal,
      tax,
      total,
      status: "DRAFT",
      generatedAt: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days valid
    };

    // Update renewal to mark quote as sent
    await prisma.renewal.update({
      where: { id: renewalId },
      data: {
        quoteSent: true,
        quoteSentDate: new Date(),
        status: "QUOTED",
      },
    });

    return quoteData;
  }

  async getQuoteDetails(renewalId: string) {
    const renewal = await prisma.renewal.findUnique({
      where: { id: renewalId },
      include: {
        customer: { include: { contacts: true } },
        vendor: true,
        accountManager: true,
      },
    });

    if (!renewal || !renewal.quoteSent) {
      throw new Error("Quote not found or not generated");
    }

    return {
      quoteId: renewalId,
      customer: renewal.customer,
      vendor: renewal.vendor,
      generatedBy: renewal.accountManager,
      renewalCost: renewal.renewalCost,
      discount: renewal.discountApproved || 0,
      finalCost: renewal.renewalCost - (renewal.discountApproved || 0),
      validUntil: renewal.quoteSentDate ? new Date(renewal.quoteSentDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null,
    };
  }
}

export const quoteService = new QuoteService();
