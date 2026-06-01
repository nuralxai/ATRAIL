import { z } from "zod";

export const triggerSchema = z.object({
  reason: z.string().max(2000).optional(),
  projectId: z.string().min(1).optional(),
});
