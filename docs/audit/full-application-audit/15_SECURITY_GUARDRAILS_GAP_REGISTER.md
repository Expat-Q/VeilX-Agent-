# 15 — SECURITY GUARDRAILS GAP REGISTER
**Project:** VeilX Autonomous Omnichain Social Finance & Tokenized Equities Terminal  
**Auditor:** Agent 5, 6 & 7 — Master Security & Architecture Audit Team  
**Status:** Audit Complete  
**Date:** November 11, 2026  
**Repository Path:** `C:\Users\HomePC\Downloads\VeilX-Agent`

---

## 1. Executive Summary

This register serves as the authoritative, central repository of all identified security gaps, architectural vulnerabilities, network misconfigurations, and user safety deficiencies discovered during the full-application audit of VeilX.

Every gap is classified by:
- **Gap ID & Cross-Reference:** Mapped to individual audit reports (`SEC`, `BC`, `NET`, `REC`).
- **Severity Rating:** CRITICAL, HIGH, MEDIUM, LOW, or INFORMATIONAL based on CVSS v3.1 impact.
- **Affected Components & Code Evidence:** Line-by-line file locations with verified source citations.
- **Exploit Mechanics & Impact:** Operational or financial risk scenarios.
- **Defensive Guardrail & Remediation:** Actionable, verified engineering solutions.

---

## 2. Comprehensive Security Guardrails Gap Register

