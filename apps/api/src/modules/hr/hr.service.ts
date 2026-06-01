import { prisma } from '../../db.js';
import { LeaveType } from "../../prisma-client.js";

export const hrService = {
  async allocateDefaultLeaveBalances(userId: string) {
    const year = new Date().getFullYear();
    const defaults = [
      { type: LeaveType.ANNUAL as any, totalAllowed: 20 },
      { type: LeaveType.SICK as any, totalAllowed: 10 },
      { type: LeaveType.CASUAL as any, totalAllowed: 5 },
      { type: LeaveType.UNPAID as any, totalAllowed: 0 },
    ];

    for (const d of defaults) {
      await prisma.leaveBalance.upsert({
        where: {
          userId_type_year: {
            userId,
            type: d.type,
            year,
          }
        },
        update: {},
        create: {
          userId,
          type: d.type,
          year,
          totalAllowed: d.totalAllowed,
          used: 0,
        }
      });
    }
  }
};
