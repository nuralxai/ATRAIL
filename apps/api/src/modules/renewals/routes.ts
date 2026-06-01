import { Router } from "express";
import { renewalController } from "./controller.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requireRoles, RenewalOSRole, validateOrgContext } from "../../middlewares/rbac.js";

const router = Router();

// Auth middleware on all routes
router.use(requireAuth);
router.use(validateOrgContext());

// ─────────────────────────────────────────────────────────────────────────────
// CRUD Endpoints
// ─────────────────────────────────────────────────────────────────────────────

// Anyone with edit_all_renewals or manage_own_customers can create
router.post("/",
  requireRoles(RenewalOSRole.ORG_ADMIN, RenewalOSRole.ACCOUNT_MANAGER, RenewalOSRole.SALES_MANAGER),
  (req, res) => renewalController.createRenewal(req, res)
);

router.get("/", (req, res) => renewalController.listRenewals(req, res));
// Helper routes must come before /:id to avoid being swallowed by the param route
router.get("/pending", (req, res) => renewalController.getPendingRenewals(req, res));
router.get("/queue", (req, res) => renewalController.getActionQueue(req, res));
router.get("/:id", (req, res) => renewalController.getRenewal(req, res));

router.put("/:id",
  requireRoles(RenewalOSRole.ORG_ADMIN, RenewalOSRole.ACCOUNT_MANAGER, RenewalOSRole.SALES_MANAGER),
  (req, res) => renewalController.updateRenewal(req, res)
);

router.delete("/:id",
  requireRoles(RenewalOSRole.ORG_ADMIN, RenewalOSRole.ORG_OWNER),
  (req, res) => renewalController.deleteRenewal(req, res)
);

// ─────────────────────────────────────────────────────────────────────────────
// 11-Stage Workflow Endpoints
// ─────────────────────────────────────────────────────────────────────────────

// Stage 1: CAPTURE
router.post("/workflow/capture", (req, res) => renewalController.captureRenewal(req, res));

// Stage 2: ENRICH
router.post("/:id/enrich", (req, res) => renewalController.enrichRenewal(req, res));

// Stage 3: SCORE
router.post("/:id/score", (req, res) => renewalController.scoreRenewal(req, res));

// Stage 4: SCHEDULE
router.post("/:id/schedule", (req, res) => renewalController.scheduleRenewal(req, res));

// Stage 5: ENGAGE
router.post("/:id/engage", (req, res) => renewalController.engageRenewal(req, res));

// Stage 6: QUOTE
router.post("/:id/quote", (req, res) => renewalController.quoteRenewal(req, res));

// Stage 7: NEGOTIATE
router.post("/:id/negotiate", (req, res) => renewalController.negotiateRenewal(req, res));

// Stage 8: CLOSE
router.post("/:id/close", (req, res) => renewalController.closeRenewal(req, res));

// Stage 9: PROVISION
router.post("/:id/provision", (req, res) => renewalController.provisionRenewal(req, res));

// Stage 10: RECONCILE
router.post("/:id/reconcile", (req, res) => renewalController.reconcileRenewal(req, res));

// Stage 11: REFLECT
router.post("/:id/reflect", (req, res) => renewalController.reflectRenewal(req, res));

// ─────────────────────────────────────────────────────────────────────────────
// Helper Endpoints
// ─────────────────────────────────────────────────────────────────────────────

router.post("/:id/auto-process", (req, res) => renewalController.autoProcess(req, res));

export default router;
