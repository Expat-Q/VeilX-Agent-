# VEILX AGENT — BACKEND ARCHITECTURE & DATABASE AUDIT

**Target System:** VeilX Next.js 14 API Backend & MongoDB Atlas Data Store  
**Scope:** 25 REST Endpoints, 7 Data Models, Indexing, Consistency Reconciliation & Failure Resilience  
**Audit Date:** November 3, 2026  
**Auditor:** Senior Backend Systems Architect & Database Administrator  

---

## 1. BACKEND ROUTE & API INVENTORY (25 ROUTES)

| Endpoint | HTTP Method | Primary Purpose | Auth / Protection | Critical Finding / Status |
| :--- | :--- | :--- | :--- | :--- |
| `/api/near/send-tip` | POST | Deposits NEAR/FT to escrow contract or direct transfer. | `senderPrivateKey` | **[CRITICAL] P0-BE-01:** Transmits raw Ed25519 secret key over HTTP body. |
| `/api/near/withdraw` | POST | Sweeps funds from embedded session account to external wallet. | `senderPrivateKey` | **[CRITICAL] P0-BE-02:** Transmits raw Ed25519 secret key over HTTP body. |
| `/api/near/faucet` | POST | Dispenses 0.5 testnet NEAR to new user accounts. | In-memory IP rate limiter | **[HIGH] P1-BE-03:** In-memory rate limiter resets on serverless restart; vulnerable to drainage. |
| `/api/near/claim-subaccount` | POST | Provisions Phase 4 ephemeral stealth claim subaccount. | Server Relayer Key | Functional; charges gas to master deployer account. |
| `/api/near/chain-signatures/derive` | POST | Derives EVM address from NEAR MPC Root Key. | None (Public Math) | Verified functional; computes secp256k1 derived address. |
| `/api/evm/send-mpc` | POST | Constructs and submits MPC-signed Base Sepolia transactions. | Relayer Key | Verified functional; requires `MPC_PATH` and relayer gas. |
| `/api/telegram/webhook` | POST | Processes incoming Telegram bot updates and commands. | `secret_token` header | Verified functional; lacks Redis lock for duplicate update IDs. |
| `/api/telegram/simulate` | POST | Test harness to simulate Telegram commands locally. | Dev only | Disabled in production; no security exposure. |
| `/api/auth/twitter` | GET | Initiates OAuth 2.0 PKCE challenge redirect. | Session Cookie | Blocked if `TWITTER_CLIENT_ID` is missing from environment. |
| `/api/auth/callback/twitter`| GET | Exchanges OAuth code for access token & user profile. | PKCE State Check | Verified functional; persists handle in `User` collection. |
| `/api/auth/me` | GET | Returns authenticated user session and linked wallets. | JWT / Cookie | Returns 401 if unauthenticated. |
| `/api/paylinks` | GET / POST | Creates and lists cryptographic PayLink invoices. | User Session | Enforces AES-256-GCM memo encryption. Verified. |
| `/api/quotes` | POST | Fetches cross-chain swap quotes via Defuse 1Click API. | None | Verified functional with fallback mocks if Defuse offline. |
| `/api/quotes/status` | GET | Tracks 1Click swap order execution status. | Query param | Verified functional. |
| `/api/intents` | POST | Submits NEP-413 signed intent orders to solvers. | Session Key | Verified functional. |
| `/api/chat` | POST | AI conversational pipeline with hybrid routing. | Rate Limit | Verified functional (Fast-path <5ms + Gemini + NEAR TEE). |
| `/api/chat/history` | GET / DELETE | Retrieves or clears conversation messages. | Session ID | Verified functional. |
| `/api/reconcile` | POST | Syncs MongoDB status with `veilx-escrow.testnet` on-chain state. | Relayer Cron Secret | Verified functional. Scans unfinalized deposits/claims. |
| `/api/relay/claim` | POST | Relayer endpoint executing `claim_tip` on-chain. | OAuth Proof | Verifies Twitter handle match before signing contract claim. |
| `/api/transactions` | GET | Queries user deposit and claim transaction history. | Session / Wallet | Verified functional. |
| `/api/near/pending-tips` | GET | Returns unclaimed escrow tips matching recipient handle. | Handle query | Verified functional. |
| `/api/near/account` | GET | Fetches on-chain account state and balance via NEAR RPC. | Public Query | Fallback between official RPC and FastNEAR. |
| `/api/evm/balance` | GET | Queries Base Sepolia balance for derived MPC account. | Public RPC | Verified functional. |
| `/api/user` | GET / PUT | Manages user profile, preferences, and linked accounts. | Session Auth | Verified functional. |
| `/api/user/search` | GET | Autocompletes user handles for tipping input. | Rate Limited | Verified functional. |

---

## 2. DATABASE SCHEMA, INDEXING & DATA INTEGRITY AUDIT

### 2.1 Collection Models (`src/models`)
1. **`User.ts` (33 lines):**
   - Fields: `twitterHandle`, `twitterId`, `nearAccountId`, `sessionPublicKey`, `spendingLimit`, `createdAt`.
   - **Gap:** Missing unique index on `twitterId`. Duplicate registrations can occur if OAuth state check is bypassed.
