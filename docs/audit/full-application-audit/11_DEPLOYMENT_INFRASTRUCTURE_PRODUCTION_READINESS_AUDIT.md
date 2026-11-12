# 11 — DEPLOYMENT, INFRASTRUCTURE & PRODUCTION READINESS AUDIT
**Project:** VeilX Autonomous Omnichain Social Finance & Tokenized Equities Terminal  
**Auditor:** Agent 11 — Infrastructure & Production Readiness Specialist  
**Status:** Audit Complete — Deep Configuration & Environment Inspection  
**Date:** November 11, 2026  
**Repository Path:** `C:\Users\HomePC\Downloads\VeilX-Agent`

---

## 📌 PLAIN-ENGLISH SUMMARY (READ THIS FIRST)

> **What is this document?**  
> This report looks at hosting, servers, and deployment: what happens when you deploy VeilX to Vercel or cloud hosting? Will it stay online, run smoothly, and keep your secret keys safe?

### In Plain Terms: How Ready is VeilX for Cloud Hosting?
1. **Serverless Setup is Good:**  
   * The app is cleanly packaged for Vercel, and the MongoDB connection pooling is set up correctly so the database doesn't get flooded with connections when lots of users visit.
2. **Missing Environment Checklist (Fail-Fast Gate):**  
   * If an environment variable (like an API key) is missing, the site builds anyway, but then crashes when someone clicks that feature. Adding a quick check (`env.mjs`) tells you immediately if an important secret is missing before you deploy.
3. **Automated Trading Cron Jobs on Vercel:**  
   * To have the AI copilot rebalance or check DCA orders every 15 minutes, Vercel needs to call the cron URLs. One cron job has a password check, but the password is not yet written into `.env.local`; the other cron job has no password at all. Synchronizing both ensures your automated agent runs 24/7 reliably.
4. **Error Tracking:**  
   * Currently, errors are only written to the computer terminal (`console.error`). Adding a free error logger (like Sentry) will immediately notify you if a user encounters a bug in production.

---

## 1. Executive Summary

This audit evaluates the deployment topology, cloud hosting architecture (Vercel Serverless / Node.js 20), cron schedule definitions, secrets management, environment variable validation, and production telemetry for VeilX.

### Production Readiness Assessment: **NEEDS HARDENING (Grade C+)**
- **Infrastructure Strengths:**
  - Modern Next.js 14 App Router optimized for Vercel edge/serverless distribution.
  - Serverless database pooling correctly implemented in `src/lib/mongodb.ts` via `global._mongoClientPromise`.
  - Non-custodial key handling: Relayer private keys are kept server-side in environment variables, never leaked to the client bundle.
- **Production Vulnerabilities & Operational Blockers:**
  - **Missing Environment Schema Validation (Fail-Fast Gate):** The app lacks build-time env validation. Missing secrets cause runtime HTTP 500 crashes instead of stopping the build.
  - **Cron Route Configuration Discrepancies:**
    - `/api/agent/cron-rebalance` requires `CRON_SECRET`, but `CRON_SECRET` is missing from `.env.local` and lacks documentation, returning HTTP 500 when triggered without it.
    - `/api/cron/evaluate-rules` (the rule evaluator) is **completely unauthenticated** (no header/token check) and is omitted from `vercel.json`.
  - **Zero Centralized Telemetry / APM:** Absence of Sentry, Datadog, or structured log drain. Errors are lost when serverless execution instances terminate.
  - **Permissive Security Headers:** `next.config.mjs` allows wildcards for images (`hostname: "**"`) and lacks Content Security Policy (CSP) and HSTS enforcement.

---

## 2. Infrastructure Inventory & Environment Audit

| Component | Target Platform | Current Repository State | Production Readiness Status |
| :--- | :--- | :--- | :---: |
| **Web & API Hosting** | Vercel Serverless (Node.js 20) | `next.config.mjs`, `vercel.json` | **Staging Ready** |
| **Database** | MongoDB Atlas Cluster | `src/lib/mongodb.ts` (cached pool) | **Production Ready** |
| **Escrow Relayer Wallet**| NEAR Testnet Account | `ESCROW_PRIVATE_KEY` in `.env.local` | **Testnet Ready (Needs Mainnet Vault)** |
| **Scheduled Tasks** | Vercel Crons | `vercel.json` (`*/15 * * * *`) | **Needs Authentication Fix** |
| **Environment Validation**| Build Pipeline | Missing (No Zod/T3 schema) | **Missing Fail-Fast Gate** |
| **Telemetry & APM** | Cloud Monitoring | Raw `console.log` / `console.error` | **Unmonitored** |
| **Security Headers** | Edge Network | `poweredByHeader: false` | **Needs CSP & HSTS** |

---

## 3. Detailed Infrastructure Findings

### [OPS-001] [HIGH] Lack of Build-Time Environment Variable Schema Validation
- **Severity:** HIGH
- **Status:** Missing
- **Affected Files:**
  - `src/app/layout.tsx`
  - `next.config.mjs`
  - `.env.local`
- **Actual Code Snippet & Analysis:**
  The repository does not validate required environment variables during `npm run build`. For example, `src/lib/mongodb.ts`:
  ```typescript
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
  }
  ```
  This check executes lazily when an API route is invoked. If an operator deploys to Vercel and forgets to configure `MONGODB_URI`, `ESCROW_PRIVATE_KEY`, or `SESSION_SECRET`, the Vercel build succeeds, but live user requests immediately crash with HTTP 500.
- **Impact:** Production outages caused by trivial deployment misconfigurations that could be caught at compile time.
- **Recommended Remediation:** Implement `src/env.mjs` using `@t3-oss/env-nextjs` or a Zod schema imported in `next.config.mjs` that halts compilation if required environment variables are absent.

