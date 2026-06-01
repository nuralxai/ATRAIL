# ATRAIL Security Implementation Plan
**Based on CIA Triad Audit — May 2026**

> This plan fixes every finding from the security audit, ordered by severity.  
> Each step has a clear owner, exact files to touch, and the code change required.  
> Complete phases in order — later phases depend on earlier ones.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| 🔴 CRITICAL | Must fix before any production traffic |
| 🟠 HIGH | Fix before first external user |
| 🟡 MEDIUM | Fix within first sprint after launch |
| 🟢 LOW | Fix within first month |

---

## Phase 0 — Emergency: Rotate All Exposed Secrets (Day 1, < 1 hour)

These secrets are in the `.env` file and potentially in version control history.  
**Do this before writing a single line of code.**

### Step 0.1 — Revoke & Regenerate Every Secret

| Secret | Where to Revoke | Replace With |
|--------|----------------|--------------|
| `JWT_ACCESS_SECRET` | N/A (self-signed) | `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | N/A (self-signed) | `openssl rand -base64 64` |
| `GOOGLE_CLIENT_SECRET` | console.cloud.google.com → Credentials | New secret from console |
| `MICROSOFT_CLIENT_SECRET` | portal.azure.com → App Registrations | New secret from portal |
| `NVIDIA_API_KEY` | build.nvidia.com → API Keys | New key from dashboard |
| `JIRA_API_TOKEN` | id.atlassian.com → Security → API tokens | Revoke & create new |
| `LINEAR_API_KEY` | linear.app → Settings → API | Delete & create new |

### Step 0.2 — Scrub Git History

```bash
# Install BFG Repo Cleaner
brew install bfg          # or download jar from rtyley.github.io/bfg-repo-cleaner

# Remove .env from all history
bfg --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force --all
```

### Step 0.3 — Add .env to .gitignore (if not already)

```bash
# File: .gitignore (root)
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore
echo "!.env.example" >> .gitignore
```

### Step 0.4 — Create .env.example (document all keys, no values)

**File:** `apps/api/.env.example`
```env
# Auth
JWT_ACCESS_SECRET=            # openssl rand -base64 64
JWT_REFRESH_SECRET=           # openssl rand -base64 64
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=14d

# Database
DATABASE_URL=postgresql://USER:PASS@HOST:PORT/DB?schema=public&sslmode=require

# Frontend
FRONTEND_URL=https://yourdomain.com

# AI
NVIDIA_API_KEY=               # build.nvidia.com

# OAuth — Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/v1/integrations/google/callback

# OAuth — Microsoft
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=https://yourdomain.com/api/v1/integrations/microsoft/callback
```

---

## Phase 1 — Confidentiality Fixes (Week 1)

### Step 1.1 🔴 — Move Access Token to httpOnly Cookie

**Problem:** `auth-store.ts` persists the access token in `localStorage`, which is readable by any JavaScript (XSS attack vector).

**Files to change:**
- `apps/web/lib/auth-store.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`

**Backend — set access token as httpOnly cookie on login:**

```typescript
// apps/api/src/modules/auth/auth.controller.ts — login handler
res.cookie("access_token", tokens.accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 15 * 60 * 1000,   // 15 minutes
});
res.json({ ok: true, user: tokens.user });
// ↑ Do NOT include accessToken in the JSON body anymore
```

**Frontend — remove token from Zustand persist, read from cookie automatically:**

```typescript
// apps/web/lib/auth-store.ts
// REMOVE: accessToken from the persisted fields
const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      // accessToken: null,   ← DELETE THIS LINE
      setAuth: (user) => set({ user }),
      clear: () => set({ user: null }),
    }),
    {
      name: "atrail-auth",
      partialize: (s) => ({ user: s.user }), // only persist user profile, NOT token
    }
  )
);
```

**Frontend — all API calls now rely on the cookie (credentials: "include" already set in apiFetch):**

```typescript
// apps/web/lib/api.ts — already has credentials: "include", no change needed
// The httpOnly cookie is sent automatically with every request
```

---

### Step 1.2 🔴 — Add SSL to Postgres Connection

**File:** `apps/api/.env`

```env
# BEFORE
DATABASE_URL="postgresql://postgres:postgres@localhost:5435/amgi?schema=public"

