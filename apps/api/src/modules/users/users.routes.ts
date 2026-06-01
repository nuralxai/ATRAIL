import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { usersController } from "./users.controller.js";
import { prisma } from "../../db.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.post(
  "/",
  requireRole("ADMIN", "SUPER_ADMIN"),
  usersController.createUser
);

// only users I can message (directional rule)
usersRouter.get("/messagable", usersController.listMessagable);

// list all users (admin+ only)
usersRouter.get(
  "/",
  requireRole("ADMIN", "SUPER_ADMIN"),
  usersController.listAll
);

// Org directory with role grouping and team structure (admin+ only)
usersRouter.get(
  "/directory",
  requireRole("ADMIN", "SUPER_ADMIN"),
  usersController.listOrgDirectory
);

usersRouter.get(
  "/pending",
  requireRole("SUPER_ADMIN"),
  usersController.listPending
);

usersRouter.post(
  "/:userId/approve",
  requireRole("SUPER_ADMIN"),
  usersController.approveUser
);

// Admin assigns Elite to report to them; Elite assigns User to report to Elite
usersRouter.post(
  "/:userId/assign",
  requireRole("ADMIN", "ELITE", "SUPER_ADMIN"),
  usersController.assignReportsTo
);

// Change user role
usersRouter.patch(
  "/:userId/role",
  requireRole("SUPER_ADMIN", "ADMIN", "ELITE"),
  usersController.changeRole
);

// Notifications & Firebase
usersRouter.put("/me/fcm", usersController.updateFcmToken);
usersRouter.put("/me/external-reminders", usersController.updateExternalReminders);

// Profile
usersRouter.get("/profile/me", usersController.getMyProfile);
usersRouter.put("/profile/me", usersController.updateMyProfile);
usersRouter.get("/managers", usersController.listManagers);

// Telegram link status — tells the frontend if the user has linked their Telegram
usersRouter.get("/me/telegram-status", async (req, res) => {
  try {
    const u = (req as any).user;
    const link = await prisma.telegramLink.findUnique({
      where: { userId: u.id },
      select: { telegramUsername: true, linkedAt: true, isActive: true },
    });
    const botName = process.env.TELEGRAM_BOT_USERNAME || "AtrailBot";
    res.json({
      ok: true,
      data: {
        linked: !!(link?.isActive),
        telegramUsername: link?.telegramUsername ?? null,
        linkedAt: link?.linkedAt ?? null,
        botName,
        linkUrl: `https://t.me/${botName}`,
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

