# 03 — BACKEND, API & ENDPOINT SECURITY AUDIT
**Project:** VeilX Autonomous Omnichain Social Finance & Tokenized Equities Terminal  
**Auditor:** Agent 3 — Backend, API & Endpoint Security Specialist  
**Status:** Audit Complete — Deep Line-by-Line Inspection  
**Date:** November 11, 2026  
**Target Repository:** `C:\Users\HomePC\Downloads\VeilX-Agent`  

---

## 📌 PLAIN-ENGLISH SUMMARY (READ THIS FIRST)

> **What is this document?**  
> This report inspects all 37 backend API routes (the server doorways that handle user logins, send money, check balances, and trigger automated jobs).

### In Plain Terms: What are the Key Issues & Fixes?
1. **The Login Bypass Hole in `/api/user` (CRITICAL):**  
   * *The Problem:* The code checks if the sender is logged in **only if** a session cookie exists. If someone sends a raw request with *no* cookies at all, the server mistakenly assumes it's a new signup, overwrites the victim's wallet address in the database, and gives the requester an official login cookie for that user!
   * *How to Fix:* Require a valid Twitter login or existing session for *any* update to an existing user handle.
2. **Chat History is Public to Anyone (`/api/chat/history`):**  
   * *The Problem:* Anyone can read, add fake messages to, or delete anyone else's chat history simply by typing their `@handle` into the URL, because there is no login check on the chat history route.
   * *How to Fix:* Only let users read and edit their own chat history.
3. **The Unlocked Background Cron Job (`/api/cron/evaluate-rules`):**  
   * *The Problem:* The URL that triggers DCA trading rules has no secret password. Anyone who knows the URL can ping it over and over. (Compare this to `/api/agent/cron-rebalance`, which is already properly protected by a password).
   * *How to Fix:* Add the same `CRON_SECRET` password check to `/api/cron/evaluate-rules`.
4. **Missing Rate Limiting (Speed Limits):**  
   * *The Problem:* Only one route (`/api/near/faucet`) has a rate limiter. Heavy endpoints like `/api/chat` (which uses your paid AI tokens) and `/api/evm/balance` (which calls 7 blockchain RPCs simultaneously) have no rate limits and could be spammed.
   * *How to Fix:* Plug in your existing rate limiter (`src/lib/rate-limiter.ts`) onto `/api/chat` and `/api/evm/balance`.

---

## 1. Executive Summary

This audit delivers an exhaustive line-by-line security and operational inspection of all server-side API routes under `src/app/api/` in the VeilX repository. The backend architecture consists of **36 route handler files** implementing **50 distinct HTTP method handlers** across 6 core functional domains: AI Copilot & Automated Trading, Authentication & Identity, NEAR Protocol & Escrow, Omnichain & Chain Signatures (EVM), PayLinks & Intents, and Market Data/Webhooks.

