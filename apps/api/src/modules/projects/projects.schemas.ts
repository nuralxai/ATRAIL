import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  headId: z.string().min(1).optional(), // should be ELITE
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional(),
});

export const setHeadSchema = z.object({
  headId: z.string().min(1).nullable(), // allow unsetting head
});

export const addMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
});
