import { PrismaClient, Renewal, RenewalStatus, ChurnRiskLevel, PaymentStatus } from "../../prisma-client.js";
import { DateTime } from "luxon";

const prisma = new PrismaClient();

export class RenewalService {
  // ─────────────────────────────────────────────────────────────────────────────
  // CRUD Operations
  // ─────────────────────────────────────────────────────────────────────────────

  async createRenewal(data: {
    organizationId: string;
    customerId: string;
    amId: string;
    vendorId: string;
    renewalDate: Date;
    expiryDate: Date;
    cycleStartDate: Date;
    renewalCost: number;
    renewalType?: string;
    assetId?: string;
  }) {
    const renewal = await prisma.renewal.create({
      data: {
        ...data,
        status: RenewalStatus.DRAFT,
        renewalLikelihood: 50,
        churnRisk: ChurnRiskLevel.LOW,
        upsellPotential: 0,
        paymentStatus: PaymentStatus.PENDING,
      },
      include: {
        customer: true,
        accountManager: true,
        vendor: true,
      },
    });
    return renewal;
  }

  async getRenewal(id: string) {
    return prisma.renewal.findUnique({
      where: { id },
      include: {
        customer: {
          include: { contacts: true },
        },
        accountManager: true,
        vendor: true,
        asset: true,
        commissions: true,
      },
    });
  }

  async listRenewals(organizationId: string, filters?: {
    customerId?: string;
    amId?: string;
    status?: RenewalStatus;
    churnRisk?: ChurnRiskLevel;
    paymentStatus?: PaymentStatus;
  }) {
    return prisma.renewal.findMany({
      where: {
        organizationId,
        ...filters,
      },
      include: {
        customer: true,
        accountManager: true,
        vendor: true,
      },
      orderBy: { renewalDate: "asc" },
    });
  }

  async updateRenewal(id: string, data: Partial<Renewal>) {
    return prisma.renewal.update({
      where: { id },
      data,
      include: {
        customer: true,
        accountManager: true,
        vendor: true,
      },
    });
  }

