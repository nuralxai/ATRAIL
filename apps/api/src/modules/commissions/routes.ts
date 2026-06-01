import { Router } from "express";
import { commissionController } from "./controller.js";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/wallet", (req, res) => commissionController.getWallet(req, res));
router.get("/history", (req, res) => commissionController.getHistory(req, res));
router.post("/payout", (req, res) => commissionController.requestPayout(req, res));
router.get("/leaderboard", (req, res) => commissionController.getLeaderboard(req, res));

export default router;
