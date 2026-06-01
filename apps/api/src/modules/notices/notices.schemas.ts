import { z } from "zod";

export const createNoticeSchema = z.object({
  title: z.string().min(2).max(140),
  content: z.string().min(2).max(8000),
  pinned: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const pinSchema = z.object({
  pinned: z.boolean(),
});
