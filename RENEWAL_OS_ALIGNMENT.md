# Renewal OS Alignment & Implementation Plan

## Project Status Summary

✅ **Project successfully starts**: API runs on port 4000, Web on port 3002  
✅ **Database**: PostgreSQL with 9 migrations, schema up-to-date  
✅ **Tech Stack**: All core dependencies in place (Express, Next.js 14, Prisma, Redis)  
⚠️ **Alignment Gap**: Current schema is general-purpose; needs specialization for Renewal OS

---

## Current State vs. Renewal OS Vision

### What Exists ✅
- Multi-tenant Organization model
- User authentication with roles (SUPER_ADMIN, ADMIN, TENANT, USER)
- Asset & License tracking
- Vendor management
- Payment & Invoice tracking  
- Telegram bot integration
- Real-time Socket.io setup
- Analytics dashboard structure
- Document management

### What's Missing ❌

| Feature | Status | Priority |
|---------|--------|----------|
| **Renewal Workflow Model** | ❌ Missing | P0 |
| **Customer 360 Profile** | ❌ Missing | P0 |
| **11-Stage Renewal Engine** | ❌ Missing | P0 |
| **AM Action Queue** | ❌ Missing | P0 |
| **Renewal Scoring (ML)** | ❌ Missing | P1 |
| **Commission Wallet** | ❌ Missing | P1 |
| **Quote Generation** | ❌ Missing | P1 |
| **E-Signature Integration** | ❌ Missing | P1 |
| **Vendor API Sync** | ❌ Missing | P2 |
| **Voice AI Agent** | ❌ Missing | P2 |
| **Negotiation Coach** | ❌ Missing | P2 |
| **Churn Prediction** | ❌ Missing | P2 |

---

## Phase 1 Implementation Plan (Months 0–3)

### Week 1-2: Database Schema Updates

**Files to modify**: `/apps/api/prisma/schema.prisma`

#### New Models:
```prisma
model Customer {
  id String @id @default(cuid())
  organizationId String
  name String
  contacts CustomerContact[]
  departments Department[]
  healthScore Int @default(50) // 0-100
  churnRisk String @default("LOW") // LOW, MEDIUM, HIGH, CRITICAL
  paymentHistory PaymentTransaction[]
  renewals Renewal[]
  assets Asset[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([organizationId])
}

model Renewal {
  id String @id @default(cuid())
  organizationId String
  customerId String
  assetId String?
  amId String // Account Manager
  vendorId String
  
  // Core fields
  renewalDate DateTime
  expiryDate DateTime
  cycleStartDate DateTime
  
  // Pricing & Margin
  renewalCost Float
  margin Float
  marginPercent Float
  doRef String? // Delivery Order Reference
  invoiceRef String? // Invoice Reference
  
  // Status & Scoring
  status String @default("DRAFT") // DRAFT, QUOTED, NEGOTIATING, CLOSED, CANCELLED
  renewalLikelihood Int @default(50) // 0-100 ML score
  churnRisk String @default("LOW")
  upsellPotential Float @default(0)
  paymentStatus String @default("PENDING") // PENDING, PAID, OVERDUE, PARTIAL
  
  // Workflow
  lastOutreach DateTime?
  nextAction String?
  quoteSent Boolean @default(false)
  reminderCycle String? // aggressive, balanced, gentle
  notes String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([organizationId, customerId, status, renewalDate])
}

model CustomerContact {
  id String @id @default(cuid())
  customerId String
  name String
  email String?
  phone String?
  department String? // IT, Finance, HR, etc.
  title String?
  @@index([customerId])
}

model CommissionWallet {
  id String @id @default(cuid())
  userId String // Account Manager
  organizationId String
  balance Float @default(0)
  totalEarned Float @default(0)
  totalPaid Float @default(0)
  lastPayout DateTime?
  payoutSchedule String @default("MONTHLY") // WEEKLY, MONTHLY, QUARTERLY
  renewalEvents CommissionEvent[]
  @@unique([userId, organizationId])
}

model CommissionEvent {
  id String @id @default(cuid())
  walletId String
  renewalId String
  amount Float
  status String @default("ACCRUED") // ACCRUED, PAID, PENDING
  createdAt DateTime @default(now())
  @@index([walletId, renewalId])
}
```

#### Updated Models:
- **Asset**: Add fields: `doRef`, `invoiceRef`, `department`
- **Organization**: Add fields: `timezone`, `complianceSettings`
- **User**: Add fields: `territory`, `commissionTier`, `accountManagerFlag`

---

### Week 2-3: API Module Structure

**Files to create/update**:

```
apps/api/src/modules/
├── renewals/          (NEW)
│   ├── controller.ts
│   ├── service.ts
│   ├── routes.ts
│   └── workflow.ts      ← 11-stage orchestration
├── customers/         (NEW/UPDATE)
│   ├── controller.ts
│   ├── service.ts
│   └── routes.ts       ← Customer 360 endpoints
├── scoring/           (NEW)
│   ├── controller.ts
│   ├── ml-models.ts    ← Renewal likelihood, churn risk
│   └── routes.ts
├── commissions/       (NEW)
│   ├── controller.ts
│   ├── wallet.ts
│   └── routes.ts
└── quotes/            (NEW)
    ├── controller.ts
    ├── generator.ts    ← PDF quote generation
    └── routes.ts
```

---

### Week 3-4: AM Dashboard UI

**Files to create**: `/apps/web/app/dashboard/`

```
app/dashboard/
├── page.tsx                    ← AM action queue
├── renewals/
│   ├── calendar.tsx
│   ├── upcoming.tsx
│   └── [id]/
│       └── detail.tsx
├── customers/
│   ├── list.tsx
│   └── [id]/
│       └── 360-view.tsx
├── commissions/
│   ├── wallet.tsx
│   └── leaderboard.tsx
└── analytics/
    └── scorecard.tsx
```

---

## Immediate Next Steps

### 1. Database Migration (Start Here)
```bash
cd /home/ubuntu/atrail/apps/api

# Add new models to prisma/schema.prisma
# Then run:
pnpm prisma migrate dev --name "add-renewal-os-models"
pnpm prisma generate
```

### 2. API Routes
- Create renewals router in `/modules/renewals/routes.ts`
- Create customers router in `/modules/customers/routes.ts`
- Add to main `/routes.ts`

### 3. Frontend Pages
- Create dashboard landing page
- Build action queue component
- Add renewal calendar view

### 4. Integration Checklist
- [ ] Zoho CRM data import
- [ ] Tally invoice sync
- [ ] Razorpay payment gateway
- [ ] WhatsApp Business API
- [ ] Email/Outlook integration

---

## Environment & Configuration

### Required Env Variables (Already configured):
```
API_PORT=4000
FRONTEND_URL="http://localhost:3000"
DATABASE_URL="postgresql://postgres:postgres@localhost:5435/amgi?schema=public"
REDIS_URL="redis://localhost:6378"
```

### Database Ports:
- PostgreSQL: `localhost:5435`
- Redis: `localhost:6378`

### Start Containers:
```bash
docker-compose up -d
```

### Run API:
```bash
cd /home/ubuntu/atrail
pnpm --filter=@amgi/api dev  # Watch mode
# OR
cd apps/api && npx tsx src/index.ts  # Direct
```

### Run Web:
```bash
cd /home/ubuntu/atrail
pnpm --filter=@amgi/web dev  # On port 3002
```

---

## Architecture Notes

### Multi-Tenancy
- **Tenant Isolation**: Use `organizationId` in all queries
- **Row-Level Security**: PostgreSQL RLS policies recommended for extra safety
- **Data Segregation**: Middleware to enforce org context on all requests

### Renewal Workflow (11 Stages)
Will use **Temporal.io** in Phase 2 for orchestration. For Phase 1, implement as database state machine:
1. CAPTURE → (enrich data)
2. ENRICH → (compute scores)
3. SCORE → (schedule outreach)
4. SCHEDULE → (send message)
5. ENGAGE → (wait for response)
6. QUOTE → (generate & send)
7. NEGOTIATE → (track pushback)
8. CLOSE → (collect e-sig & payment)
9. PROVISION → (license provisioning)
10. RECONCILE → (accounting sync)
11. REFLECT → (feedback loop)

---

## Success Criteria (Phase 1)

- ✅ Database schema supports all 5 core entities
- ✅ AM can CRUD customers with 360 view
- ✅ Renewals can be created, tracked, updated
- ✅ Dashboard shows action queue with prioritization
- ✅ Commission wallet tracks earnings
- ✅ Multi-tenant isolation verified
- ✅ API endpoints have role-based auth
- ✅ Web dashboard functional (no AI yet)

---

## Secrets Management Note ⚠️

Current `.env` files contain exposed API keys:
- Google OAuth credentials
- Microsoft OAuth credentials
- Telegram Bot token
- NVIDIA API key
- Jira/Linear tokens

**TODO**: Move to environment-specific secrets or vault (HashiCorp Vault, AWS Secrets Manager, etc.)

---

*Last Updated: 2026-05-27*
