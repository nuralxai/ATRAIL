import { z } from "zod";

export const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(2).max(120),
  description: z.string().max(4000).optional(),
  assignedToId: z.string().min(1),
  dueAt: z.string().datetime().optional(), // ISO string
});

export const setMyTaskStatusSchema = z.object({
  status: z.enum(["ASSIGNED", "IN_PROGRESS", "SUBMITTED"]),
});

export const submitTaskSchema = z.object({
  notes: z.string().max(4000).optional(),
});

export const reviewSubmissionSchema = z.object({
  decision: z.enum(["ACCEPT", "REJECT"]),
  comment: z.string().max(2000).optional(),
});
