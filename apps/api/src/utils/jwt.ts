import jwt from "jsonwebtoken";
import { env } from "../env.js";
import type { Role } from "../generated/client/index.js";

export type AccessPayload = {
  sub: string;
  orgId?: string;
  role?: Role;
  reset?: boolean;
};

export type RefreshPayload = {
  sub: string;
  sessionId: string;
};

const ACCESS_EXPIRES_IN = "15m";
const REFRESH_EXPIRES_IN = "14d";

export function signAccessToken(payload: any, expiresIn: any = ACCESS_EXPIRES_IN): string {
  const options: jwt.SignOptions = { expiresIn };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET as string, options);
}

export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET as string, {
    expiresIn: REFRESH_EXPIRES_IN,
  });
}

export function verifyAccessToken(token: string): any {
  return jwt.verify(token, env.JWT_ACCESS_SECRET as string);
}

export function verifyRefreshToken(token: string): any {
  return jwt.verify(token, env.JWT_REFRESH_SECRET as string);
}

export const refreshCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/api/v1", // Allow cookie to be sent to all API endpoints
  maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days in milliseconds
});

export const accessCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/api/v1", // Allow cookie to be sent to all API endpoints
  maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
});
