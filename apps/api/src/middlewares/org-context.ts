import { RequestHandler } from "express";
import { prisma } from "../db.js";

export const setOrgContext: RequestHandler = async (req, _res, next) => {
  const user = (req as any).user;
  if (!user?.orgId) {
    // If no authenticated user session exists, clear the setting
    await prisma.$executeRawUnsafe(`SELECT set_config('app.current_org_id', '', TRUE)`);
    return next();
  }

  // Set the session variable to isolate queries at the database layer
  try {
    await prisma.$executeRawUnsafe(
      `SELECT set_config('app.current_org_id', $1, TRUE)`,
      user.orgId
    );
  } catch (error) {
    console.error("Error setting RLS organization context:", error);
  }
  next();
};
