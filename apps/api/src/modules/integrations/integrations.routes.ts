import { Router } from "express";
import { integrationsController } from "./integrations.controller.js";
import { requireAuth } from "../../middlewares/auth.js";

export const integrationsRouter = Router();

// Public OAuth callbacks — identity comes from base64url `state` param, not JWT
integrationsRouter.get("/google/callback", integrationsController.googleCallback);
integrationsRouter.get("/microsoft/callback", integrationsController.microsoftCallback);

// All other endpoints require login
integrationsRouter.use(requireAuth);

integrationsRouter.get("/", integrationsController.list);
integrationsRouter.delete("/:id", integrationsController.disconnect);

// Initiate OAuth (generates URL with state)
integrationsRouter.get("/google/auth", integrationsController.googleAuthUrl);
integrationsRouter.get("/microsoft/auth", integrationsController.microsoftAuthUrl);

// Sync Data
integrationsRouter.get("/sync/calendar", integrationsController.getCalendarEvents);
integrationsRouter.get("/sync/mails", integrationsController.getMails);

// Google Drive (user's own Drive, zero hosting cost)
integrationsRouter.get("/drive/files", integrationsController.driveListFiles);
integrationsRouter.get("/drive/search", integrationsController.driveSearchFiles);
integrationsRouter.post("/drive/share/:fileId", integrationsController.driveGetShareLink);

// Jira (API key based)
integrationsRouter.post("/jira/connect", integrationsController.jiraConnect);
integrationsRouter.get("/jira/issues", integrationsController.jiraIssues);
integrationsRouter.get("/jira/projects", integrationsController.jiraProjects);
integrationsRouter.post("/jira/issues", integrationsController.jiraCreateIssue);

// Linear (Personal API key)
integrationsRouter.post("/linear/connect", integrationsController.linearConnect);
integrationsRouter.get("/linear/issues", integrationsController.linearIssues);
integrationsRouter.get("/linear/teams", integrationsController.linearTeams);
integrationsRouter.post("/linear/issues", integrationsController.linearCreateIssue);


