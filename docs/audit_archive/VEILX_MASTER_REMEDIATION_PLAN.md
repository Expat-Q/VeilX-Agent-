# VEILX AGENT — MASTER SYSTEM REMEDIATION & IMPLEMENTATION BLUEPRINT

**Document Version:** 1.0.0  
**Status:** DRAFT — AWAITING USER APPROVAL (PLANNING ONLY)  
**Date:** November 2, 2026  
**Audience:** Technical Project Lead, Core Developers, Security Auditors, AI Engineers  
**Target Repository:** `C:\Users\HomePC\Downloads\VeilX-Agent`

---

## 1. STRATEGIC OBJECTIVE & ARCHITECTURAL FOUNDATION

The objective of this Master Remediation Plan is to transition VeilX Agent from an impressive hackathon prototype with critical security, authentication, and settlement vulnerabilities into a hardened, non-custodial, omnichain social-finance platform ready for public testnet deployment and subsequent mainnet preparation.

### 1.1 Non-Negotiable Architectural Principles
1. **Strict Non-Custodial Key Architecture**: Private keys (Ed25519 session keys or seed phrases) MUST NEVER be transmitted over HTTP, logged to servers, or stored in unencrypted server databases. Signing must take place on the client (browser / WebCrypto) or via cryptographically verified NEP-366 meta-transactions.
2. **Zero-Trust Financial Settlement**: No payment or invoice can ever be marked `settled` or `completed` based solely on client claims. Every financial status transition requires verified on-chain cryptographic proof (NEAR RPC transaction status, receipt outcomes, and block inclusion).
3. **Defense-in-Depth Authorization**: The Large Language Model (LLM) is treated as an untrusted intent parser, never a security authority. Every tool execution requires deterministic backend permission checks, on-chain session key verification, and explicit interactive user confirmation.
4. **Resilient Data Consistency**: MongoDB Atlas serves as an indexed, queryable view of verified on-chain states, backed by automated reconciliation jobs and atomic database operations to eliminate race conditions and stuck locks.

---

## 2. AUDIT FINDINGS VALIDATION & REVISED TAXONOMY

During review of the audit findings against the live codebase, the following validations and refinements were established:

### 2.1 Confirmed & Validated Findings
- **SEC-AUTH-01 (`src/lib/session.ts`)**: Confirmed. Line 18 explicitly checks `if (token.startsWith("{")) return JSON.parse(token);`. This allows trivial session forgery by injecting raw JSON into the cookie.
- **SEC-USER-01 (`src/app/api/user/route.ts`)**: Confirmed. `POST /api/user` accepts any `{ xHandle, nearAccountId }` without authentication, writes to MongoDB, and issues a 30-day authenticated session cookie.
- **SEC-PAY-01 (`src/app/api/paylinks/route.ts`)**: Confirmed. `PATCH /api/paylinks` accepts any `settledTx` string and marks invoices `settled` without querying NEAR RPC.
- **SEC-FALLBACK-01 (`src/app/pay/[slug]/page.tsx`)**: Confirmed. Lines 328–329 fall back to hardcoded EVM and Solana strings (`5U3bSapFRXeistmGghFsagkE814e8E9qG2vU2K1`), which would cause total loss of funds if cross-chain quoting fails.
- **SEC-KEY-01 (`src/app/api/near/send-tip/route.ts`)**: Confirmed. Lines 20, 45–78 accept `senderPrivateKey` over HTTP.
- **SEC-CAP-01 (`src/components/chat/ChatContainer.tsx` & `/api/near/send-tip`)**: Confirmed. The $50 spending cap is checked strictly in React client state; `/api/near/send-tip` does not check or increment `spentUsd`.
- **TG-LINK-01 (`src/lib/telegram-bot.ts`)**: Confirmed. Line 96 hardcodes `const nearAccount = DEFAULT_NEAR_ACCOUNT;` (`veilx-agent.testnet`), sharing one account for all Telegram users.

### 2.2 Refined / Overlapping Findings
- **SEC-TX-01 (`/api/transactions`)**: Overlaps with `SEC-PAY-01`. Both suffer from unauthenticated writes into MongoDB `Transaction` collection. Unified under Task `TASK-BACK-02`.
- **SEC-MUTEX-01 (`/api/relay/claim`)**: Overlaps with `SEC-SC-03`. If an on-chain claim fails, the MongoDB lock must release, and the smart contract must have an atomic callback. Unified under `TASK-BACK-03` and `TASK-SC-02`.

---

## 3. PHASING & DEPENDENCY ROADMAP

