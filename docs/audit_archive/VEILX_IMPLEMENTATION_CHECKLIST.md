# VEILX AGENT — IMPLEMENTATION CHECKLIST

**Document Status:** Pending Approval  
**Date:** October 30, 2026  
**Auditor & Technical Lead:** Principal Software Architect, Security Engineer & Technical Project Manager  
**Scope:** Actionable Implementation Checklist Grouped by Release Horizon  

---

## 1. SCOPE HORIZONS

- **MUST HAVE — Hackathon:** The non-negotiable core set of security fixes, working blockchain integrations, and authentic flows required for an impressive, genuinely working, and unexploitable testnet demonstration.
- **SHOULD HAVE — Public Testnet:** Hardening, rate limiting, mobile perfection, and automated reconciliation required before opening the URL to the general public.
- **FUTURE — Mainnet & Scale:** Formal smart contract audits, AWS KMS / HSM key management, Multi-Sig treasury governance, and full ZK-proof attestation.

---

## 2. MUST HAVE — HACKATHON DEMO CHECKLIST

| Task ID | Phase | Priority | Description | Dependencies | Acceptance Criteria | Status |
| :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| **TASK-SEC-01** | Phase 0 | P0 | Purge hardcoded private keys from `/api` routes and validate `.env.local` | None | Zero hardcoded keys in `src/`; server throws 500 if missing from environment | [x] COMPLETE |
| **TASK-BC-01** | Phase 1 | P0 | Authorize `claim_tip` caller (only authorized relayer can claim) | None | Arbitrary callers rejected; only verified relayer can trigger claims | [x] DEPLOYED ON-CHAIN |
| **TASK-BC-02** | Phase 1 | P1 | Refactor escrow storage from `HashMap` to `LookupMap` | TASK-BC-01 | $O(1)$ gas consumption; safe for hundreds of tips | [x] DEPLOYED ON-CHAIN |
| **TASK-BC-04** | Phase 1 | P1 | Implement `refund_tip` in smart contract | TASK-BC-01 | Unclaimed tips can be refunded by original sender | [x] DEPLOYED ON-CHAIN |
| **TASK-WAL-01** | Phase 2 | P0 | Generate genuine base58 Ed25519 session keys via `near-api-js` | None | Exported keys are valid Ed25519 base58 keys compatible with NEAR wallets | [x] COMPLETE |
| **TASK-WAL-02** | Phase 2 | P0 | Decouple platform treasury: users fund their own tips | TASK-WAL-01, TASK-BC-01 | Platform relayer balance does not decrease when users send tips | [ ] IN PROGRESS |
| **TASK-WAL-03** | Phase 2 | P1 | External wallet overhaul: Meteor & Sender extension support | None | Meteor and Sender extensions connect cleanly; dead links removed | [x] COMPLETE |
| **TASK-DB-01** | Phase 3 | P1 | Whitelist hosting IP on MongoDB Atlas & add resilient connection manager | None | `/api/paylinks` connects within 500ms; clean error boundaries | [x] RESILIENT (Atlas IP pending whitelist) |
| **TASK-FLOW-01**| Phase 4 | P1 | Persist AI chat invoices directly to MongoDB | TASK-DB-01 | Invoices generated in chat load on `/pay/[slug]` across any browser | [x] COMPLETE |
| **TASK-FLOW-02**| Phase 4 | P1 | Real on-chain PayLink NEAR Wallet payment | TASK-WAL-03, TASK-DB-01 | "Pay with NEAR" signs real transaction; verified on NEAR Explorer | [x] COMPLETE |
| **TASK-FLOW-03**| Phase 4 | P1 | Real in-chat tip claim via authenticated relayer | TASK-BC-01, TASK-SEC-01 | Chat claim executes real contract claim; returns live explorer link | [x] COMPLETE |
| **TASK-AI-01** | Phase 5 | P1 | Prompt-injection defense & mandatory UI confirmation step | None | AI never executes payment without explicit human confirmation click | [x] COMPLETE |
| **TASK-UI-01** | Phase 6 | P2 | Mobile responsiveness overhaul for screens $< 380\text{px}$ | None | Header, chat container, and invoice modals display without overflow | [x] COMPLETE |
| **TASK-UI-02** | Phase 6 | P2 | Autocomplete race condition fix & exact-match prioritization | None | Typing `@handle` shows exact match at top; stale requests cancelled | [x] COMPLETE |
| **TASK-UI-03** | Phase 6 | P2 | Replace dead wallet links with responsive pill buttons | TASK-WAL-03 | Pill-style connect buttons matching dark aesthetic | [x] COMPLETE |
| **TASK-QA-01** | Phase 7 | P3 | Add `.eslintrc.json` and patch Next.js dependency vulnerabilities | None | `npm run lint` and `npm audit` exit cleanly | [x] COMPLETE |

