import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./env.js";
import { apiRouter } from "./routes.js";
import { billingGate } from "./middlewares/billing-gate.js";
import http from "http";
import path from "path";
import { initSocket } from "./socket.js";
import { bot } from "./modules/telegram/bot.js";
import { scheduleWeeklyDigest } from "./modules/telegram/digest.js";

const app = express();

app.use(pinoHttp());
app.use(helmet());
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://[::1]:3000",
      "https://atrail.in",
      "https://www.atrail.in",
    ],
    credentials: true,
  })
);

app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// Response timeout middleware (25 seconds)
app.use((_req, res, next) => {
  res.setTimeout(25_000, () => {
    if (!res.headersSent) {
      res.status(408).json({ ok: false, message: "Request timeout" });
    }
  });
  next();
});

// Targeted rate limiting configuration
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { ok: false, message: "Too many auth requests. Please wait 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const heavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  message: { ok: false, message: "Too many requests. Please try again in 1 minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/v1/auth", authLimiter);
app.use("/api/v1/analytics", heavyLimiter);
app.use("/api/v1", apiLimiter);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "amgi-api", env: env.NODE_ENV });
});

// Billing gate: runs after auth, before all business routes
app.use("/api/v1", billingGate);
app.use("/api/v1", apiRouter);

// Global error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err?.statusCode || 500;
  const message = err?.message || "Internal Server Error";
  res.status(status).json({ ok: false, message });
});

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const server = http.createServer(app);
initSocket(server);

// Close connection if request/headers takes more than 30s
server.setTimeout(30_000);

server.listen(env.API_PORT, () => {
  console.log(`API running on http://localhost:${env.API_PORT}`);
});

// ── Telegram Bot ─────────────────────────────────────────────────────────────
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;

if (WEBHOOK_URL) {
  // Production: webhook mode — set TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/v1/telegram/webhook
  app.use(bot.webhookCallback("/api/v1/telegram/webhook"));
  bot.telegram.setWebhook(WEBHOOK_URL).then(() => {
    console.log("[AtrailBot] Webhook set:", WEBHOOK_URL);
  }).catch((err: any) => {
    console.error("[AtrailBot] Failed to set webhook:", err?.message);
  });
} else {
  // Development / server without domain: long polling mode
  bot.launch({ dropPendingUpdates: true }).then(() => {
    console.log("[AtrailBot] Bot started in polling mode — @AtrailBot is live");
  }).catch((err: any) => {
    console.error("[AtrailBot] Failed to start bot:", err?.message);
  });
}

process.once("SIGINT",  () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// ── Weekly AI Digest ─────────────────────────────────────────────────────────
scheduleWeeklyDigest();
