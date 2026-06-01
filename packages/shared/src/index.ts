import { z } from "zod";

export const RoleEnum = z.enum(["SUPER_ADMIN", "ADMIN", "TENANT", "ELITE", "USER", "INTERN"]);
export type Role = z.infer<typeof RoleEnum>;

// Messaging rule helper (hierarchy rule)
// Note: This is the basic rule. ELITE->ADMIN requires explicit permission check via ChatPermission.
export function canMessage(from: Role, to: Role): boolean {
  if (from === "SUPER_ADMIN") return true; // super admin -> anyone
  if (from === "ADMIN" || from === "TENANT") return to === "ELITE" || to === "USER" || to === "INTERN" || to === "SUPER_ADMIN";
  if (from === "ELITE") return to === "USER" || to === "INTERN"; // ELITE->ADMIN requires permission, checked separately
  if (from === "USER" || from === "INTERN") return to === "SUPER_ADMIN" || to === "ADMIN" || to === "ELITE" || to === "USER" || to === "INTERN";
  return false;
}

// Check if ELITE can message ADMIN (requires explicit permission)
export function canEliteMessageAdmin(hasPermission: boolean): boolean {
  return hasPermission;
}

export const EnvSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  APP_TIMEZONE: z.string().default("Asia/Kolkata"),
  ENCRYPTION_KEY: z.string().min(32),
  REDIS_URL: z.string().default("redis://localhost:6379"),
});

export * from "./assets.js";