### Key Audit Findings:
1. **[CRITICAL] Account Takeover & Session Forgery in `POST /api/user`:** The session ownership check is conditionally executed only when an existing session cookie is present. If an unauthenticated attacker sends a request without cookies, the check is skipped, the target user's on-chain `nearAccountId` is overwritten in MongoDB, and the server mints and returns an authentic HMAC-signed `veilx_session` cookie for that victim handle ([API-001](#api-001-critical-unauthenticated-account-takeover--session-forgery-in-post-apiuser)).
2. **[CRITICAL] Chat History IDOR & Unauthenticated Data Tampering (`/api/chat/history`):** The `GET`, `POST`, and `DELETE` handlers have zero session authentication. Any caller can view, append arbitrary forged messages to, or permanently delete the conversational history of any user handle ([API-002](#api-002-high-complete-lack-of-authentication-and-authorization-on-chat-history-apichathistory)).
3. **[HIGH] Session Verification Bypass in `POST /api/near/send-tip`:** Similar to `/api/user`, the identity verification check only runs if `sessionCookie` exists. If omitted, the request creates transaction records attributed to arbitrary sender handles ([API-003](#api-003-high-broken-session-verification-in-post-apinearsend-tip-enabling-account-spoofing)).
4. **[HIGH] Withdrawal Verification Auth Bypass (`POST /api/near/withdraw`):** Session verification is wrapped in `if (userHandle)`. If `userHandle` is omitted from the JSON body, the check is completely bypassed ([API-004](#api-004-high-missing-authentication-check-in-post-apinearwithdraw-when-userhandle-is-omitted)).
5. **[HIGH] Pervasive Rate Limiting Gaps Across Compute-Heavy & Scraper Routes:** Only a single route (`/api/near/faucet`) enforces rate limiting via `checkRateLimit`. High-cost endpoints including `/api/chat` (Gemini LLM queries), `/api/evm/balance` (queries 7 EVM RPCs concurrently), and `/api/prices` have zero rate limiting ([API-005](#api-005-high-missing-rate-limiting-on-ai-copilot-gateway-post-apichat), [API-006](#api-006-high-unprotected-rate-limits-on-evm-multi-chain-rpc-scraper-get-apievmbalance)).
6. **[MEDIUM] Public Financial Data Exposure (`GET /api/transactions` & `GET /api/portfolio`):** Both endpoints expose full transaction ledgers, trading rules, positions, and cash balances to unauthenticated callers querying by handle ([API-007](#api-007-medium-idor-and-information-disclosure-on-financial-transactions-and-portfolio)).
7. **[MEDIUM] Unauthenticated Background Workers (`/api/cron/evaluate-rules` & `/api/reconcile`):** In contrast to `/api/agent/cron-rebalance` (which requires `Bearer <CRON_SECRET>`), `/api/cron/evaluate-rules` and `/api/reconcile` require no secret or token, allowing unbounded public invocation ([API-008](#api-008-medium-completely-unauthenticated-cron--reconcile-heartbeats)).

---

## 2. API Endpoint Audit & Threat Matrix

| Endpoint | Methods | Auth Mechanism | Rate Limited? | Input Validation | Risk Level | Status |
| :--- | :---: | :--- | :---: | :--- | :---: | :--- |
| `/api/agent/analyze` | `POST` | None (Public) | No | Partial (Type checks) | Low | Working |
| `/api/agent/cron-rebalance` | `GET` | `Bearer <CRON_SECRET>` | No | None (Header only) | Low | **Verified Secure** |
| `/api/auth/callback/twitter` | `GET` | PKCE State Cookie | No | Query params | Low | **Verified Working** |
| `/api/auth/me` | `GET`, `DELETE` | `veilx_session` Cookie | No | None | Low | **Verified Working** |
| `/api/auth/twitter` | `GET` | None (Public redirect) | No | URL query parsing | Low | **Verified Working** |
| `/api/chat` | `POST` | None (Optional custom key) | **No** | String type check | **HIGH** | Vulnerable to DoS/Quota Drain |
| `/api/chat/history` | `GET`, `POST`, `DELETE` | **None** | No | String checks | **HIGH** | **Vulnerable to IDOR/Tampering** |
| `/api/cron/evaluate-rules` | `GET` | **None** | No | Query param handle | **MEDIUM** | Unauthenticated Execution |
| `/api/evm/balance` | `GET` | None (Public) | **No** | Address/AccountId regex | **HIGH** | RPC Flooding Vector |
| `/api/evm/broadcast-tx` | `POST` | `veilx_session` Cookie | No | Hex string check | Low | **Verified Working** |
| `/api/evm/prepare-tx` | `POST` | `veilx_session` Cookie | No | 0x address regex | Medium | Broken account ID check |
| `/api/evm/send-mpc` | `POST` | `veilx_session` Cookie | No | 0x address regex | **HIGH** | Additive key derivation flaw |
| `/api/intents` | `GET`, `POST`, `PATCH` | Partial Session (PATCH) | No | Field presence | Medium | Unassigned order tamper |
| `/api/near/account` | `GET` | None (RPC Proxy) | No | String trim | Low | Working |
| `/api/near/chain-signatures/derive` | `GET` | None (Pure math) | No | String trim | Low | **Verified Working** |
| `/api/near/claim-subaccount` | `POST` | `veilx_session` Cookie | No | Handle matching | **CRITICAL** | Mongoose Schema Crash |
| `/api/near/faucet` | `POST` | IP + Account Sliding Window | **Yes** | String sanitize | Low | **Verified Working** |
| `/api/near/pending-tips` | `GET` | None (Public) | No | Handle trim | Low | Status mismatch with send-tip |
| `/api/near/price` | `GET` | None (Public) | No | None | Low | Working |
| `/api/near/rpc` | `POST`, `OPTIONS` | None (Open Proxy) | **No** | None | **MEDIUM** | Open proxy abuse vector |
| `/api/near/send-tip` | `POST` | Flawed Session Check | **No** | Nonce / txHash check | **HIGH** | Impersonation + Schema Bug |
| `/api/near/withdraw` | `POST` | Optional Session Check | No | txHash outcome check | **HIGH** | Auth bypass if handle omitted |
| `/api/paylinks` | `GET`, `POST`, `PATCH` | Session (cancellation only) | No | Slug / tx check | Medium | Unauthenticated link creation |
| `/api/portfolio` | `GET`, `POST` | Session (POST only) | No | Type guards | **MEDIUM** | GET exposes private positions |
| `/api/price` | `GET` | None (Public) | No | String symbol check | Low | Working |
| `/api/prices` | `GET` | None (Public) | No | CSV symbol split | Low | Working |
| `/api/proofs` | `GET`, `POST` | None (Public HMAC) | No | Required fields | Low | Working |
| `/api/quotes` | `POST` | None (Public) | No | Decimals/amounts | Low | Working |
| `/api/quotes/status` | `GET` | None (Public) | No | Address check | Low | Working |
| `/api/reconcile` | `GET`, `POST` | **None** | No | None | **MEDIUM** | Public execution vector |
| `/api/relay/claim` | `POST` | `veilx_session` Cookie | No | Session vs recipient | **HIGH** | Locked vs Pending enum bug |
| `/api/stocks/tokens` | `GET` | None (Public) | No | None | Low | Working |
| `/api/telegram/webhook` | `GET`, `POST` | Optional Secret Header | No | Update deduplication | **MEDIUM** | Auth bypassed if secret unset |
| `/api/transactions` | `GET`, `POST` | Session (POST only) | No | TxHash dedup | **MEDIUM** | Public financial history leak |
| `/api/user` | `GET`, `POST` | Flawed Session Check | No | Regex / sanitize | **CRITICAL** | **Account takeover & mint session** |
| `/api/user/search` | `GET` | None (Public) | No | Unescaped string | Low | Regex injection (ReDoS) |

---

## 3. Detailed Vulnerability & Security Findings

---

### [API-001] [CRITICAL] Unauthenticated Account Takeover & Session Forgery in `POST /api/user`
- **Severity:** CRITICAL (CVSS 9.8)
- **Status:** Verified Existing Vulnerability
- **Affected Route:** `POST /api/user`
- **Affected File & Lines:** `src/app/api/user/route.ts` (lines 62–122)
- **Vulnerability Mechanics:**  
  The endpoint verifies the active session cookie only if one is already present in the request headers:
  ```typescript
  // src/app/api/user/route.ts:62-72
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("veilx_session")?.value;
  const sessionUser = sessionCookie ? verifySessionToken(sessionCookie) : null;

  if (sessionUser && sessionUser.xHandle?.toLowerCase() !== cleanHandle.toLowerCase()) {
    return NextResponse.json(
      { error: "Unauthorized: Active authenticated session does not match this handle" },
      { status: 403 }
    );
  }
  ```
  If an unauthenticated attacker submits a request **without** a `veilx_session` cookie, `sessionUser` evaluates to `null`. The check passes entirely. The endpoint proceeds to update the victim's MongoDB record and unconditionally generates a new signed session token:
  ```typescript
  // src/app/api/user/route.ts:93-119
  const user = await User.findOneAndUpdate(
    { xHandle: cleanHandle },
    {
      xHandle: cleanHandle,
      nearAccountId: effectiveAccountId,
      spendingLimitUsd: validatedLimit,
    },
    { upsert: true, new: true }
  );

  const signedToken = signSessionPayload({
    xUserId: user.xUserId || `local_${cleanHandle.toLowerCase()}`,
    xHandle: cleanHandle.toLowerCase(),
    nearAccountId: user.nearAccountId,
    avatarUrl: user.avatarUrl,
  });

  cookieStore.set("veilx_session", signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  ```
- **Impact:** An attacker can provide `{ "xHandle": "target_user", "nearAccountId": "attacker.near" }` without credentials. This modifies the victim's payout address in MongoDB and responds with a valid `Set-Cookie: veilx_session=...` authenticating the attacker as the victim across all authenticated routes.
- **Recommended Remediation:**
  1. Require an authenticated session unconditionally for any updates to existing handles.
  2. Reject registration if `cleanHandle` is already registered without a matching Twitter OAuth user ID (`xUserId`).
  ```typescript
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized: Sign in via Twitter required" }, { status: 401 });
  }
  if (sessionUser.xHandle.toLowerCase() !== cleanHandle.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  ```

---

### [API-002] [HIGH] Complete Lack of Authentication and Authorization on Chat History (`/api/chat/history`)
- **Severity:** HIGH (CVSS 8.2)
- **Status:** Verified Existing Vulnerability
- **Affected Route:** `GET`, `POST`, `DELETE /api/chat/history`
- **Affected File & Lines:** `src/app/api/chat/history/route.ts` (lines 5–128)
- **Vulnerability Mechanics:**  
  The endpoint performs zero authentication across all three HTTP verbs:
  ```typescript
  // src/app/api/chat/history/route.ts:5-10
  export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get("handle") || "expatq3";
    const cleanHandle = handle.replace("@", "").trim();
    // ...
    const history = await ChatMessageModel.find({ userHandle: cleanHandle });
  ```
  In `POST`:
  ```typescript
  // src/app/api/chat/history/route.ts:45-54
  export async function POST(req: Request) {
    const body = await req.json();
    const { userHandle = "expatq3", role, content, actionCard, channel = "social" } = body;
    // Inserts directly into ChatMessageModel without verifying session
  ```
  In `DELETE`:
  ```typescript
  // src/app/api/chat/history/route.ts:105-121
  export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get("handle") || "expatq3";
    // Directly executes ChatMessageModel.deleteMany({ userHandle: cleanHandle })
  ```
- **Impact:** Unrestricted IDOR. Any user or scraper can read any other user's confidential copilot chat logs (including trading strategies, balances, and queries), inject arbitrary conversation turns, or permanently erase their chat logs.
- **Recommended Remediation:** Extract `veilx_session`, verify session payload, and enforce that `sessionUser.xHandle.toLowerCase() === cleanHandle.toLowerCase()`. Return HTTP 401/403 on mismatch.

---

### [API-003] [HIGH] Broken Session Verification in `POST /api/near/send-tip` Enabling Account Spoofing
- **Severity:** HIGH (CVSS 7.5)
- **Status:** Verified Existing Vulnerability
- **Affected Route:** `POST /api/near/send-tip`
- **Affected File & Lines:** `src/app/api/near/send-tip/route.ts` (lines 52–63)
- **Vulnerability Mechanics:**  
  ```typescript
  // src/app/api/near/send-tip/route.ts:52-62
  if (cleanSender) {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("veilx_session")?.value;
    const sessionUser = sessionCookie ? verifySessionToken(sessionCookie) : null;

    if (sessionUser && sessionUser.xHandle?.toLowerCase() !== cleanSender) {
      return NextResponse.json(
        { error: "Unauthorized: Session identity does not match sender handle" },
        { status: 403 }
      );
    }
  ```
  If `sessionCookie` is omitted, `sessionUser` is null and no error is returned. If the attacker includes `clientTxHash` (or passes an already confirmed on-chain hash), the route proceeds to write outbound transaction history records attributed to `senderHandle` in MongoDB (lines 105–118).
- **Impact:** Unauthenticated callers can forge ledger entries and spend-tracking records attributed to arbitrary Twitter handles.
- **Recommended Remediation:** If `cleanSender` is provided, require `sessionCookie` and `sessionUser`:
  ```typescript
  if (cleanSender) {
    if (!sessionUser || sessionUser.xHandle?.toLowerCase() !== cleanSender) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  ```

---

### [API-004] [HIGH] Missing Authentication Check in `POST /api/near/withdraw` When `userHandle` is Omitted
- **Severity:** HIGH (CVSS 7.1)
- **Status:** Verified Existing Vulnerability
- **Affected Route:** `POST /api/near/withdraw`
- **Affected File & Lines:** `src/app/api/near/withdraw/route.ts` (lines 26–39)
- **Vulnerability Mechanics:**  
  ```typescript
  // src/app/api/near/withdraw/route.ts:27-39
  if (userHandle) {
    const cleanHandle = userHandle.replace("@", "").trim().toLowerCase();
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("veilx_session")?.value;
    const sessionUser = sessionCookie ? verifySessionToken(sessionCookie) : null;

    if (!sessionUser || sessionUser.xHandle?.toLowerCase() !== cleanHandle) {
      return NextResponse.json(
        { error: "Unauthorized: Active session matching handle required for withdrawal" },
        { status: 401 }
      );
    }
  }
  ```
  If an unauthenticated caller sends `{ senderWallet: "victim.testnet", recipientAccount: "attacker.testnet", amountNear: 5, txHash: "..." }` without `userHandle`, the session check is entirely bypassed. The server verifies the on-chain tx outcome and responds with success without authenticating the caller.
- **Impact:** Unauthenticated execution of withdrawal processing and inability to attribute or audit withdrawals against registered user accounts.
- **Recommended Remediation:** Require `userHandle` as a mandatory payload field and enforce strict session ownership unconditionally.

---

### [API-005] [HIGH] Missing Rate Limiting on AI Copilot Gateway (`POST /api/chat`)
- **Severity:** HIGH (CVSS 7.5)
- **Status:** Verified Existing Vulnerability
- **Affected Route:** `POST /api/chat`
- **Affected File & Lines:** `src/app/api/chat/route.ts` (lines 535–615)
- **Vulnerability Mechanics:**  
  `/api/chat` receives user natural language messages and dispatches them to Google Gemini 2.0 Flash (`https://generativelanguage.googleapis.com/...`). There is no call to `checkRateLimit` or `checkPersistentRateLimit`.
- **Impact:** An attacker or automated script can send thousands of requests per minute, exhausting the project's Gemini API quota, inflating cloud billing, or creating denial-of-service conditions for regular users.
- **Recommended Remediation:** Apply IP and session-based sliding-window rate limiting (e.g. 20 requests per minute per IP):
  ```typescript
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const rateLimit = checkRateLimit(`chat_${ip}`, { limit: 20, windowMs: 60000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Please wait." }, { status: 429 });
  }
  ```

---

### [API-006] [HIGH] Unprotected Rate Limits on EVM Multi-Chain RPC Scraper (`GET /api/evm/balance`)
- **Severity:** HIGH (CVSS 7.5)
- **Status:** Verified Existing Vulnerability
- **Affected Route:** `GET /api/evm/balance`
- **Affected File & Lines:** `src/app/api/evm/balance/route.ts` (lines 164–196)
- **Vulnerability Mechanics:**  
  When called, this endpoint executes `Promise.allSettled` over 7 distinct EVM chains (Base Sepolia, Arbitrum Sepolia, Optimism Sepolia, Polygon Amoy, BNB Testnet, Avalanche Fuji, Ethereum Sepolia), querying both native ETH and ERC-20 USDC balances (up to 13 outbound JSON-RPC calls per request).
  ```typescript
  // src/app/api/evm/balance/route.ts:186-195
  const chainQueries = await Promise.allSettled(
    EVM_CHAINS.map(async (chain) => {
      const nativeBal = await queryEthBalance(chain.rpcUrl, cleanAddress);
      let usdcBal = "0.00";
      if (chain.usdcContract) {
        usdcBal = await queryErc20Balance(chain.rpcUrl, chain.usdcContract, cleanAddress, 6);
      }
      return { chain, nativeBal, usdcBal };
    })
  );
  ```
  There is zero rate limiting on this endpoint.
- **Impact:** 100 HTTP requests generate 1,300 outbound RPC calls within seconds. Public RPC nodes (Alchemy, Infura, PublicNode) will blacklist the application server's IP address.
- **Recommended Remediation:** Enforce `checkRateLimit` (e.g. 15 requests per minute per IP) and cache responses in memory for 15 seconds.

---

### [API-007] [MEDIUM] IDOR and Information Disclosure on Financial Transactions and Portfolio
- **Severity:** MEDIUM (CVSS 6.5)
- **Status:** Verified Existing Vulnerability
- **Affected Routes:** `GET /api/transactions`, `GET /api/portfolio`
- **Affected Files & Lines:** `src/app/api/transactions/route.ts` (lines 7–29), `src/app/api/portfolio/route.ts` (lines 9–45)
- **Vulnerability Mechanics:**  
  `GET /api/transactions?handle=target` queries the MongoDB `Transaction` collection and returns all completed tips, amounts in USD, memos, and counterparty handles.  
  `GET /api/portfolio?handle=target` returns all active equity positions, cash balances, trading rules, and execution history. Neither route checks session cookies on `GET`.
- **Impact:** Complete exposure of user financial activity, portfolio allocation, and custom algorithmic trading rules.
- **Recommended Remediation:** If the target handle does not match the active `veilx_session` cookie, return a sanitized public view or require session authorization.

---

### [API-008] [MEDIUM] Completely Unauthenticated Cron & Reconcile Heartbeats
- **Severity:** MEDIUM (CVSS 5.3)
- **Status:** Verified Existing Vulnerability
- **Affected Routes:** `GET /api/cron/evaluate-rules`, `GET` & `POST /api/reconcile`
- **Affected Files & Lines:** `src/app/api/cron/evaluate-rules/route.ts` (lines 11–37), `src/app/api/reconcile/route.ts` (lines 12–21)
- **Vulnerability Mechanics:**  
  `agent/cron-rebalance/route.ts` correctly validates `Authorization: Bearer <CRON_SECRET>`. However, `cron/evaluate-rules/route.ts` and `reconcile/route.ts` contain no authorization checks whatsoever. Anyone on the internet can call these endpoints continuously.
- **Impact:** Resource exhaustion, unexpected high-frequency execution of automated trading rules, and database lock contention.
- **Recommended Remediation:** Add bearer secret validation:
  ```typescript
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  ```

---

### [API-009] [MEDIUM] Open CORS JSON-RPC Proxy (`POST /api/near/rpc`)
- **Severity:** MEDIUM (CVSS 5.3)
- **Status:** Verified Existing Vulnerability
- **Affected Route:** `POST /api/near/rpc`, `OPTIONS /api/near/rpc`
- **Affected File & Lines:** `src/app/api/near/rpc/route.ts` (lines 47, 88)
- **Vulnerability Mechanics:**  
  Sets `"Access-Control-Allow-Origin": "*"` and forwards arbitrary JSON-RPC payloads to NEAR upstream nodes without rate limiting or authentication.
- **Impact:** Third parties can use the VeilX backend as a free, unmetered RPC proxy, consuming server network bandwidth and causing upstream node rate limiting.
- **Recommended Remediation:** Restrict `Access-Control-Allow-Origin` to VeilX application domains and apply rate limits.

---

### [API-010] [MEDIUM] Telegram Webhook Secret Bypass When Environment Variable Unset
- **Severity:** MEDIUM (CVSS 5.3)
- **Status:** Verified Existing Vulnerability
- **Affected Route:** `POST /api/telegram/webhook`
- **Affected File & Lines:** `src/app/api/telegram/webhook/route.ts` (lines 28–37)
- **Vulnerability Mechanics:**  
  ```typescript
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secretToken) {
    const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (incomingSecret !== secretToken) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }
  ```
  If `TELEGRAM_WEBHOOK_SECRET` is not set in `.env`, the conditional check is skipped, allowing anyone to post fake Telegram updates that trigger AI completions.
- **Recommended Remediation:** If `TELEGRAM_WEBHOOK_SECRET` is missing in production, reject incoming webhook requests with HTTP 500 or require the secret to be set.

---

### [API-011] [LOW] ReDoS Vulnerability in User Search Regex (`GET /api/user/search`)
- **Severity:** LOW (CVSS 3.7)
- **Status:** Verified Existing Vulnerability
- **Affected Route:** `GET /api/user/search`
- **Affected File & Lines:** `src/app/api/user/search/route.ts` (lines 96–98)
- **Vulnerability Mechanics:**  
  ```typescript
  const dbUsers = await User.find({
    xHandle: { $regex: `^${query}`, $options: "i" },
  }).limit(5);
  ```
  User input `query` is passed directly into a regular expression without escaping special regex characters (e.g. `(a+)+$`).
- **Recommended Remediation:** Escape special regex characters using `query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`.

---

### [API-012] [LOW] Inconsistent Error Response Schema Across API Routes
- **Severity:** LOW (CVSS 2.5)
- **Status:** Verified Existing Vulnerability
- **Affected Routes:** Across routes (`/api/price`, `/api/stocks/tokens`, `/api/intents`, `/api/chat`)
- **Description:** Multiple schemas are used: `{ error: string }`, `{ success: false, error: string }`, and `{ error: { code, message } }`.
- **Recommended Remediation:** Standardize on `{ success: false, error: string, code?: string }`.

---

## 4. Remediation Prioritization Roadmap

1. **P0 (Critical Hotfix):** Fix `POST /api/user` to require verified Twitter OAuth authentication before updating accounts or issuing `veilx_session` cookies.
2. **P0 (Critical Hotfix):** Fix Mongoose validation schema mismatches in `POST /api/near/claim-subaccount` and `POST /api/near/send-tip`.
3. **P1 (Security Hardening):** Add authentication to `GET / POST / DELETE /api/chat/history`.
4. **P1 (Security Hardening):** Add rate limiting (`checkRateLimit`) to `/api/chat`, `/api/evm/balance`, and `/api/prices`.
5. **P2 (Operational Integrity):** Secure `/api/cron/evaluate-rules` and `/api/reconcile` with `Bearer <CRON_SECRET>`.
6. **P3 (Sanitization):** Escape regex query parameters in `/api/user/search`.
