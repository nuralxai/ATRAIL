import { Router } from "express";
import { quoteController } from "./controller.js";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.post("/:renewalId/generate", (req, res) => quoteController.generate(req, res));
router.get("/:renewalId/details", (req, res) => quoteController.getDetails(req, res));

export default router;
