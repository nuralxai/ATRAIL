import { Router } from "express";
import { scoringController } from "./controller.js";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/renewal/:renewalId", (req, res) => scoringController.scoreRenewal(req, res));
router.post("/batch", (req, res) => scoringController.batchScore(req, res));

export default router;