# AFTER (production)
DATABASE_URL="postgresql://postgres:STRONG_PASS@your-db-host:5432/amgi?schema=public&sslmode=require&sslrootcert=/path/to/ca.pem"

# AFTER (local dev — SSL optional locally)
DATABASE_URL="postgresql://postgres:STRONG_PASS@localhost:5432/amgi?schema=public"
```

**Also add Prisma SSL config:**

```typescript
// apps/api/src/db.ts
import { PrismaClient } from "./generated/client/index.js";

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
```

---

### Step 1.3 🟠 — Encrypt ConnectedAccount Tokens at Rest

**Problem:** Google, Microsoft OAuth tokens and Jira/Linear API keys stored as plain strings in DB.

**Install dependency:**
```bash
cd apps/api && pnpm add @aws-sdk/client-kms
# OR use simpler AES-256-GCM with a master key from env
```

**Create encryption utility:**

```typescript
// apps/api/src/utils/encrypt.ts
import crypto from "crypto";

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, "base64"); // 32-byte key

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decrypt(stored: string): string {
  const [ivB64, tagB64, encB64] = stored.split(".");
  const iv  = Buffer.from(ivB64,  "base64");
  const tag = Buffer.from(tagB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
```

**Add env key:**
```bash
# Generate once
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Add to .env
ENCRYPTION_KEY=<output>
```

**Use in integrations service:**
```typescript
// apps/api/src/modules/integrations/integrations.service.ts
import { encrypt, decrypt } from "../../utils/encrypt.js";

// When storing:
accessToken: encrypt(tokens.access_token),
refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,

// When reading for API calls:
oauth2Client.setCredentials({
  access_token:  decrypt(account.accessToken),
  refresh_token: account.refreshToken ? decrypt(account.refreshToken) : undefined,
});
```

**Add migration for existing data (one-time script):**
```typescript
// apps/api/scripts/encrypt-tokens.ts
// Read all ConnectedAccount records, encrypt tokens, write back
// Run once: npx tsx scripts/encrypt-tokens.ts
```

---

### Step 1.4 🟠 — Fix SSO Organization Assignment

**Problem:** `auth.controller.ts:196` assigns new SSO users to `findFirst()` org — completely wrong.

**File:** `apps/api/src/modules/auth/auth.controller.ts`

```typescript
// BEFORE (broken)
let org = await prisma.organization.findFirst();

// AFTER — map by email domain
async function resolveOrgFromEmail(email: string) {
  const domain = email.split("@")[1];

  // Option A: Look up org by domain mapping table (recommended)
  const mapping = await prisma.organizationDomain.findUnique({
    where: { domain },
    include: { organization: true },
  });
  if (mapping) return mapping.organization;

  // Option B: Require admin to pre-approve SSO (pending status)
  throw new ApiError(403, "Your email domain is not registered. Contact your administrator.");
}
```

**Add OrganizationDomain model to schema:**
```prisma
// apps/api/prisma/schema.prisma
model OrganizationDomain {
  id             String       @id @default(cuid())
  organizationId String
  domain         String       @unique   // e.g. "yourcompany.com"
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

**Run migration:**
```bash
cd apps/api && npx prisma migrate dev --name add_org_domain_mapping
```

---

### Step 1.5 🟡 — Fix Security Answer Hashing (SHA-256 → bcrypt)

**File:** `apps/api/src/modules/auth/auth.service.ts`

```typescript
// BEFORE
import { sha256 } from "../../utils/hash.js";
const answerHash = sha256(data.securityAnswer.toLowerCase().trim());

// AFTER
import bcrypt from "bcrypt";
const BCRYPT_ROUNDS = 12;
const answerHash = await bcrypt.hash(
  data.securityAnswer.toLowerCase().trim(),
  BCRYPT_ROUNDS
);

// Verification — also update verifyResetProof():
const match = await bcrypt.compare(
  answer.toLowerCase().trim(),
  user.securityAnswerHash
);
```

**Note:** Existing users will need to reset their security question on next login. Add a migration flag `securityAnswerRehashed: Boolean @default(false)` and prompt users to re-enter.

---

### Step 1.6 🟡 — Stop Putting Tokens in URLs

**File:** `apps/api/src/modules/auth/auth.controller.ts`

```typescript
// BEFORE — token in URL (logged everywhere)
res.redirect(`${frontendBase}/login?token=${accessToken}`);

// AFTER — use a short-lived one-time code
const otp = crypto.randomBytes(16).toString("hex");
await redis.set(`sso-otp:${otp}`, accessToken, "EX", 60); // 60 second TTL
res.redirect(`${frontendBase}/login?otp=${otp}`);

// Frontend exchanges the OTP for the real token via POST:
// POST /auth/exchange-otp  { otp }  → sets httpOnly cookie
```

---

## Phase 2 — Integrity Fixes (Week 2)

### Step 2.1 🟠 — Fix Cascade Deletes on Audit-Critical Tables

**Problem:** Deleting a user or org cascades to AuditLog and PaymentTransaction — destroying the audit trail.

**File:** `apps/api/prisma/schema.prisma`

```prisma
// BEFORE — AuditLog
user User? @relation(fields: [userId], references: [id], onDelete: Cascade)

// AFTER — keep log even if user is deleted
user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

// BEFORE — PaymentTransaction
organization Organization @relation(..., onDelete: Cascade)

// AFTER
organization Organization @relation(..., onDelete: Restrict)
// Restrict prevents deleting an org that has transactions
```

**Run migration:**
```bash
cd apps/api && npx prisma migrate dev --name fix_cascade_audit_payment
```

---

### Step 2.2 🟠 — Wrap Auth Session Creation in a Transaction

**File:** `apps/api/src/modules/auth/auth.service.ts`

```typescript
// BEFORE — two separate calls (crash between them = broken state)
const session = await prisma.authSession.create({ data: { ... } });
await prisma.authSession.update({
  where: { id: session.id },
  data: { refreshTokenHash: hash },
});

// AFTER — atomic
const session = await prisma.$transaction(async (tx) => {
  return tx.authSession.create({
    data: {
      userId,
      refreshTokenHash: hash,   // include hash in the create call directly
      ip:         req.ip,
      userAgent:  req.headers["user-agent"] ?? "",
      expiresAt:  new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });
});
```

---

### Step 2.3 🟠 — Move Brute-Force Counter to Redis

**Problem:** In-memory Map resets on restart; doesn't work across multiple API instances.

**Install:**
```bash
cd apps/api && pnpm add ioredis
```

**Create Redis client:**
```typescript
// apps/api/src/redis.ts
import Redis from "ioredis";
export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
```

**Replace in-memory counter:**
```typescript
// apps/api/src/middlewares/auth.ts

import { redis } from "../redis.js";

const MAX_ATTEMPTS = 5;
const WINDOW_SEC   = 15 * 60; // 15 minutes

export async function checkBruteForce(email: string, ip: string): Promise<void> {
  const key = `bf:${email}`;   // per-email global key (not per-IP)
  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, WINDOW_SEC);
  if (attempts > MAX_ATTEMPTS) {
    const ttl = await redis.ttl(key);
    throw new ApiError(429, `Too many attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`);
  }
}

export async function resetBruteForce(email: string): Promise<void> {
  await redis.del(`bf:${email}`);
}
```

**Add to .env:**
```env
REDIS_URL=redis://localhost:6379
```

---

### Step 2.4 🟡 — Add Rate Limiting to TOTP Endpoint

**File:** `apps/api/src/modules/auth/totp.ts`

```typescript
import { redis } from "../../redis.js";

async function totpRateLimit(userId: string): Promise<void> {
  const key = `totp:${userId}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, 5 * 60); // 5-minute window
  if (attempts > 5) {
    throw new ApiError(429, "Too many 2FA attempts. Try again in 5 minutes.");
  }
}

// In verify route handler:
router.post("/verify", requireAuth, async (req, res) => {
  const user = (req as any).user;
  await totpRateLimit(user.id);        // ← add this line
  // ... existing verify logic
});
```

---

### Step 2.5 🟡 — Validate Role Change Hierarchy

**File:** `apps/api/src/modules/users/users.service.ts`

```typescript
const ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 5, ADMIN: 4, ELITE: 3, USER: 2, TENANT: 1, INTERN: 0,
};