```
+---------------------------------------------------------------------------------------------------+
| PHASE 0: Architectural Alignment & Schema Locking (Zero Code Changes)                            |
| • Canonical Data Models • Invariant Contracts • Scope Approval                                    |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| PHASE 1: Immediate Security & Financial Containment (P0 Critical)                                 |
| • Fix session forgery • Lock down /api/user • Purge hardcoded fallbacks • RPC payment proof       |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                        +-------------------------+-------------------------+
                        |                                                   |
                        v                                                   v
+---------------------------------------------------+   +-------------------------------------------+
| PHASE 2: Smart Contract & Signing Hardening       |   | PHASE 3: Backend & Database Reliability   |
| • Contract recipient validation                   |   | • Server-side spending cap & atomic inc   |
| • Native NEAR resolve callback                    |   | • Distributed rate limiter (Redis/Mongo)  |
| • Client-side NEP-366 signing refactor            |   | • Stale claim mutex unlocker worker       |
+-----------------------+---------------------------+   +---------------------+---------------------+
                        |                                                     |
                        +-------------------------+---------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| PHASE 4: Real Financial Journeys & On-Chain Reconciliation                                        |
| • End-to-end verified tips • Full PayLink settlement • Auto-indexing worker                       |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                        +-------------------------+-------------------------+
                        |                                                   |
                        v                                                   v
+---------------------------------------------------+   +-------------------------------------------+
| PHASE 5: Telegram Bot Architecture & /link Flow   |   | PHASE 6: AI Copilot Functional Expansion  |
| • Personal Telegram subaccount linking            |   | • Add cancel_invoice, query_history tools |
| • Webhook secret token verification               |   | • Multi-turn financial memory             |
+-----------------------+---------------------------+   +---------------------+---------------------+
                        |                                                     |
                        +-------------------------+---------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| PHASE 7: Frontend Polish & Onboarding Experience                                                  |
| • Session key authority onboarding modal • Deposit modal EVM tab • Clean navigation               |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| PHASE 8: Mobile Optimization Across 9 Breakpoints                                                 |
| • 320px–360px viewport responsiveness • Touch targets • Responsive action card modals             |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| PHASE 9: Full-System Integration, Automated Test Suite & Release Verification                     |
| • 70-test matrix • Failure scenario rehearsal • Milestone C Public Testnet Gate                   |
+---------------------------------------------------------------------------------------------------+
```

---

## 4. MASTER WORKSTREAM ALLOCATION

| Workstream | Lead Focus | Key Deliverables | Parallel Trackable? |
| :--- | :--- | :--- | :---: |
| **Stream A: Security & Core API** | Auth, API endpoints, signing architecture | Phase 1, Phase 3 | Yes (with Stream B) |
| **Stream B: Smart Contract & Crypto**| Rust contract, NEAR SDK, MPC Derivations | Phase 2 | Yes (with Stream A) |
| **Stream C: Telegram & AI Engine** | Bot linking, Webhooks, Gemini/Groq tools | Phase 5, Phase 6 | Dependent on Phase 3 |
| **Stream D: Frontend & UX Design** | UI components, modals, mobile responsiveness | Phase 7, Phase 8 | Dependent on Phase 4 |
| **Stream E: QA & Release Ops** | Vitest suites, load testing, RPC fallbacks | Phase 9 | Dependent on all phases |

---

## 5. COMPLETE REPOSITORY AUDIT & TASK DOCUMENTATION INDEX

All operational specifications are distributed across 11 companion blueprints:

1. [VEILX_DETAILED_TASK_BREAKDOWN.md](file:///C:/Users/HomePC/Downloads/VeilX-Agent/VEILX_DETAILED_TASK_BREAKDOWN.md) — 28 Granular Tasks with IDs, Files, Steps, and Acceptance Criteria.
2. [VEILX_ARCHITECTURE_AND_DATA_DECISIONS.md](file:///C:/Users/HomePC/Downloads/VeilX-Agent/VEILX_ARCHITECTURE_AND_DATA_DECISIONS.md) — Canonical Models, Enums, and Protocol Specifications.
3. [VEILX_FRONTEND_UX_IMPLEMENTATION_PLAN.md](file:///C:/Users/HomePC/Downloads/VeilX-Agent/VEILX_FRONTEND_UX_IMPLEMENTATION_PLAN.md) — Screen-by-Screen UI and Onboarding Blueprint.
4. [VEILX_SMART_CONTRACT_FIX_PLAN.md](file:///C:/Users/HomePC/Downloads/VeilX-Agent/VEILX_SMART_CONTRACT_FIX_PLAN.md) — Rust Escrow Contract Security & Deployment Strategy.
5. [VEILX_BACKEND_DATABASE_FIX_PLAN.md](file:///C:/Users/HomePC/Downloads/VeilX-Agent/VEILX_BACKEND_DATABASE_FIX_PLAN.md) — API Route Hardening, MongoDB Reliability & Reconciliation.
6. [VEILX_TELEGRAM_IMPLEMENTATION_PLAN.md](file:///C:/Users/HomePC/Downloads/VeilX-Agent/VEILX_TELEGRAM_IMPLEMENTATION_PLAN.md) — Bot Architecture, Commands, and Secure Deep-Linking.
7. [VEILX_AI_AGENT_IMPROVEMENT_PLAN.md](file:///C:/Users/HomePC/Downloads/VeilX-Agent/VEILX_AI_AGENT_IMPROVEMENT_PLAN.md) — Gemini Function Calling, Safety, and Evaluation Matrix.
8. [VEILX_SECURITY_REMEDIATION_PLAN.md](file:///C:/Users/HomePC/Downloads/VeilX-Agent/VEILX_SECURITY_REMEDIATION_PLAN.md) — Vulnerability Catalog, Attack Scenarios, and Containment.
9. [VEILX_PERSONAL_ACTION_PLAN.md](file:///C:/Users/HomePC/Downloads/VeilX-Agent/VEILX_PERSONAL_ACTION_PLAN.md) — Credentials, Developer Console Actions, and Approvals.
10. [VEILX_TESTING_AND_RELEASE_PLAN.md](file:///C:/Users/HomePC/Downloads/VeilX-Agent/VEILX_TESTING_AND_RELEASE_PLAN.md) — Multi-Tier Test Strategy and Milestone Completion Gates.
11. [VEILX_IMPLEMENTATION_TRACKER.md](file:///C:/Users/HomePC/Downloads/VeilX-Agent/VEILX_IMPLEMENTATION_TRACKER.md) — Master Execution Checklist and Progress Tracker.
