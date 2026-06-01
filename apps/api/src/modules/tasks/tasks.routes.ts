import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import { validateBody } from "../../utils/validate.js";
import { upload } from "../../utils/upload.js";
import {
  createTaskSchema,
  reviewSubmissionSchema,
  setMyTaskStatusSchema,
  submitTaskSchema,
} from "./tasks.schemas.js";
import { tasksController } from "./tasks.controller.js";

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

// Lists
tasksRouter.get("/my", tasksController.myTasks);
tasksRouter.get("/project/:projectId", tasksController.projectTasks);
tasksRouter.get("/:taskId", tasksController.getTask);

// Create task (ADMIN/SUPER_ADMIN or PROJECT HEAD)
tasksRouter.post(
  "/",
  validateBody(createTaskSchema),
  tasksController.createTask
);

// Assigned user actions
tasksRouter.patch(
  "/:taskId/my-status",
  validateBody(setMyTaskStatusSchema),
  tasksController.setMyStatus
);

// Submit with proofs (multipart)
tasksRouter.post(
  "/:taskId/submit",
  upload.array("files", 6),
  validateBody(submitTaskSchema),
  tasksController.submitTask
);

// Review submission (ACCEPT/REJECT)
tasksRouter.post(
  "/submissions/:submissionId/review",
  validateBody(reviewSubmissionSchema),
  tasksController.reviewSubmission
);
