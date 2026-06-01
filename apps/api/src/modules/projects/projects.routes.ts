import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { validateBody } from "../../utils/validate.js";
import { projectsController } from "./projects.controller.js";
import {
  addMembersSchema,
  createProjectSchema,
  setHeadSchema,
  updateProjectSchema,
} from "./projects.schemas.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get("/", projectsController.list); // role-based: admin+ all org, others only their projects
projectsRouter.get("/:id", projectsController.getOne);

projectsRouter.post(
  "/",
  requireRole("ADMIN", "SUPER_ADMIN"),
  validateBody(createProjectSchema),
  projectsController.create
);
projectsRouter.patch(
  "/:id",
  requireRole("ADMIN", "SUPER_ADMIN"),
  validateBody(updateProjectSchema),
  projectsController.update
);

projectsRouter.post(
  "/:id/head",
  requireRole("ADMIN", "SUPER_ADMIN"),
  validateBody(setHeadSchema),
  projectsController.setHead
);

projectsRouter.post(
  "/:id/assign-admin",
  requireRole("SUPER_ADMIN"),
  projectsController.assignAdmin
);

projectsRouter.post(
  "/:id/assign-elite",
  requireRole("ADMIN", "SUPER_ADMIN"),
  projectsController.assignElite
);

projectsRouter.delete(
  "/:id",
  requireRole("ADMIN", "SUPER_ADMIN"),
  projectsController.deleteProject
);

projectsRouter.get("/:id/members", projectsController.listMembers);

// add/remove members: ADMIN/SUPER_ADMIN OR project HEAD (ELITE)
projectsRouter.post(
  "/:id/members",
  validateBody(addMembersSchema),
  projectsController.addMembers
);
projectsRouter.delete("/:id/members/:userId", projectsController.removeMember);
