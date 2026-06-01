import type { Request, Response, NextFunction } from "express";
import { google } from "googleapis";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { ApiError } from "../../utils/errors.js";
import { authService } from "./auth.service.js";
import { refreshCookieOptions, accessCookieOptions } from "../../utils/jwt.js";
import { redis } from "../../redis.js";
import { prisma } from "../../db.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

/** In-memory CSRF state store for OAuth flows (keyed by state random token) */
const oauthStateStore = new Map<string, { createdAt: number; provider: string }>();
const OAUTH_STATE_TTL = 5 * 60 * 1000; // 5 minutes

function generateOAuthState(provider: string): string {
  const state = crypto.randomBytes(32).toString("hex");
  oauthStateStore.set(state, { createdAt: Date.now(), provider });
  // Cleanup expired states
  for (const [k, v] of oauthStateStore.entries()) {
    if (Date.now() - v.createdAt > OAUTH_STATE_TTL) oauthStateStore.delete(k);
  }
  return state;
}

function validateOAuthState(state: string | undefined, expectedProvider: string): void {
  if (!state || !oauthStateStore.has(state)) {
    throw new ApiError(400, "Invalid OAuth state — possible CSRF attack");
  }
  const entry = oauthStateStore.get(state)!;
  oauthStateStore.delete(state); // one-time use
  if (entry.provider !== expectedProvider) throw new ApiError(400, "OAuth provider mismatch");
  if (Date.now() - entry.createdAt > OAUTH_STATE_TTL) throw new ApiError(400, "OAuth state expired");
}

const ssoGoogleClient = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || "",
  process.env.GOOGLE_CLIENT_SECRET || "",
  process.env.GOOGLE_SSO_REDIRECT_URI || "http://localhost:5000/api/v1/auth/sso/google/callback"
);