async changeRole(actorId: string, orgId: string, targetUserId: string, newRole: string) {
  const [actor, target] = await Promise.all([
    prisma.user.findUnique({ where: { id: actorId } }),
    prisma.user.findUnique({ where: { id: targetUserId, organizationId: orgId } }),
  ]);

  if (!actor || !target) throw new ApiError(404, "User not found");

  // Actor must outrank the target's current AND new role
  if (ROLE_RANK[actor.role] <= ROLE_RANK[target.role])
    throw new ApiError(403, "Cannot modify a user at or above your own rank");
  if (ROLE_RANK[actor.role] <= ROLE_RANK[newRole])
    throw new ApiError(403, "Cannot assign a role at or above your own rank");

  return prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole as any },
  });
}
```

---

## Phase 3 — Multi-Tenant Isolation Hardening (Week 3)

### Step 3.1 🟠 — Enable PostgreSQL Row-Level Security

This is the most important architectural change. Even if application code has a bug, the DB refuses cross-tenant queries.

**Create migration file:**

```sql
-- apps/api/prisma/migrations/20260526100000_enable_rls/migration.sql

-- Enable RLS on all tenant-scoped tables
ALTER TABLE "Task"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notice"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarEvent"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConnectedAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveRequest"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attendance"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asset"            ENABLE ROW LEVEL SECURITY;

