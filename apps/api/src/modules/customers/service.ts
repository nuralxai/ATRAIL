import { PrismaClient, ChurnRiskLevel } from "../../prisma-client.js";
const prisma = new PrismaClient();

export class CustomerService {
  async createCustomer(orgId: string, data: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    gstNumber?: string;
    panNumber?: string;
  }) {
    return prisma.customer.create({
      data: { organizationId: orgId, ...data },
      include: { contacts: true, renewals: true },
    });
  }

  async getCustomer360(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        contacts: true,
        renewals: { include: { accountManager: true, vendor: true } },
      },
    });

    if (!customer) return null;

    // Calculate metrics
    const totalRenewals = customer.renewals.length;
    const activeRenewals = customer.renewals.filter(r => r.status !== "CANCELLED").length;
    const totalValue = customer.renewals.reduce((sum, r) => sum + r.renewalCost, 0);
    const churnRiskRenewals = customer.renewals.filter(r => r.churnRisk === "CRITICAL" || r.churnRisk === "HIGH").length;

    return {
      ...customer,
      metrics: {
        totalRenewals,
        activeRenewals,
        totalValue,
        churnRiskRenewals,
        healthScore: customer.healthScore,
        churnRisk: customer.churnRisk,
      },
    };
  }

  async listCustomers(orgId: string, filters?: {
    churnRisk?: ChurnRiskLevel;
    healthScoreMin?: number;
    healthScoreMax?: number;
  }) {
    return prisma.customer.findMany({
      where: {
        organizationId: orgId,
        churnRisk: filters?.churnRisk,
        healthScore: {
          gte: filters?.healthScoreMin || 0,
          lte: filters?.healthScoreMax || 100,
        },
      },
      include: { contacts: true },
      orderBy: { name: "asc" },
    });
  }

  async updateCustomerHealth(customerId: string, healthScore: number, churnRisk: ChurnRiskLevel) {
    return prisma.customer.update({
      where: { id: customerId },
      data: { healthScore, churnRisk },
    });
  }

  async addContact(customerId: string, data: {
    name: string;
    email?: string;
    phone?: string;
    department?: string;
    title?: string;
    isPrimary?: boolean;
  }) {
    return prisma.customerContact.create({
      data: { customerId, ...data },
    });
  }
}

export const customerService = new CustomerService();