const ssoMsalClient = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID || "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}`
  }
});

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body as any;

      const userAgent = req.headers["user-agent"];
      const ip = req.ip;

      const result = await authService.login(email, password, {
        userAgent,
        ip,
      });

      if (result.twoFactorRequired) {
        return res.json({
          ok: true,
          twoFactorRequired: true,
          loginToken: result.loginToken
        });
      }

      res.cookie("refreshToken", result.refreshToken, refreshCookieOptions());
      res.cookie("accessToken", result.accessToken, accessCookieOptions());

      res.json({
        ok: true,
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (e) {
      next(e);
    }
  },

  async verifyLoginTotp(req: Request, res: Response, next: NextFunction) {
    try {
      const { loginToken, code } = req.body;
      if (!loginToken || !code) {
        throw new ApiError(400, "Missing loginToken or 2FA code");
      }

      const result = await authService.verifyLoginTotp(loginToken, code);

      res.cookie("refreshToken", result.refreshToken, refreshCookieOptions());
      res.cookie("accessToken", result.accessToken, accessCookieOptions());

      res.json({
        ok: true,
        accessToken: result.accessToken,
        user: result.user
      });
    } catch (e) {
      next(e);
    }
  },

  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.signup(req.body);
      res.status(201).json({ ok: true, user: result });
    } catch (e) {
      next(e);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.refreshToken;
      if (!token) throw new ApiError(401, "Missing refresh token");

      const { accessToken, refreshToken } = await authService.refresh(token, {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // set rotated refresh token
      res.cookie("refreshToken", refreshToken, refreshCookieOptions());
      res.cookie("accessToken", accessToken, accessCookieOptions());

      res.json({ ok: true, accessToken });
    } catch (e) {
      next(e);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.refreshToken;
      if (token) await authService.logout(token);

      res.clearCookie("refreshToken", refreshCookieOptions());
      res.clearCookie("accessToken", accessCookieOptions());
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      
      // Verify there is an active, unrevoked session for this user
      const activeSession = await prisma.authSession.findFirst({
        where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      });
      if (!activeSession) {
        throw new ApiError(401, "Session expired or revoked");
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          organizationId: true,
          totpSecret: { select: { verified: true } },
        },
      });

      if (!dbUser) throw new ApiError(404, "User not found");

      const { totpSecret, ...rest } = dbUser;
      res.json({
        ok: true,
        user: {
          ...rest,
          twoFactorEnabled: totpSecret?.verified === true,
        },
      });
    } catch (e) {
      next(e);
    }
  },

  async getSecurityQuestion(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.query as any;
      const question = await authService.getSecurityQuestion(email);
      res.json({ ok: true, question });
    } catch (e) {
      next(e);
    }
  },

  async verifyResetProof(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, answer, totpToken } = req.body;
      const resetToken = await authService.verifyResetProof(email, answer, totpToken);
      res.json({ ok: true, resetToken });
    } catch (e) {
      next(e);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { resetToken, newPassword } = req.body;
      await authService.resetPassword(resetToken, newPassword);
      res.json({ ok: true, message: "Password reset successfully" });
    } catch (e) {
      next(e);
    }
  },

  async ssoGoogleStart(req: Request, res: Response) {
    const state = generateOAuthState("google");
    const url = ssoGoogleClient.generateAuthUrl({
      access_type: 'offline', prompt: 'consent',
      state,
      scope: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile']
    });
    res.redirect(url);
  },

  async ssoGoogleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, state } = req.query;
      validateOAuthState(state as string, "google");

      const { tokens } = await ssoGoogleClient.getToken(code as string);
      ssoGoogleClient.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: ssoGoogleClient });
      const userInfo = await oauth2.userinfo.get();
      
      const email = userInfo.data.email;
      if (!email) throw new ApiError(400, "No Google email found");

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // SSO new users must be approved — they start as PENDING
        const domain = email.split("@")[1];
        const mapping = await prisma.organizationDomain.findUnique({
          where: { domain },
          include: { organization: true },
        });
        if (!mapping) {
          throw new ApiError(403, "Your email domain is not registered. Contact your administrator.");
        }
        const org = mapping.organization;
        
        const dummyAnswerHash = await bcrypt.hash("SSO", 12);
        user = await prisma.user.create({
          data: {
            email,
            fullName: userInfo.data.name || "SSO User",
            passwordHash: "",
            phone: "0000000000",
            dob: new Date(),
            companyName: org.name,
            securityQuestion: "SSO",
            securityAnswer: dummyAnswerHash,
            securityAnswerRehashed: true,
            organizationId: org.id,
            role: "USER",
            status: "PENDING",
          },
        });
        // Redirect to a waiting page — approval needed
        const frontendBase = process.env.FRONTEND_URL || "http://localhost:3000";
        return res.redirect(`${frontendBase}/waiting-approval`);
      }

      if (user.status === "PENDING") {
        const frontendBase = process.env.FRONTEND_URL || "http://localhost:3000";
        return res.redirect(`${frontendBase}/waiting-approval`);
      }

      // Generate a short-lived one-time code (OTP) for security
      const otp = crypto.randomBytes(16).toString("hex");
      const otpData = {
        userId: user.id,
        email: user.email,
        role: user.role,
        orgId: user.organizationId,
      };
      await redis.set(`sso-otp:${otp}`, JSON.stringify(otpData), "EX", 60); // 60 second TTL

      const frontendBase = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendBase}/login?otp=${otp}`);
    } catch(e) { next(e); }
  },

  async ssoMicrosoftStart(req: Request, res: Response) {
    const state = generateOAuthState("microsoft");
    const url = await ssoMsalClient.getAuthCodeUrl({
      scopes: ["user.read"],
      state,
      redirectUri: process.env.MICROSOFT_SSO_REDIRECT_URI || "http://localhost:5000/api/v1/auth/sso/microsoft/callback",
    });
    res.redirect(url);
  },

  async ssoMicrosoftCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, state } = req.query;
      validateOAuthState(state as string, "microsoft");

      const response = await ssoMsalClient.acquireTokenByCode({
        code: code as string,
        scopes: ["user.read"],
        redirectUri: process.env.MICROSOFT_SSO_REDIRECT_URI || "http://localhost:5000/api/v1/auth/sso/microsoft/callback",
      });
      if (!response || !response.account) throw new ApiError(400, "Microsoft auth failed");

      const email = response.account.username;
      
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // SSO new users must be approved — start as PENDING
        const domain = email.split("@")[1];
        const mapping = await prisma.organizationDomain.findUnique({
          where: { domain },
          include: { organization: true },
        });
        if (!mapping) {
          throw new ApiError(403, "Your email domain is not registered. Contact your administrator.");
        }
        const org = mapping.organization;

        const dummyAnswerHash = await bcrypt.hash("SSO", 12);
        user = await prisma.user.create({
          data: {
            email,
            fullName: response.account.name || "SSO User",
            passwordHash: "",
            phone: "0000000000",
            dob: new Date(),
            companyName: org.name,
            securityQuestion: "SSO",
            securityAnswer: dummyAnswerHash,
            securityAnswerRehashed: true,
            organizationId: org.id,
            role: "USER",
            status: "PENDING",
          },
        });
        const frontendBase = process.env.FRONTEND_URL || "http://localhost:3000";
        return res.redirect(`${frontendBase}/waiting-approval`);
      }

      if (user.status === "PENDING") {
        const frontendBase = process.env.FRONTEND_URL || "http://localhost:3000";
        return res.redirect(`${frontendBase}/waiting-approval`);
      }

      // Generate a short-lived one-time code (OTP) for security
      const otp = crypto.randomBytes(16).toString("hex");
      const otpData = {
        userId: user.id,
        email: user.email,
        role: user.role,
        orgId: user.organizationId,
      };
      await redis.set(`sso-otp:${otp}`, JSON.stringify(otpData), "EX", 60); // 60 second TTL

      const frontendBase = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendBase}/login?otp=${otp}`);
    } catch(e) { next(e); }
  },

  async exchangeOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { otp } = req.body;
      if (!otp) throw new ApiError(400, "Missing OTP code");

      const stored = await redis.get(`sso-otp:${otp}`);
      if (!stored) throw new ApiError(400, "Invalid or expired OTP code");

      // Delete the OTP to prevent replay attacks
      await redis.del(`sso-otp:${otp}`);

      const { userId, email, role, orgId } = JSON.parse(stored);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { totpSecret: { select: { verified: true } } },
      });
      if (!user) throw new ApiError(404, "User not found");

      const userAgent = req.headers["user-agent"];
      const ip = req.ip;

      const { accessToken, refreshToken } = await authService.generateTokensForSSO(
        userId,
        email,
        role,
        orgId,
        { ip, userAgent }
      );

      res.cookie("refreshToken", refreshToken, refreshCookieOptions());
      res.cookie("accessToken", accessToken, accessCookieOptions());

      res.json({
        ok: true,
        accessToken,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          status: user.status,
          organizationId: user.organizationId,
          twoFactorEnabled: user.totpSecret?.verified === true,
        },
      });
    } catch (e) {
      next(e);
    }
  },
};
