import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../../db.js";
import { ApiError } from "../../utils/errors.js";
import { sha256 } from "../../utils/hash.js";
import { UserStatus, Role } from "../../prisma-client.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";
import * as otplib from "otplib";
import { checkLoginBruteForce, recordLoginAttempt } from "../../middlewares/auth.js";
import { redis } from "../../redis.js";
import crypto from "crypto";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const speakeasy = require("speakeasy");

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const signupSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().min(10),
  dob: z.string(), // expected ISO or simple date string
  companyName: z.string().min(2),
  securityQuestion: z.string().min(5),
  securityAnswer: z.string().min(2),
});

const REFRESH_DAYS = 14;

export const authService = {
  async login(
    email: string,
    password: string,
    meta?: { userAgent?: string; ip?: string }
  ) {
    // Brute-force key = IP + email
    const bfKey = `${meta?.ip ?? "unknown"}:${email.toLowerCase()}`;
    await checkLoginBruteForce(bfKey);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { totpSecret: { select: { verified: true } } },
    });

    // Generic error for credential mismatches to avoid email enumeration
    const credentialError = new ApiError(401, "Invalid credentials");

    if (!user || !user.isActive) {
      await recordLoginAttempt(bfKey, false);
      throw credentialError;
    }

    if (user.status === UserStatus.PENDING) {
      throw new ApiError(403, "Your account is pending approval by an administrator.");
    }
    if (user.status === UserStatus.REJECTED) {
      throw new ApiError(403, "Your registration was rejected.");
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await recordLoginAttempt(bfKey, false);
      throw credentialError;
    }

    // Success — clear brute-force counter
    await recordLoginAttempt(bfKey, true);

    // If 2FA is enabled, return 2FA requirement instead of tokens
    if (user.totpSecret?.verified) {
      const loginToken = crypto.randomBytes(32).toString("hex");
      await redis.set(
        `login-totp:${loginToken}`,
        JSON.stringify({
          userId: user.id,
          orgId: user.organizationId,
          role: user.role,
          email: user.email,
          meta
        }),
        "EX",
        300 // 5 minutes
      );
      return {
        twoFactorRequired: true,
        loginToken
      };
    }

    const accessToken = signAccessToken({
      sub: user.id,
      orgId: user.organizationId,
      role: user.role,
    });

    // create session for refresh rotation
    const dummyRefresh = "temp"; // placeholder for hash update below
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
    const absoluteExp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days absolute limit

    const { session, refreshToken } = await prisma.$transaction(async (tx) => {
      const sess = await tx.authSession.create({
        data: {
          userId: user.id,
          refreshTokenHash: sha256(dummyRefresh),
          expiresAt,
          absoluteExp,
          userAgent: meta?.userAgent,
          ip: meta?.ip,
        },
      });

      const token = signRefreshToken({
        sub: user.id,
        sessionId: sess.id,
      });

      const updatedSess = await tx.authSession.update({
        where: { id: sess.id },
        data: { refreshTokenHash: sha256(token) },
      });

      return { session: updatedSess, refreshToken: token };
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        organizationId: user.organizationId,
        twoFactorEnabled: !!user.totpSecret?.verified,
      },
    };
  },

  async verifyLoginTotp(loginToken: string, code: string) {
    const key = `login-totp:${loginToken}`;
    const stored = await redis.get(key);
    if (!stored) throw new ApiError(400, "Invalid or expired login session");

    const { userId, orgId, role, email, meta } = JSON.parse(stored);

    // Fetch user TOTP secret
    const secretRecord = await prisma.tOTPSecret.findUnique({
      where: { userId }
    });
    if (!secretRecord || !secretRecord.verified) {
      throw new ApiError(400, "2FA is not set up on this account");
    }

    // Verify code
    const valid = speakeasy.totp.verify({
      secret: secretRecord.secret,
      encoding: "base32",
      token: code.trim(),
      window: 1
    });

    if (!valid) throw new ApiError(401, "Invalid 2FA code");

    // Success — delete login session token
    await redis.del(key);

    // Generate tokens
    const accessToken = signAccessToken({
      sub: userId,
      orgId,
      role,
    });

    const dummyRefresh = "temp";
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
    const absoluteExp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const { refreshToken } = await prisma.$transaction(async (tx) => {
      const sess = await tx.authSession.create({
        data: {
          userId,
          refreshTokenHash: sha256(dummyRefresh),
          expiresAt,
          absoluteExp,
          userAgent: meta?.userAgent,
          ip: meta?.ip,
        },
      });

      const token = signRefreshToken({
        sub: userId,
        sessionId: sess.id,
      });

      await tx.authSession.update({
        where: { id: sess.id },
        data: { refreshTokenHash: sha256(token) },
      });

      return { refreshToken: token };
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        fullName: user?.fullName || "",
        email: user?.email || "",
        role: user?.role || "",
        status: user?.status || "",
        organizationId: user?.organizationId || "",
        twoFactorEnabled: true,
      }
    };
  },

  async generateTokensForSSO(userId: string, email: string, role: string, orgId: string | null, meta?: { userAgent?: string; ip?: string }) {
    const accessToken = signAccessToken({ sub: userId, orgId, role });
    const dummyRefresh = "temp";
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
    const absoluteExp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days absolute limit

    const { refreshToken } = await prisma.$transaction(async (tx) => {
      const sess = await tx.authSession.create({
        data: {
          userId,
          refreshTokenHash: sha256(dummyRefresh),
          expiresAt,
          absoluteExp,
          userAgent: meta?.userAgent,
          ip: meta?.ip,
        },
      });

      const token = signRefreshToken({ sub: userId, sessionId: sess.id });

      await tx.authSession.update({
        where: { id: sess.id },
        data: { refreshTokenHash: sha256(token) },
      });

      return { refreshToken: token };
    });

    return {
      accessToken,
      refreshToken,
      user: { id: userId, email, role, organizationId: orgId }
    };
  },

  async signup(data: z.infer<typeof signupSchema>) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) throw new ApiError(400, "Email already registered");

    // find or create organization
    let org = await prisma.organization.findUnique({
      where: { name: data.companyName },
    });
    if (!org) {
      org = await prisma.organization.create({
        data: { name: data.companyName },
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const securityAnswerHash = await bcrypt.hash(data.securityAnswer.toLowerCase().trim(), 12);

    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        passwordHash,
        phone: data.phone,
        dob: new Date(data.dob),
        companyName: data.companyName,
        securityQuestion: data.securityQuestion,
        securityAnswer: securityAnswerHash,
        securityAnswerRehashed: true,
        organizationId: org.id,
        role: Role.USER, // Default role, admin will change it upon approval
        status: UserStatus.PENDING,
      },
    });

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      status: user.status,
    };
  },

  async refresh(refreshToken: string, meta?: { userAgent?: string; ip?: string }) {
    const payload = verifyRefreshToken(refreshToken);

    const session = await prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session) throw new ApiError(401, "Invalid session");
    if (session.revokedAt) throw new ApiError(401, "Session revoked");
    if (session.expiresAt < new Date())
      throw new ApiError(401, "Session expired");

    // Enforce absolute session expiry
    if (session.absoluteExp < new Date()) {
      await prisma.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new ApiError(401, "Session hard limit reached. Please log in again.");
    }

    const tokenHash = sha256(refreshToken);
    if (tokenHash !== session.refreshTokenHash)
      throw new ApiError(401, "Token mismatch");

    // Bind sessions to IP + User-Agent matching
    const ipMatch = !session.ip || session.ip === meta?.ip;
    const uaMatch = !session.userAgent || session.userAgent === meta?.userAgent;
    if (!ipMatch || !uaMatch) {
      // sus hijacking attempt — invalidate ALL sessions for this user
      await prisma.authSession.updateMany({
        where: { userId: session.userId },
        data: { revokedAt: new Date() },
      });
      throw new ApiError(401, "Session integrity check failed. All user sessions revoked.");
    }

    // rotate refresh token
    const newRefreshToken = signRefreshToken({
      sub: session.userId,
      sessionId: session.id,
    });
    
    const newExpiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: sha256(newRefreshToken),
        expiresAt: newExpiresAt,
      },
    });

    const newAccessToken = signAccessToken({
      sub: session.user.id,
      orgId: session.user.organizationId,
      role: session.user.role,
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async logout(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.authSession.update({
      where: { id: payload.sessionId },
      data: { revokedAt: new Date() },
    });
  },

  async getSecurityQuestion(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { securityQuestion: true },
    });
    if (!user) {
      return "What is your security question?";
    }
    return user.securityQuestion || "What is your security question?";
  },

  async verifyResetProof(email: string, answer: string, totpToken: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { totpSecret: true },
    });

    const cleanAnswer = answer.toLowerCase().trim();

    if (!user) {
      // Prevent timing attacks by performing a dummy bcrypt compare
      await bcrypt.compare(cleanAnswer, "$2b$12$LRY6z8X4k5H1Q3W6v6qYGe3v6Q2z.x3r7k8y2GvH5O4t1t1m2u2G");
      throw new ApiError(400, "Incorrect security answer");
    }

    // verify answer
    let isCorrect = false;
    if (user.securityAnswerRehashed) {
      isCorrect = await bcrypt.compare(cleanAnswer, user.securityAnswer || "");
    } else {
      const shaHash = sha256(cleanAnswer);
      isCorrect = (shaHash === user.securityAnswer);
      
      if (isCorrect && user.securityAnswer) {
        const bcryptHash = await bcrypt.hash(cleanAnswer, 12);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            securityAnswer: bcryptHash,
            securityAnswerRehashed: true,
          },
        });
      } else {
        // Run a dummy compare to make failed attempt times match
        await bcrypt.compare(cleanAnswer, "$2b$12$LRY6z8X4k5H1Q3W6v6qYGe3v6Q2z.x3r7k8y2GvH5O4t1t1m2u2G");
      }
    }

    if (!isCorrect) {
      throw new ApiError(400, "Incorrect security answer");
    }

    // verify TOTP
    if (user.totpSecret?.verified) {
      const valid = otplib.verify({
        token: totpToken,
        secret: user.totpSecret.secret,
      });
      if (!valid) throw new ApiError(400, "Invalid 2FA code");
    }

    // Generate a one-time reset token (JWT)
    const resetToken = signAccessToken(
      { sub: user.id, reset: true },
      "15m" // expires in 15 minutes
    );

    return resetToken;
  },

  async resetPassword(resetToken: string, newPassword: string) {
    const payload = verifyAccessToken(resetToken) as any;
    if (!payload.reset) throw new ApiError(401, "Invalid reset token");

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash },
    });

    // Revoke all sessions
    await prisma.authSession.updateMany({
      where: { userId: payload.sub },
      data: { revokedAt: new Date() },
    });
  },
};
