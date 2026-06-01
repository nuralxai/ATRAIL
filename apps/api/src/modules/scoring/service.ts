import { PrismaClient } from "../../prisma-client.js";
const prisma = new PrismaClient();

export class ScoringService {
  async computeRenewalLikelihood(renewalId: string): Promise<number> {
    const renewal = await prisma.renewal.findUnique({
      where: { id: renewalId },
      include: { customer: true },
    });

    if (!renewal || !renewal.customer) return 50;

    let score = 50;

    // Health score impact
    if (renewal.customer.healthScore > 80) score += 30;
    else if (renewal.customer.healthScore > 60) score += 15;
    else if (renewal.customer.healthScore < 40) score -= 20;

    // Days until renewal
    const daysUntil = Math.floor((renewal.renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 7) score -= 10; // Urgent = less time to negotiate
    if (daysUntil > 60) score += 10; // More time = better

    // Margin indicator
    if (renewal.margin > renewal.renewalCost * 0.2) score += 5; // Good margin
    if (renewal.margin < renewal.renewalCost * 0.05) score -= 10; // Tight margin

    return Math.max(0, Math.min(100, score));
  }

  async computeChurnRisk(renewalId: string) {
    const renewal = await prisma.renewal.findUnique({
      where: { id: renewalId },
      include: { customer: true },
    });

    if (!renewal || !renewal.customer) return "LOW";

    const health = renewal.customer.healthScore;

    if (health < 30) return "CRITICAL";
    if (health < 50) return "HIGH";
    if (health < 70) return "MEDIUM";
    return "LOW";
  }

  async computeUpsellPotential(renewalId: string): Promise<number> {
    const renewal = await prisma.renewal.findUnique({
      where: { id: renewalId },
      include: { customer: true },
    });

    if (!renewal) return 0;

    // Base potential: 25% of renewal cost
    let potential = renewal.renewalCost * 0.25;

    // Adjust based on customer health and historical growth
    if (renewal.customer.healthScore > 75) {
      potential *= 1.5; // Healthy customers = higher upsell
    } else if (renewal.customer.healthScore < 50) {
      potential *= 0.5; // At-risk customers = lower upsell
    }

    return potential;
  }

  async scoreCustomerHealth(customerId: string): Promise<number> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { renewals: true },
    });

    if (!customer) return 50;

    let score = customer.healthScore;

    // Adjust based on renewal performance
    const closedRenewals = customer.renewals.filter(r => r.status === "CLOSED").length;
    const pendingRenewals = customer.renewals.filter(r => r.status !== "CLOSED" && r.status !== "CANCELLED").length;

    if (closedRenewals > 0) {
      score += Math.min(20, closedRenewals * 5); // Bonus for renewals
    }

    if (pendingRenewals > 3) {
      score -= Math.min(15, pendingRenewals * 3); // Penalty for delays
    }

    return Math.max(0, Math.min(100, score));
  }

  async batchScoreRenewals(organizationId: string) {
    const renewals = await prisma.renewal.findMany({
      where: { organizationId },
    });

    const results = [];
    for (const renewal of renewals) {
      const likelihood = await this.computeRenewalLikelihood(renewal.id);
      const churnRisk = await this.computeChurnRisk(renewal.id);
      const upsellPotential = await this.computeUpsellPotential(renewal.id);

      await prisma.renewal.update({
        where: { id: renewal.id },
        data: { renewalLikelihood: likelihood, churnRisk: churnRisk as any, upsellPotential },
      });

      results.push({ renewalId: renewal.id, likelihood, churnRisk, upsellPotential });
    }

    return results;
  }
}

export const scoringService = new ScoringService();
