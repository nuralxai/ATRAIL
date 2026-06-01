import { Router } from "express";
import { calendarController } from "./calendar.controller.js";
import { requireAuth } from "../../middlewares/auth.js";

export const calendarRouter = Router();

calendarRouter.use(requireAuth);

calendarRouter.get("/events", calendarController.getEvents);
calendarRouter.post("/events", calendarController.createEvent);
calendarRouter.post("/recurring-tasks", calendarController.createRecurringTask);
calendarRouter.post("/sync", calendarController.syncTasks);
