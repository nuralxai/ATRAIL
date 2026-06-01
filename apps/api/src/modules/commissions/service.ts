import { PrismaClient } from "../../prisma-client.js";
const prisma = new PrismaClient();

export class CommissionService {
  async getWallet(userId: string) {
    return prisma.commissionWallet.findUnique({
      where: { userId },
      include: { commissionEvents: true },
    });
  }

  async getOrCreateWallet(userId: string, organizationId: string) {
    let wallet = await this.getWallet(userId);
    if (!wallet) {
      wallet = await prisma.commissionWallet.create({
        data: { userId, organizationId },
        include: { commissionEvents: true },
      });
    }
    return wallet;
  }

  async postCommission(walletId: string, renewalId: string, amount: number, percentage: number) {
    return prisma.commissionEvent.create({
      data: {
        walletId,
        renewalId,
        amount,
        percentage,
        status: "ACCRUED",
      },
    });
  }

  async payoutCommission(walletId: string, amountToPay: number) {
    const wallet = await prisma.commissionWallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet || wallet.balance < amountToPay) {
      throw new Error("Insufficient balance");
    }

    await prisma.commissionWallet.update({
      where: { id: walletId },
      data: {
        balance: { decrement: amountToPay },
        totalPaid: { increment: amountToPay },
        lastPayout: new Date(),
      },
    });

    return { ok: true, paidAmount: amountToPay };
  }

  async getLeaderboard(organizationId: string, limit: number = 10) {
    const wallets = await prisma.commissionWallet.findMany({
      where: { organizationId },
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { totalEarned: "desc" },
      take: limit,
    });

    return wallets.map((w) => ({
      userId: w.userId,
      userName: w.user.fullName,
      userEmail: w.user.email,
      balance: w.balance,
      totalEarned: w.totalEarned,
      totalPaid: w.totalPaid,
      rank: 0,
    })).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  async getCommissionHistory(walletId: string) {
    return prisma.commissionEvent.findMany({
      where: { walletId },
      include: { renewal: { select: { id: true, customerId: true, renewalCost: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const commissionService = new CommissionService();
