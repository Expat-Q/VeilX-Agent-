# VEILX AGENT — REMEDIATION PRIORITY LIST & EXECUTION ROADMAP

**Target System:** VeilX Omnichain Agent System  
**Audit Date:** November 3, 2026  
**Auditor:** Senior Full-Stack Software Architect & Technical Lead  

---

## 1. FINDINGS CLASSIFICATION MATRIX

| Finding ID | Severity | Description | Effort | Domain Group |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **P0 (Critical)** | Plaintext private key transmission in `/api/near/send-tip` & `/withdraw`. | Medium | Security Containment |
| **SEC-02** | **P0 (Critical)** | Ephemeral stealth subaccount prefix rejection in `veilx-escrow` contract. | Medium | Core Smart Contract |
| **FIN-01** | **P1 (High)** | Hardcoded $4.29 NEAR exchange rate in `/pay/[slug]` checkout. | Small | Financial Logic |
| **FIN-02** | **P1 (High)** | Missing timelock on smart contract `refund_tip` (sender frontrunning). | Small | Core Smart Contract |
| **FIN-03** | **P1 (High)** | Missing promise callback in contract native NEAR refund (locked funds risk). | Small | Core Smart Contract |
| **BE-01** | **P1 (High)** | In-memory sliding window rate limiter resets on serverless restart. | Medium | Backend Reliability |
| **UX-01** | **P1 (High)** | Hardcoded mock data fallback (`expatq3`, `$15.0`) on invalid invoice slugs. | Small | Frontend Reliability |
| **EXT-01** | **P1 (High)** | Twitter OAuth 2.0 blocked by missing Developer App credentials. | Personal | Auth Infrastructure |
| **TG-01** | **P2 (Medium)**| Telegram webhook lacks atomic deduplication on `update_id`. | Small | Telegram Bot |
| **AI-01** | **P2 (Medium)**| AI agent defaults un-denominated amounts to NEAR instead of USD prompt. | Small | AI Intelligence |
| **MOB-01**| **P2 (Medium)**| Horizontal overflow & header button collision on 320px–360px mobile screens. | Small | Mobile Optimization |
| **DB-01** | **P2 (Medium)**| Missing unique index on `twitterId` in User schema. | Small | Database Reliability |
| **SC-01** | **P2 (Medium)**| Contract storage griefing via unbounded deposits. | Medium | Core Smart Contract |
| **DOC-01**| **P3 (Low)**   | Ambiguous user-facing cryptographic terminology ("Commitment Hash"). | Small | Frontend UX |
| **DOC-02**| **P3 (Low)**   | Missing CSV transaction history export button linkage. | Small | Frontend UX |
| **TST-01**| **P3 (Low)**   | Standalone Node.js ESM import missing `.ts` extensions in test scripts. | Small | Testing & Release |

---

## 2. WORKSTREAM GROUPINGS & IMPLEMENTATION SEQUENCING

### Workstream 1: Immediate Security Containment (Day 1 — Priority P0)
- **Task 1.1:** Refactor client-side signing in `WalletSessionModal.tsx` and `src/lib/near-embedded-wallet.ts`. Ensure `signAndSendTransaction` executes directly in the browser via `near-api-js`.
- **Task 1.2:** Remove `senderPrivateKey` parameter from `/api/near/send-tip` and `/api/near/withdraw`.
- **Task 1.3:** Patch `contracts/veilx-escrow/src/lib.rs` to allow verified ephemeral stealth subaccounts (`claim-[6hex].veilx-agent.testnet`) to claim private tips.

### Workstream 2: Core Financial Integrity & Smart Contracts (Day 1–2 — Priority P1)
- **Task 2.1:** Implement timelock in `contracts/veilx-escrow/src/lib.rs` for `refund_tip` (`created_at + 7 days`).
- **Task 2.2:** Add `near_resolve_refund` promise callback in smart contract to prevent fund lockup on failed transfers.
- **Task 2.3:** Recompile `veilx-escrow` Rust contract to WASM and deploy updated binary to `veilx-escrow.testnet`.

### Workstream 3: Backend & Database Reliability (Day 2 — Priority P1–P2)
- **Task 3.1:** Replace in-memory rate limiter with MongoDB atomic `$inc` or Upstash Redis provider.
- **Task 3.2:** Eliminate fallback mock data in `/pay/[slug]` and return explicit 404/expired views.
- **Task 3.3:** Replace hardcoded `$4.29` price on invoice checkout with real-time price feed from `src/lib/near-price.ts`.
- **Task 3.4:** Add unique compound indexes on `User` and `EscrowTip` collections.

### Workstream 4: Telegram Bot & Identity Hardening (Day 2–3 — Priority P2)
- **Task 4.1:** Add atomic deduplication cache on `update_id` in `/api/telegram/webhook/route.ts`.
- **Task 4.2:** Complete `@BotFather` setup, set commands, and configure production webhook URL.

### Workstream 5: Frontend & Mobile Optimization (Day 3 — Priority P2–P3)
- **Task 5.1:** Resolve 320px–360px horizontal overflow in `HeaderNav.tsx` and `ChatInterface.tsx`.
- **Task 5.2:** Add modal height constraints (`max-h-[85vh] overflow-y-auto`) and simplified step breadcrumbs.
- **Task 5.3:** Replace raw cryptographic terms ("Commitment Hash") with intuitive labels ("Privacy Shield ID").

### Workstream 6: Testing, CI & Release Preparation (Day 3 — Priority P3)
- **Task 6.1:** Standardize module imports in test scripts for standalone Node.js execution.
- **Task 6.2:** Execute full master test suite (`test-near-ecosystem-integration.mjs`) and verify 100% pass rate.

---

## 3. DEPENDENCY & PARALLELIZATION CHART

```
                                  [Owner Personal Tasks]
                               (Twitter Keys, BotFather, Funding)
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             [Workstream 1: Security]                   [Workstream 4: Telegram]
          (Client Signing & Contract Patch)             (Deduplication & Commands)
                       │                                           │
                       ▼                                           │
            [Workstream 2: Contracts]                              │
          (Timelocks, Refunds, Deploy)                             │
                       │                                           │
         ┌─────────────┴─────────────┐                             │
         ▼                           ▼                             ▼
[Workstream 3: Backend]     [Workstream 5: Frontend]     [Workstream 6: Testing]
  (Price feeds, DB index)      (Mobile CSS & UX)            (Master Suite Pass)
```

- **Independent Parallel Tracks:**
  - Workstream 4 (Telegram bot deduplication) and Workstream 5 (Mobile CSS fixes) can proceed completely in parallel with Workstream 1 (Client-side signing refactor).
  - Smart contract updates (Workstream 2) require local WASM compilation before testnet contract migration.
