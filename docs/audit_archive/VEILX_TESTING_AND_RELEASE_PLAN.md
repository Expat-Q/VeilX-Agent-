# VEILX AGENT — COMPREHENSIVE TESTING & RELEASE READINESS BLUEPRINT

**Document Version:** 1.0.0  
**Status:** DRAFT — AWAITING USER APPROVAL (PLANNING ONLY)  
**Date:** November 2, 2026

---

## 1. MULTI-TIER TESTING STRATEGY

```
+----------------------------------------------------------------------------------------------------+
|                                    TESTING PYRAMID & COVERAGE                                      |
|                                                                                                    |
|                                    / \                                                             |
|                                   / E2E \       Tier 4: End-to-End User Journeys (10 Scenarios)     |
|                                  /------- \                                                        |
|                                 / Security \    Tier 3: Attack Simulation & Invariant Tests (15)    |
|                                /------------\                                                      |
|                               /  Integration \  Tier 2: Backend API & Smart Contract Tests (25)   |
|                              /----------------\                                                    |
|                             /    Unit Tests    \ Tier 1: Client Crypto, Intent & Reducers (35)    |
|                            +--------------------+                                                  |
|                            TOTAL TEST SPECIFICATIONS: 85 TESTS                                     |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. MEASURABLE ACCEPTANCE CRITERIA

Before any milestone gate is approved, the system must strictly satisfy these twelve binary acceptance criteria:

1. **No Unauthorized Escrow Claim**: An attacker cannot claim an escrow tip addressed to another 𝕏 handle (`assert_panics("Recipient wallet does not match tip handle")`).
2. **Zero Duplicate Financial Execution**: Double-clicking a tip confirmation within 500ms executes exactly one on-chain transaction.
3. **No Unverified Invoice Settlement**: `PATCH /api/paylinks` strictly rejects settlement updates if the transaction hash is missing or unconfirmed on NEAR RPC.
4. **Zero Raw Private Key HTTP Transmissions**: Network request logging during tip broadcast contains zero `ed25519:` private keys.
5. **Atomic Multi-Device Spending Cap Enforcement**: Two concurrent $30 tips against a $50 daily cap strictly result in one success and one HTTP 403 rejection.
6. **Self-Healing Claim Mutex**: Tips locked in `status: "claiming"` automatically release to `"pending"` after 5 minutes of inactivity.
7. **No Unauthenticated Account Takeovers**: `POST /api/user` rejects unauthorized profile modifications with HTTP 401.
8. **No Hardcoded Crypto Fallbacks**: Under no circumstance does `/pay/[slug]` present or encode an unowned fallback address.
9. **Zero Mobile Header Horizontal Scroll**: At 320px viewport, `HeaderNav.tsx` renders without clipping or overflow.
10. **Isolated Telegram User Subaccounts**: Two different Telegram users executing `/evm` receive two distinct, non-colliding derived addresses.
11. **Verified AI Non-Execution Invariant**: Prompt injections cannot trigger on-chain transfers without an explicit user UI confirmation click.
12. **Zero P0 or P1 Unresolved Vulnerabilities**: All 4 Critical and 6 High vulnerabilities must be verified resolved.

---

## 3. RELEASE MILESTONE COMPLETION GATES

### Milestone A — Internal Development Readiness
- **Definition:** The codebase compiles with zero TypeScript errors, passes all unit tests, and maintains architectural consistency across models.
- **Criteria:**
  - `npx tsc --noEmit` exits with code 0.
  - `npm run build` succeeds without ESLint breaking errors.
  - MongoDB Atlas indexes are deployed.

---

### Milestone B — Hackathon Demonstration Readiness
- **Definition:** The platform reliably demonstrates its core vision without risking user funds or displaying broken UI states.
- **Criteria:**
  - AI copilot accurately resolves social tipping, PayLinks, and EVM balance inquiries.
  - PayLink digital receipts burst confetti and show explorer proofs on settlement.
  - Omnichain balance dropdown displays real NEAR testnet and Base Sepolia EVM balances.
  - Hardcoded fallback crypto addresses are completely purged (`TASK-SEC-04`).
  - Session verification bypass is patched (`TASK-SEC-01`).

---

### Milestone C — Public Testnet Release Gate
- **Definition:** Real public users can connect wallets, tip friends, create invoices, claim payouts, and chat safely.
- **Criteria:**
  - All 10 P0 and P1 security tasks (`TASK-SEC-01` through `TASK-SEC-06`, `TASK-BACK-01` through `TASK-BACK-03`, `TASK-TG-01`) are verified deployed.
  - Smart contract recipient validation override is removed (`TASK-SC-01`).
  - Native NEAR transfer callback is attached (`TASK-SC-02`).
  - Telegram bot enforces individual account linking (`TASK-TG-02`).
  - Full regression suite across all 25 failure scenarios passes.

---

### Milestone D — Mainnet Production Readiness
- **Definition:** Enterprise-grade security, hardware KMS relayer, Defuse 1Click solver integration with real capital, and formal third-party smart contract audit.
- **Criteria:**
  - Independent smart contract security audit report completed.
  - Defuse 1Click solver mainnet contracts integrated for instant cross-chain swaps.
  - Hardware Key Management Service (AWS KMS / Google Cloud KMS) managing the relayer keypair.
  - Distributed Upstash Redis cluster enforcing multi-region rate limiting.
  - 99.9% uptime SLA on RPC failover providers.