---

### [OPS-002] [HIGH] Cron Route Vulnerabilities: Missing Secret & Unauthenticated Endpoint
- **Severity:** HIGH
- **Status:** Verified Existing / Misconfigured
- **Affected Files:**
  - `vercel.json` (lines 1–8)
  - `src/app/api/agent/cron-rebalance/route.ts` (lines 10–24)
  - `src/app/api/cron/evaluate-rules/route.ts` (lines 11–30)
- **Actual Code Snippet & Analysis:**
  1. In `src/app/api/agent/cron-rebalance/route.ts`:
  ```typescript
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron Rebalance] CRON_SECRET is not configured in environment");
    return NextResponse.json(
      { error: "Server misconfiguration: CRON_SECRET is not configured" },
      { status: 500 }
    );
  }
  ```
  `CRON_SECRET` is omitted from `.env.local`. When tested or triggered without configuring this variable, the endpoint fails with HTTP 500.
  2. In contrast, `src/app/api/cron/evaluate-rules/route.ts` contains:
  ```typescript
  export async function GET(req: NextRequest) {
    try {
      const db = await connectToDatabase();
      ...
      const portfolios = await Portfolio.find(query);
  ```
  This endpoint has **zero authentication or secret validation**. Any public client can trigger batch evaluations across all portfolios by making a GET request.
  3. `vercel.json` registers only `/api/agent/cron-rebalance` and omits `/api/cron/evaluate-rules` entirely.
- **Impact:** Cron jobs fail with HTTP 500 in default setups, while unprotected cron endpoints are exposed to public denial-of-service invocations.
- **Recommended Remediation:**
  1. Add `CRON_SECRET` to environment variable schemas.
  2. Add the same `Authorization: Bearer ${CRON_SECRET}` check to `/api/cron/evaluate-rules/route.ts`.
  3. Register both cron routes in `vercel.json`.

---

### [OPS-003] [HIGH] Absence of Centralized Production Error Monitoring & APM
- **Severity:** HIGH
- **Status:** Missing
- **Affected Files:** Global (`src/app/`, `src/lib/`)
- **Actual Code Snippet & Analysis:**
  Across all route handlers and libraries, exceptions are handled exclusively via:
  ```typescript
  console.error("Operation failed:", err);
  ```
  In a Vercel serverless environment, console logs are transient and stream only to ephemeral execution logs. There is no Sentry (`@sentry/nextjs`), Datadog, or Logflare integration configured.
- **Impact:** Production exceptions experienced by users (e.g. MPC signing timeouts, failed escrow claims) will go unnoticed by the engineering team until reported by users.
- **Recommended Remediation:** Install `@sentry/nextjs`, configure `sentry.client.config.ts` and `sentry.server.config.ts`, and enable automated alerting on HTTP 5xx spikes.

---

### [OPS-004] [MEDIUM] Overly Permissive Remote Image Configuration & Missing Security Headers
- **Severity:** MEDIUM
- **Status:** Verified Existing
- **Affected File:** `next.config.mjs` (lines 5–16)
- **Actual Code Snippet & Analysis:**
  ```javascript
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  ```
  Configuring `hostname: "**"` for both HTTP and HTTPS opens the Next.js image optimization endpoint (`/_next/image`) to server-side request forgery (SSRF) and remote image proxy abuse.
  Furthermore, `next.config.mjs` does not configure security headers (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`).
- **Impact:** Potential SSRF vulnerability through the Next.js image optimizer; clickjacking and MIME-sniffing exposure.
- **Recommended Remediation:**
  1. Restrict `remotePatterns` to trusted domains: `pbs.twimg.com`, `abs.twimg.com`, `unavatar.io`, `api.dicebear.com`.
  2. Define strict security headers in `next.config.mjs` headers function.

---

## 4. Production Readiness Verification Checklist

| Operational Gate | Target Requirement | Current Status | Remediation Required |
| :--- | :--- | :---: | :--- |
| **Static Typing** | `tsc --noEmit` exits with 0 | **FAIL** | Fix 8 compilation errors (`ARCH-001`) |
| **Production Build** | `npm run build` succeeds | **FAIL (due to tsc)** | Resolve TypeScript type mismatches |
| **Environment Fail-Fast**| Schema validation on startup | **FAIL** | Implement Zod env schema (`OPS-001`) |
| **Secrets Security** | Relayer private keys in vault | **PASS (Testnet)** | Set up AWS Secrets Mgr / Doppler for Mainnet |
| **Cron Security** | Bearer secret on all crons | **FAIL** | Secure `/api/cron/evaluate-rules` (`OPS-002`) |
| **APM / Telemetry** | Sentry integration active | **FAIL** | Connect `@sentry/nextjs` (`OPS-003`) |
| **Image Domain Whitelist**| Strict hostname whitelist | **FAIL** | Remove wildcard `**` pattern (`OPS-004`) |
| **DB Connection Pool** | Reuses Mongoose client | **PASS** | `global._mongoClientPromise` active |
| **HTTPS Enforcement** | Strict HSTS edge redirection | **PASS** | Managed via Vercel Edge Network |

---

## 5. Deployment Recommendations Summary

1. **P0 (Security):** Secure `/api/cron/evaluate-rules` with `CRON_SECRET` and remove image proxy wildcards (`OPS-002`, `OPS-004`).
2. **P0 (Stability):** Implement build-time environment schema validation (`OPS-001`).
3. **P1 (Operations):** Integrate Sentry for real-time error tracking and performance monitoring (`OPS-003`).