  async deleteRenewal(id: string) {
    return prisma.renewal.delete({
      where: { id },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 11-Stage Renewal Workflow
  // ─────────────────────────────────────────────────────────────────────────────

  // Stage 1: CAPTURE - Ingest renewal from various sources
  async captureRenewal(data: {
    organizationId: string;
    customerId: string;
    amId: string;
    vendorId: string;
    renewalDate: Date;
    renewalCost: number;
    source?: string; // CRM, ERP, Email, Manual, etc.
  }) {
    return this.createRenewal({
      ...data,
      expiryDate: new Date(data.renewalDate.getTime() - 24 * 60 * 60 * 1000), // Expires before renewal date
      cycleStartDate: new Date(data.renewalDate.getTime() - 90 * 24 * 60 * 60 * 1000), // 90 days before
    });
  }

  // Stage 2: ENRICH - Auto-fill missing fields
  async enrichRenewal(renewalId: string) {
    const renewal = await this.getRenewal(renewalId);
    if (!renewal) throw new Error("Renewal not found");

    const updates: Partial<Renewal> = {};

    // Infer from vendor if needed
    if (!renewal.renewalType) {
      updates.renewalType = renewal.asset?.categoryId ? "LICENSE" : "SERVICE";
    }

    // Calculate margin if not set
    if (renewal.margin === 0) {
      updates.margin = renewal.renewalCost * 0.15; // Default 15% margin
      updates.marginPercent = 15;
    }

    return this.updateRenewal(renewalId, updates);
  }

  // Stage 3: SCORE - Compute renewal likelihood, churn risk, upsell
  async scoreRenewal(renewalId: string) {
    const renewal = await this.getRenewal(renewalId);
    if (!renewal) throw new Error("Renewal not found");

    const customer = renewal.customer;
    let likelihood = 50; // Base score
    let churnRisk: ChurnRiskLevel = "LOW";
    let upsellPotential = 0;

    // Score based on customer health
    if (customer.healthScore < 30) {
      churnRisk = "CRITICAL";
      likelihood = 20;
    } else if (customer.healthScore < 50) {
      churnRisk = "HIGH";
      likelihood = 40;
    } else if (customer.healthScore < 75) {
      churnRisk = "MEDIUM";
      likelihood = 70;
    } else {
      churnRisk = "LOW";
      likelihood = 90;
    }

    // Upsell potential based on renewal cost
    upsellPotential = renewal.renewalCost * 0.25; // Assume 25% upsell opportunity

    return this.updateRenewal(renewalId, {
      renewalLikelihood: likelihood,
      churnRisk,
      upsellPotential,
    });
  }

  // Stage 4: SCHEDULE - Determine optimal outreach timing
  async scheduleRenewal(renewalId: string) {
    const renewal = await this.getRenewal(renewalId);
    if (!renewal) throw new Error("Renewal not found");

    const daysUntilRenewal = DateTime.fromJSDate(renewal.renewalDate).diffNow("days").days;

    let nextAction = "Schedule outreach";
    if (daysUntilRenewal > 60) {
      nextAction = "Send initial reminder";
    } else if (daysUntilRenewal > 30) {
      nextAction = "Send quote";
    } else if (daysUntilRenewal > 14) {
      nextAction = "Follow up on quote";
    } else if (daysUntilRenewal > 7) {
      nextAction = "Urgent follow-up";
    } else if (daysUntilRenewal > 0) {
      nextAction = "Closing reminder";
    } else {
      nextAction = "EXPIRED - Contact customer immediately";
    }

    return this.updateRenewal(renewalId, {
      nextAction,
      status: RenewalStatus.DRAFT,
    });
  }

  // Stage 5: ENGAGE - Mark as engaged with outreach
  async engageRenewal(renewalId: string, channel: string = "email") {
    return this.updateRenewal(renewalId, {
      lastOutreach: new Date(),
      nextAction: `Awaiting response from ${channel}`,
      status: RenewalStatus.DRAFT,
    });
  }

  // Stage 6: QUOTE - Generate and send quote
  async quoteRenewal(renewalId: string, quoteData?: {
    items?: string; // JSON serialized
    discount?: number;
  }) {
    return this.updateRenewal(renewalId, {
      quoteSent: true,
      quoteSentDate: new Date(),
      nextAction: "Awaiting quote approval",
      status: RenewalStatus.QUOTED,
      discountApproved: quoteData?.discount,
    });
  }

  // Stage 7: NEGOTIATE - Track customer pushback and negotiation
  async negotiateRenewal(renewalId: string, negotiationData: {
    discountRequested?: number;
    feedback?: string;
  }) {
    return this.updateRenewal(renewalId, {
      discountRequested: negotiationData.discountRequested,
      notes: negotiationData.feedback,
      nextAction: "Review discount request",
      status: RenewalStatus.NEGOTIATING,
    });
  }

  // Stage 8: CLOSE - Mark as closed with payment confirmation
  async closeRenewal(renewalId: string, closeData: {
    paymentAmount: number;
    eSignatureId?: string;
    poRef?: string;
  }) {
    return this.updateRenewal(renewalId, {
      status: RenewalStatus.CLOSED,
      paymentStatus: PaymentStatus.PAID,
      paidAmount: closeData.paymentAmount,
      paymentDate: new Date(),
      customerPORef: closeData.poRef,
      nextAction: "Provision licenses",
    });
  }

  // Stage 9: PROVISION - Call vendor APIs to extend licenses
  async provisionRenewal(renewalId: string, provisionData?: {
    vendorRefId?: string;
    provisionedDate?: Date;
  }) {
    return this.updateRenewal(renewalId, {
      nextAction: "Confirm provisioning with customer",
      notes: `Provisioned via vendor: ${provisionData?.vendorRefId || "manual"}`,
    });
  }

  // Stage 10: RECONCILE - Sync to accounting and post commission
  async reconcileRenewal(renewalId: string, reconcileData?: {
    invoiceRef?: string;
    commissionAmount?: number;
  }) {
    const renewal = await this.getRenewal(renewalId);
    if (!renewal) throw new Error("Renewal not found");

    // Update invoice ref
    const updated = await this.updateRenewal(renewalId, {
      invoiceRef: reconcileData?.invoiceRef,
      nextAction: "Annual renewal scheduled for next year",
    });

    // Create commission event if amount provided
    if (reconcileData?.commissionAmount) {
      const wallet = await prisma.commissionWallet.findUnique({
        where: { userId: renewal.amId },
      });

      if (wallet) {
        await prisma.commissionEvent.create({
          data: {
            walletId: wallet.id,
            renewalId,
            amount: reconcileData.commissionAmount,
            percentage: (reconcileData.commissionAmount / renewal.renewalCost) * 100,
            status: "ACCRUED",
          },
        });

        // Update wallet balance
        await prisma.commissionWallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: reconcileData.commissionAmount },
            totalEarned: { increment: reconcileData.commissionAmount },
          },
        });
      }
    }