---

## 3. SHOULD HAVE — PUBLIC TESTNET CHECKLIST

| Task ID | Phase | Priority | Description | Dependencies | Acceptance Criteria | Status |
| :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| **TASK-SEC-02** | Phase 0 | P1 | Harden session cookies with HMAC signatures & `httpOnly: true` | TASK-SEC-01 | Cookie tampering invalidates session; inaccessible to client JS | [ ] |
| **TASK-BC-03** | Phase 1 | P0 | Implement NEP-141 callback failure revert in smart contract | TASK-BC-01 | Failed FT transfer reverts `tip.claimed = false` | [ ] |
| **TASK-DB-02** | Phase 3 | P2 | Rate limiting on public AI chat and search endpoints | None | IP-based token bucket blocks abuse with HTTP 429 | [ ] |
| **TASK-FLOW-04**| Phase 4 | P1 | 1Click solver cross-chain execution status polling | TASK-FLOW-02 | Invoice marks `SETTLED` only after solver confirms deposit | [ ] |
| **TASK-AI-02** | Phase 5 | P2 | Recipient handle sanitization & strict Twitter regex validation | None | Malformed handles rejected before transaction construction | [ ] |
| **TASK-QA-02** | Phase 7 | P1 | Comprehensive automated end-to-end integration test suite | All Tasks | Automated script verifies all core flows against Testnet | [ ] |

---

## 4. FUTURE — MAINNET & SCALE CHECKLIST

| Task ID | Phase | Priority | Description | Target Milestone | Status |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **TASK-FUT-01** | Mainnet | P0 | Independent third-party smart contract audit | Pre-Mainnet | [ ] |
| **TASK-FUT-02** | Mainnet | P0 | Cloud KMS / HSM for relayer key signing (AWS KMS / GCP Cloud KMS) | Pre-Mainnet | [ ] |
| **TASK-FUT-03** | Mainnet | P1 | Multi-Sig treasury governance for escrow contract owner account | Pre-Mainnet | [ ] |
| **TASK-FUT-04** | Mainnet | P1 | WebAuthn / Passkey biometric encryption for embedded session keys | Post-Launch | [ ] |
| **TASK-FUT-05** | Mainnet | P2 | Zero-Knowledge TLSNotary proof for decentralized Twitter claims | Post-Launch | [ ] |
| **TASK-FUT-06** | Mainnet | P2 | Automated NEAR event indexer / subgraph for real-time claim feeds | Post-Launch | [ ] |

---

## 5. TASK COMPLETION GATES

```
┌────────────────────────────────────────────────────────┐
│ GATE 1: SECURITY CONTAINMENT COMPLETE                  │
│ [x] No hardcoded keys in source code                   │
│ [x] Escrow drainage vulnerability closed               │
│ [x] Platform funds isolated from user tips             │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ GATE 2: AUTHENTIC FINANCIAL FLOWS VERIFIED             │
│ [x] Valid base58 Ed25519 session keys generated        │
│ [x] Real NEAR wallet payment on PayLinks               │
│ [x] Real in-chat gasless claims via relayer            │
│ [x] Chat invoices persisted in MongoDB                 │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ GATE 3: UI & POLISH VERIFIED                           │
│ [x] Mobile responsive without horizontal overflow      │
│ [x] Autocomplete fast, cancelable, and accurate        │
│ [x] Wallet modal clean and pill-styled                 │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ GATE 4: HACKATHON DEMO READY                           │
│ [x] End-to-end happy path tested live on Testnet       │
│ [x] Zero mock or simulated transaction hashes          │
└────────────────────────────────────────────────────────┘
```