| Gap ID | Cross-Ref | Severity | Category | Affected File(s) & Lines | Description & Threat Scenario | Impact / Financial Risk | Recommended Defensive Guardrail |
| :---: | :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| **GAP-001** | **SEC-001** | **CRITICAL** | Authentication / Identity | `src/app/api/user/route.ts` (lines 62–123) | `POST /api/user` fails to enforce authentication when no cookie is sent, allowing unauthenticated callers to overwrite any Twitter user's record and mint a signed `veilx_session` cookie for that account. | Complete account takeover, theft of incoming tips, and unauthorized relayer claims. | Remove session cookie issuance from `POST /api/user`; require active verified session to update account. |
| **GAP-002** | **SEC-002** | **HIGH** | Spending Controls | `src/app/api/evm/prepare-tx/route.ts` (lines 52–242), `broadcast-tx/route.ts` (lines 19–94) | The primary non-custodial EVM signing pipeline in `near-client-signer.ts` bypasses spending cap validation. Neither `prepare-tx` nor `broadcast-tx` checks or updates `userDoc.spendingLimitUsd`. | Bypasses user spending limits ($50 default); enables runaway agent spend. | Query `User` model in `prepare-tx` (reject > cap with 403) and increment `spentUsd` in `broadcast-tx`. |
| **GAP-003** | **BC-001** | **HIGH** | Smart Contract / MPC | `src/app/api/evm/send-mpc/route.ts` (lines 77–102), `near-chain-signatures.ts` (lines 77–118) | Server-side MPC transactions call `sign()` using `CONTRACT_ID` (`veilx-agent.testnet`), causing MPC to derive a key for the contract instead of the user's account (`userSenderId`). | Broadcast EVM transactions fail with insufficient balance or spend from escrow instead of user. | Enforce client-side session key signing via `near-client-signer.ts` so `predecessor_account_id` matches user. |
| **GAP-004** | **BC-002** | **HIGH** | UX / Blockchain | `src/lib/near-chain-signatures.ts` (lines 398–414), `prepare-tx/route.ts` (lines 186–198) | Outbound ERC-20 transfers from derived EVM addresses throw a fatal error if the address holds zero native ETH to pay Base gas fees. | Web2 social users holding tipped USDC are unable to withdraw without external ETH bridging. | Implement an automated Base ETH gas relayer or integrate ERC-4337 Paymaster sponsorship. |
| **GAP-005** | **NET-001** | **HIGH** | Network Separation | `src/app/pay/[slug]/page.tsx` (lines 70–170, 863–873) | `EVM_CHAINS_CONFIG` targets EVM Mainnet (Base 8453, Arb 42161) while NEAR targets Testnet, and the receipt link hardcodes `testnet.nearblocks.io` for all EVM/Solana hashes. | Accidental mainnet capital spend; legitimate EVM payments show 404 block explorer errors. | Parameterize chain configs with network environment flag; dynamically resolve block explorer by chain. |
| **GAP-006** | **SEC-003** | **MEDIUM** | Session Security | `src/lib/session.ts` (lines 18–38) | HMAC session tokens contain no expiration timestamp (`exp`). Tokens never expire on the server and remain valid indefinitely. | Stolen session tokens can be replayed forever; no expiration enforcement. | Add `exp` timestamp in `signSessionPayload` and validate `Date.now() / 1000 <= exp` in `verifySessionToken`. |
| **GAP-007** | **SEC-004** | **MEDIUM** | Key Management | `src/lib/near-embedded-wallet.ts` (lines 54–63) | Embedded Ed25519 session private key is written to browser `localStorage` as plaintext JSON. | Vulnerable to key extraction in the event of any XSS flaw or rogue browser extension. | Encrypt session keys using WebCrypto AES-GCM before writing to storage. |
| **GAP-008** | **SEC-005** | **MEDIUM** | Denial of Service | `src/app/api/reconcile/route.ts` (lines 12–20) | Background reconciliation worker endpoint is publicly callable without authentication, API key, or cron secret. | External attackers can spam the endpoint, consuming DB connections and exhausting RPC quotas. | Enforce `Authorization: Bearer <CRON_SECRET>` on both `GET` and `POST` handlers. |
| **GAP-009** | **BC-003** | **MEDIUM** | Smart Contract | `contracts/veilx-escrow/src/lib.rs` (lines 10–11, 205–218) | Gas allocation for NEP-141 token transfers (`GAS_FOR_FT_TRANSFER = 20 Tgas`) is tight for complex token contracts with storage checks. | Claims on certain NEP-141 tokens may revert due to prepaid gas exhaustion. | Increase `GAS_FOR_FT_TRANSFER` to 30 Tgas and `GAS_FOR_RESOLVE` to 15 Tgas. |
| **GAP-010** | **NET-002** | **MEDIUM** | Infrastructure | `src/lib/near-chain-signatures.ts` (lines 283–291) | Falls back to public `https://mainnet.base.org` and `https://sepolia.base.org` without dedicated provider API keys. | Intermittent HTTP 429 Too Many Requests during high-volume trading or tipping. | Configure private RPC providers (Alchemy / Infura / QuickNode) via environment variables. |
| **GAP-011** | **REC-001** | **MEDIUM** | Performance | `src/app/api/reconcile/route.ts` (lines 48–97) | Reconciliation loop queries FastNear RPC serially in a blocking `for...of` loop. | Latency scales to 5–10+ seconds for 25 tips, risking serverless timeout. | Refactor to parallel queries using `Promise.allSettled`. |
| **GAP-012** | **SEC-006** | **LOW** | Secret Hygiene | `.env.local` (lines 14, 21, 29), root directory | `.env.local` containing live private keys (`ESCROW_PRIVATE_KEY`) is stored without a `.gitignore` file in root. | Accidental git push could expose production relayer keys and API secrets. | Create strict `.gitignore` ignoring `.env*`, `.next/`, and credentials. |
| **GAP-013** | **BC-004** | **LOW** | Transaction Reliability | `src/app/api/evm/prepare-tx/route.ts` (lines 114–121) | Nonce queries rely purely on RPC `pending` tag without local sequence caching. | Rapid back-to-back transfers can collide on identical nonces and fail. | Cache session nonces in memory (`Math.max(rpcNonce, lastNonce + 1)`). |
| **GAP-014** | **REC-002** | **LOW** | Data Consistency | `src/app/api/reconcile/route.ts` (line 85) vs `relay/claim/route.ts` (line 206) | Reconciler writes `Transaction.status = "completed"`, while relayer writes `status = "claimed"`. | Inconsistent status values in UI transaction histories. | Standardize on `status: "claimed"` across all claim resolution pathways. |
| **GAP-015** | **SEC-007** | **LOW** | Info Disclosure | `src/app/api/user/route.ts` (lines 27–35) | `GET /api/user?handle=...` returns `spendingLimitUsd` and `spentUsd` to unauthenticated callers. | Financial profiling of user accounts by third-party scrapers. | Omit spending limits from public query; return only public profile attributes. |

---

## 3. Remediation Prioritization & Action Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASE 0: CRITICAL BLOCKERS                      │
│ 1. Fix GAP-001: Close unauthenticated session forgery in POST /api/user│
│ 2. Fix GAP-002: Enforce spending caps in prepare-tx & broadcast-tx     │
│ 3. Fix GAP-005: Align EVM chains with Testnet in pay/[slug]/page.tsx   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASE 1: HIGH PRIORITY                          │
│ 4. Fix GAP-003: Require client-side session key signing for MPC calls  │
│ 5. Fix GAP-004: Implement gas sponsorship for zero-ETH derived accounts│
│ 6. Fix GAP-006: Add expiration timestamps (exp) to session tokens      │
│ 7. Fix GAP-008: Protect /api/reconcile with CRON_SECRET header         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASE 2: HARDENING & POLISH                     │
│ 8. Fix GAP-007: WebCrypto encryption for localStorage session keys     │
│ 9. Fix GAP-009: Increase FT gas limits in contracts/veilx-escrow       │
│ 10. Fix GAP-011: Parallelize reconciliation RPC queries                │
│ 11. Fix GAP-012: Add .gitignore to protect .env.local                  │
│ 12. Fix GAP-014: Standardize Transaction.status to "claimed"           │
└────────────────────────────────────────────────────────────────────────┘
```
