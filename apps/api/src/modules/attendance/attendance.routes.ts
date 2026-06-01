import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import { attendanceController } from "./attendance.controller.js";

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

// only ELITE + USER can punch (enforced in service/controller)
attendanceRouter.post("/punch-in", attendanceController.punchIn);
attendanceRouter.post("/punch-out", attendanceController.punchOut);

// Frontend expects /me/today and /me/history
attendanceRouter.get("/me/today", attendanceController.today);
attendanceRouter.get("/me/history", attendanceController.myHistory);

// Admin dashboard (ADMIN and SUPER_ADMIN only)
attendanceRouter.get("/dashboard", attendanceController.adminDashboard);
