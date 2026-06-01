import { Router } from "express";
import { customerController } from "./controller.js";
import { requireAuth } from "../../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.post("/", (req, res) => customerController.create(req, res));
router.get("/", (req, res) => customerController.list(req, res));
router.get("/:id/360", (req, res) => customerController.get360(req, res));
router.post("/:customerId/contacts", (req, res) => customerController.addContact(req, res));

export default router;
