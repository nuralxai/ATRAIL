import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validateBody } from "../../utils/validate.js";
import { loginSchema, signupSchema } from "./auth.service.js";
import { authController } from "./auth.controller.js";
import { requireAuth } from "../../middlewares/auth.js";

/** Tight rate limits for sensitive auth endpoints */
const authLimiter = rateLimit({
  windowMs: 15 * 60_000, // 15 minutes
  limit: 10,             // max 10 attempts per window
  message: { ok: false, message: "Too many requests. Please wait 15 minutes and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  message: { ok: false, message: "Too many reset attempts. Please wait 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  message: { ok: false, message: "Too many refresh requests. Please wait." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRouter = Router();

authRouter.post("/login",  authLimiter, validateBody(loginSchema),  authController.login);
authRouter.post("/login/totp", authLimiter, authController.verifyLoginTotp);
authRouter.post("/refresh", refreshLimiter, authController.refresh);
authRouter.post("/logout",  authController.logout);
authRouter.get("/me",      requireAuth, authController.me);

authRouter.get("/forgot-password",         resetLimiter, authController.getSecurityQuestion);
authRouter.post("/reset-password/verify",  resetLimiter, authController.verifyResetProof);
authRouter.post("/reset-password/confirm", resetLimiter, authController.resetPassword);

authRouter.get("/sso/google", authController.ssoGoogleStart);
authRouter.get("/sso/google/callback", authController.ssoGoogleCallback);
authRouter.get("/sso/microsoft", authController.ssoMicrosoftStart);
authRouter.get("/sso/microsoft/callback", authController.ssoMicrosoftCallback);
authRouter.post("/sso/exchange-otp", authController.exchangeOtp);