-- Create policy function (reads org from session variable set per request)
CREATE OR REPLACE FUNCTION current_org_id() RETURNS TEXT AS $$
  SELECT current_setting('app.current_org_id', TRUE);
$$ LANGUAGE sql STABLE;

-- Apply policy to each table
CREATE POLICY tenant_isolation ON "Task"
  USING ("organizationId" = current_org_id() OR current_org_id() IS NULL);

CREATE POLICY tenant_isolation ON "Project"
  USING ("organizationId" = current_org_id() OR current_org_id() IS NULL);

-- Repeat for every table above...

-- Create a restricted DB role for the application (not superuser)
CREATE ROLE atrail_app LOGIN PASSWORD 'STRONG_APP_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO atrail_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO atrail_app;
```

**Set the org context per request in Express middleware:**

```typescript
// apps/api/src/middlewares/org-context.ts
import { RequestHandler } from "express";
import { prisma } from "../db.js";

export const setOrgContext: RequestHandler = async (req, _res, next) => {
  const user = (req as any).user;
  if (!user?.organizationId) return next();
  // Prisma raw query to set session variable
  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.current_org_id', $1, TRUE)`,
    user.organizationId
  );
  next();
};
```

**Register after `requireAuth` in routes:**
```typescript
// apps/api/src/routes.ts
import { setOrgContext } from "./middlewares/org-context.js";

// Apply globally after auth
apiRouter.use(requireAuth, setOrgContext);
```

---

### Step 3.2 🟠 — Add requireRole orgId Check

**File:** `apps/api/src/middlewares/auth.ts`

```typescript
// BEFORE — only checks role
export const requireRole = (...roles: string[]): RequestHandler =>
  (req, _res, next) => {
    const user = (req as any).user;
    if (!roles.includes(user.role)) return next(new ApiError(403, "Forbidden"));
    next();
  };

// AFTER — also verifies the request's orgId matches the user's orgId
export const requireRole = (...roles: string[]): RequestHandler =>
  (req, _res, next) => {
    const user = (req as any).user;
    if (!user) return next(new ApiError(401, "Unauthorized"));
    if (!roles.includes(user.role)) return next(new ApiError(403, "Forbidden"));

    // If the route has an :orgId param, verify it matches
    const paramOrgId = (req.params as any).orgId;
    if (paramOrgId && paramOrgId !== user.organizationId) {
      return next(new ApiError(403, "Organization mismatch"));
    }
    next();
  };
```

---

### Step 3.3 🟡 — Stop Email Enumeration on Forgot Password

**File:** `apps/api/src/modules/auth/auth.controller.ts`

```typescript
// BEFORE — returns real error if email not found (leaks email validity)
async getSecurityQuestion(req, res) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ message: "Email not found" }); // ← reveals existence