2. **`EscrowTip.ts` (59 lines):**
   - Fields: `tipId`, `senderHandle`, `senderWallet`, `recipientHandle`, `recipientWallet`, `amountNear`, `status`, `commitment`, `privacySalt`, `stealthSubaccountId`.
   - **Indexes:** `{ tipId: 1 }` (unique), `{ recipientHandle: 1, status: 1 }`.
   - **Gap:** Missing TTL index on expired or uncompleted broadcasts.
3. **`PayLink.ts` (52 lines):**
   - Fields: `slug`, `creatorHandle`, `creatorWallet`, `amount`, `asset`, `encryptedMemo`, `iv`, `authTag`, `commitmentHash`, `status`.
   - **Indexes:** `{ slug: 1 }` (unique).
4. **`IntentOrder.ts` (60 lines):**
   - Tracks cross-chain Defuse 1Click solver swaps and settlement transactions.
5. **`TelegramChat.ts` (40 lines):**
   - Links Telegram `userId` with NEAR account IDs and pending action tokens.
6. **`Transaction.ts` (48 lines) & `ChatMessage.ts` (25 lines):**
   - Standard audit trail and session message logging.

---

## 3. BUSINESS LOGIC CONSISTENCY & CRITICAL VULNERABILITIES

### [CRITICAL] P0-BE-01: Plaintext Private Key Transmission Over HTTP
- **Affected File:** `src/app/api/near/send-tip/route.ts`, Lines 89–108
- **Mechanism:** The frontend reads the Ed25519 private key from the local session keypair and embeds it directly into the JSON POST payload: `{ senderPrivateKey: "ed25519:...", senderWallet: "alice.testnet", ... }`.
- **Architectural Violation:** VeilX markets itself as a non-custodial decentralized application. Transmitting the private key over HTTP to a Next.js server turns the backend into a custodial proxy. Any intermediate reverse proxy (Cloudflare, Vercel, Render), application logger, or memory dump will compromise the user's entire account key.
- **Remediation:** Remove `senderPrivateKey` from the backend API entirely. The client browser MUST construct the transaction bytes, sign the hash using `KeyPairSigner` locally in the browser, and either:
  1. Broadcast directly to NEAR RPC via `near-api-js`, OR
  2. Send the serialized, pre-signed `SignedTransaction` envelope to the relayer for gas sponsorship.

---

### [HIGH] P1-BE-03: Ephemeral In-Memory Rate Limiting
- **Affected File:** `src/lib/rate-limiter.ts`, Lines 9–35
- **Mechanism:** Rate limits are stored in a JavaScript `Map<string, RateLimitRecord>`.
- **Failure Mode:** On modern serverless deployments (Vercel, AWS Lambda, Render autoscaling), memory is not shared across instances, and containers cold-restart frequently. An attacker can bypass the 0.5 NEAR faucet limit by making concurrent requests across instances or restarting the pod.
- **Remediation:** Migrate rate limiting to Upstash Redis or MongoDB Atomic `$inc` with TTL.

---

### [MEDIUM] P2-BE-04: Hardcoded Fallback Mock Data in Public APIs
- **Affected File:** `src/app/pay/[slug]/page.tsx`, Lines 54–65
- **Code:**
  ```typescript
  if (!invoice) {
    // Fallback to demo mock
    invoice = {
      creatorHandle: "expatq3",
      amount: 15.0,
      description: "Website design and frontend development",
      ...
    };
  }
  ```
- **Vulnerability:** When a payer navigates to an invalid, misspelled, or deleted invoice slug (e.g., `/pay/random-xyz`), instead of returning a 404 error, the application displays a real-looking invoice for "expatq3" requesting $15.00! A confused user could pay 3.5 NEAR to `expatq3.testnet` believing they paid their intended recipient.
- **Remediation:** Remove fake mock fallback; return an explicit 404 page when the invoice is not found in MongoDB.

---

## 4. RECONCILIATION & SYNC MATRIX

```
┌─────────────────┐       POST /api/reconcile       ┌─────────────────┐
│  MongoDB Atlas  │ ◄────────────────────────────── │ Reconcile Worker│
│  `EscrowTip`    │                                 │ (Cron / Webhook)│
└────────┬────────┘                                 └────────┬────────┘
         │                                                   │
         │ Read "broadcasting" / "pending"                   │ Query Contract
         │                                                   ▼
         │                                          ┌─────────────────┐
         └────────────────────────────────────────► │ veilx-escrow    │
                     Compare tip.claimed            │ .testnet        │
                                                    └─────────────────┘
```

- `/api/reconcile/route.ts` correctly queries `get_tip(tip_id)` on `veilx-escrow.testnet`.
- If on-chain status is `claimed == true` but MongoDB status is `"pending"`, the worker updates MongoDB to `"claimed"` and records the resolution block height.
- **Verified:** Background reconciliation handles dropped websocket notifications gracefully.