    return updated;
  }

  // Stage 11: REFLECT - Update health score and schedule next year
  async reflectRenewal(renewalId: string, reflectionData?: {
    npsScore?: number;
    customerFeedback?: string;
  }) {
    const renewal = await this.getRenewal(renewalId);
    if (!renewal) throw new Error("Renewal not found");

    // Update customer health score based on renewal outcome
    let healthAdjustment = 0;
    if (renewal.status === RenewalStatus.CLOSED) {
      healthAdjustment = 10; // Positive for successful renewal
      if (renewal.upsellPotential && renewal.paidAmount && renewal.paidAmount > renewal.renewalCost) {
        healthAdjustment += 5; // Bonus for upsell
      }
    }

    await prisma.customer.update({
      where: { id: renewal.customerId },
      data: {
        healthScore: Math.min(100, renewal.customer.healthScore + healthAdjustment),
      },
    });

    return this.updateRenewal(renewalId, {
      notes: reflectionData?.customerFeedback,
      nextAction: "Schedule renewal for next year",
      status: RenewalStatus.CLOSED,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Workflow Shortcuts
  // ─────────────────────────────────────────────────────────────────────────────

  // Auto-route: Capture → Enrich → Score → Schedule
  async autoProcessRenewal(renewalId: string) {
    let renewal = await this.enrichRenewal(renewalId);
    renewal = await this.scoreRenewal(renewal.id);
    renewal = await this.scheduleRenewal(renewal.id);
    return renewal;
  }

  // Get all pending renewals needing action
  async getPendingRenewals(organizationId: string, amId?: string) {
    const pending = await prisma.renewal.findMany({
      where: {
        organizationId,
        amId: amId || undefined,
        status: {
          in: [RenewalStatus.DRAFT, RenewalStatus.QUOTED, RenewalStatus.NEGOTIATING],
        },
      },
      include: {
        customer: true,
        accountManager: true,
      },
      orderBy: [
        { churnRisk: "asc" }, // HIGH risk first
        { renewalDate: "asc" }, // Then by date
      ],
    });

    return pending;
  }

  // Get action queue for AM dashboard
  async getAMActionQueue(organizationId: string, amId: string) {
    const renewals = await prisma.renewal.findMany({
      where: {
        organizationId,
        amId,
        status: {
          in: [RenewalStatus.DRAFT, RenewalStatus.QUOTED, RenewalStatus.NEGOTIATING],
        },
      },
      include: {
        customer: true,
        vendor: true,
      },
    });

    // Categorize into priority buckets
    const now = DateTime.now();
    const critical = renewals.filter(
      (r) => r.churnRisk === ChurnRiskLevel.CRITICAL &&
              DateTime.fromJSDate(r.renewalDate).diffNow("days").days < 14
    );
    const high = renewals.filter(
      (r) => r.churnRisk === ChurnRiskLevel.HIGH ||
              DateTime.fromJSDate(r.renewalDate).diffNow("days").days < 7
    );
    const upsell = renewals.filter((r) => r.upsellPotential > r.renewalCost * 0.3);
    const review = renewals.filter((r) => !r.quoteSent && DateTime.fromJSDate(r.renewalDate).diffNow("days").days < 30);
    const easy = renewals.filter((r) => r.renewalLikelihood > 80 && r.status === RenewalStatus.DRAFT);

    return {
      critical,
      high,
      upsell,
      review,
      easy,
      total: renewals.length,
    };
  }
}

export const renewalService = new RenewalService();