// AFTER — always return 200 with same shape
async getSecurityQuestion(req, res) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Return a fake question — don't reveal whether email exists
    return res.json({ ok: true, question: "What is your security question?" });
  }
  return res.json({ ok: true, question: user.securityQuestion });
}
```

---

## Phase 4 — Availability & Session Hardening (Week 4)

### Step 4.1 🟠 — Add Absolute Session Expiry

**File:** `apps/api/prisma/schema.prisma`
```prisma
model AuthSession {
  // ... existing fields
  createdAt    DateTime @default(now())
  absoluteExp  DateTime  // ← add this: never refreshable after this date
}
```

**File:** `apps/api/src/modules/auth/auth.service.ts`
```typescript
// When creating session:
absoluteExp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 day hard limit

// When validating refresh:
if (session.absoluteExp < new Date()) {
  await prisma.authSession.delete({ where: { id: session.id } });
  throw new ApiError(401, "Session expired. Please log in again.");
}
```

---

### Step 4.2 🟠 — Bind Sessions to IP + User-Agent

**File:** `apps/api/src/modules/auth/auth.service.ts`

```typescript
async refreshSession(token: string, req: Request) {
  const session = await prisma.authSession.findFirst({
    where: { refreshTokenHash: hash(token) },
  });
  if (!session) throw new ApiError(401, "Invalid session");

  // ← Add this check
  const ipMatch = session.ip === req.ip;
  const uaMatch = session.userAgent === req.headers["user-agent"];
  if (!ipMatch || !uaMatch) {
    // Possible token theft — invalidate ALL sessions for this user
    await prisma.authSession.deleteMany({ where: { userId: session.userId } });
    throw new ApiError(401, "Session invalid. All sessions have been terminated.");
  }
  // ... continue with refresh
}
```

---

### Step 4.3 🟡 — Add Pagination to All List Endpoints

**Pattern to apply to every list endpoint:**

```typescript
// apps/api/src/modules/tasks/tasks.service.ts
async listTasks(orgId: string, opts: { cursor?: string; limit?: number }) {
  const limit = Math.min(opts.limit ?? 50, 100); // cap at 100
  const tasks = await prisma.task.findMany({
    where:   { project: { organizationId: orgId } },
    take:    limit + 1,
    cursor:  opts.cursor ? { id: opts.cursor } : undefined,
    orderBy: { createdAt: "desc" },
  });
  const hasMore = tasks.length > limit;
  return {
    tasks:      hasMore ? tasks.slice(0, limit) : tasks,
    nextCursor: hasMore ? tasks[limit - 1].id : null,
  };
}
```

**Apply this pattern to:**
- `tasks.service.ts` → `listTasks`
- `projects.service.ts` → `listProjects`
- `chat.service.ts` → `listMessages`
- `analytics/index.ts` → all aggregate queries (add `take: 500` guard)
- `notices.service.ts` → `listNotices`
- `documents/index.ts` → `listDocuments`

---

### Step 4.4 🟡 — Add Express Request Timeout

**File:** `apps/api/src/index.ts`

```typescript
import { createServer } from "http";

const server = createServer(app);

// Close connections that hang longer than 30 seconds
server.setTimeout(30_000);

// Add to all routes — return 408 instead of hanging
app.use((_req, res, next) => {
  res.setTimeout(25_000, () => {
    res.status(408).json({ ok: false, message: "Request timeout" });
  });
  next();
});
```

---

### Step 4.5 🟢 — Add Endpoint-Specific Rate Limits

**File:** `apps/api/src/index.ts`

```typescript
import rateLimit from "express-rate-limit";

// Tight limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { ok: false, message: "Too many auth requests" },
});

// Normal API limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
});

// Heavy endpoints (analytics, search)
const heavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
});

app.use("/api/v1/auth",      authLimiter);
app.use("/api/v1/analytics", heavyLimiter);
app.use("/api/v1",           apiLimiter);
```

---

## Phase 5 — Make Audit Logs Immutable (Week 5)

### Step 5.1 🟡 — Database Trigger to Block AuditLog Modification

```sql
-- apps/api/prisma/migrations/20260526200000_immutable_audit/migration.sql

CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
```

### Step 5.2 🟡 — Add Cascade Protection on AuditLog

```prisma
// apps/api/prisma/schema.prisma
model AuditLog {
  userId String?
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  //                                                                    ↑ was Cascade
}
```

---

## Phase 6 — Infrastructure (Parallel with Phases 1–5)

### Step 6.1 🟠 — Docker Compose with Redis

**File:** `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: amgi
      POSTGRES_USER: atrail_app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    command: >
      postgres
        -c ssl=on
        -c ssl_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem
        -c ssl_key_file=/etc/ssl/private/ssl-cert-snakeoil.key

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data

  api:
    build: ./apps/api
    environment:
      DATABASE_URL: postgresql://atrail_app:${DB_PASSWORD}@postgres:5432/amgi?schema=public&sslmode=require
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
  redis_data:
```

---

### Step 6.2 🟠 — Use a Least-Privilege DB User

```sql
-- Run as postgres superuser once
CREATE ROLE atrail_app LOGIN PASSWORD 'STRONG_APP_PASSWORD';

-- Grant only what the app needs
GRANT CONNECT ON DATABASE amgi TO atrail_app;
GRANT USAGE ON SCHEMA public TO atrail_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO atrail_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO atrail_app;

-- The app user CANNOT drop tables, create roles, or access pg_catalog secrets
REVOKE CREATE ON SCHEMA public FROM atrail_app;
```

---

## Completion Checklist

Use this as a PR review gate before production:

### Phase 0 — Secrets
- [ ] All old secrets revoked
- [ ] Git history scrubbed
- [ ] `.env.example` committed, `.env` in `.gitignore`
- [ ] New strong secrets in secure vault (not in repo)

### Phase 1 — Confidentiality
- [ ] Access token removed from localStorage
- [ ] Access token set as httpOnly cookie on login
- [ ] Database connection uses `sslmode=require`
- [ ] ConnectedAccount tokens encrypted at rest
- [ ] SSO org assignment uses domain mapping, not `findFirst()`
- [ ] Security answers use bcrypt (not SHA-256)
- [ ] No tokens in redirect URLs

### Phase 2 — Integrity
- [ ] AuditLog `onDelete: SetNull` (not Cascade)
- [ ] PaymentTransaction `onDelete: Restrict`
- [ ] Auth session creation is atomic (`$transaction`)
- [ ] Brute-force counter uses Redis
- [ ] TOTP endpoint rate-limited (5 attempts / 5 min)
- [ ] Role changes enforce rank hierarchy

### Phase 3 — Multi-Tenant
- [ ] PostgreSQL RLS enabled on all tenant tables
- [ ] `app.current_org_id` session variable set per request
- [ ] `requireRole` verifies orgId on parameterized routes
- [ ] Forgot-password endpoint returns same response regardless of email existence

### Phase 4 — Availability
- [ ] Absolute session expiry (30 days hard limit)
- [ ] Session bound to IP + user-agent
- [ ] All list endpoints have cursor pagination with max-100 cap
- [ ] Express request timeout: 30 seconds
- [ ] Auth endpoints: 20 req / 15 min
- [ ] Analytics endpoints: 20 req / 1 min

### Phase 5 — Audit Integrity
- [ ] DB trigger blocks AuditLog UPDATE/DELETE
- [ ] AuditLog userId is SetNull on user delete

### Phase 6 — Infrastructure
- [ ] Redis running in Docker Compose
- [ ] Postgres uses SSL
- [ ] App runs as `atrail_app` role (not superuser)
- [ ] `atrail_app` cannot DROP or CREATE tables

---

## Risk Priority Matrix

```
CRITICAL (Do TODAY)          HIGH (This Week)         MEDIUM (This Sprint)
────────────────────         ─────────────────        ───────────────────
Rotate all secrets           DB SSL/TLS               Brute-force → Redis
Remove token from LS         Encrypt stored tokens    TOTP rate limit
Fix SSO org assignment       Fix cascade deletes      Pagination on lists
                             RLS on Postgres          Role hierarchy check
                             Session IP binding        Email enumeration fix
                             Atomic session create    Request timeout
```

---

*Generated: 2026-05-25 | Audit scope: ATRAIL v1 — apps/api + apps/web*  
*Next review recommended after each phase completion.*
