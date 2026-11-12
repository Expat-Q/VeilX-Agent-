# 10 — TESTING, RELIABILITY & FAILURE-POINT AUDIT
**Project:** VeilX Autonomous Omnichain Social Finance & Tokenized Equities Terminal  
**Auditor:** Agent 10 — Testing, Reliability & Failure-Point Specialist  
**Status:** Audit Complete — Deep Code & Execution Inspection  
**Date:** November 11, 2026  
**Repository Path:** `C:\Users\HomePC\Downloads\VeilX-Agent`

---

## 1. Executive Summary

This audit assesses the automated testing infrastructure of the VeilX repository and constructs an exhaustive **System Failure-Point & Reliability Map** evaluating how the system handles node disconnections, RPC timeouts, LLM rate-limiting, wallet signature cancellations, and blockchain reorgs.

### Key Testing & Reliability Findings:
1. **Critical Testing Void:** The repository has **0% automated unit and integration test coverage**. There is no Jest, Vitest, Playwright, or Cypress test configuration in `package.json`. Testing has historically relied on ad-hoc scripts (`scripts/`).
2. **Broken Package.json Test Script:** Executing `npm run test:1click` fails immediately with an uncaught `HTTP 400: Quoting for this pair is not available` error from the live Defuse API.
3. **NEAR MPC Under-Deposit Risk:** In `src/lib/near-chain-signatures.ts`, calls to the NEAR MPC signer attach only `1 yoctoNEAR`, whereas testnet MPC signer nodes enforce signature fee deposits (0.05–0.25 NEAR), creating an on-chain panicking risk.
4. **Client-Tied Autonomous Execution:** Autonomous DCA and stop-loss rules run inside the browser client's React interval loop. If a user closes the browser tab, automated trading halts unless an external cron triggers `/api/agent/cron-rebalance`.
5. **Fund Safety Audit ("Stuck Fund Risk"):** Verified that native NEAR tips in escrow cannot be frozen, and derived EVM addresses remain non-custodial EOAs accessible via standard NEAR MPC sign calls.

---

## 2. Failure-Point Matrix & System Resilience

| Failure Scenario | Component Affected | Immediate System Reaction | User Experience | Recovery Path | Audit Rating |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Gemini AI Outage** | `/api/chat` | Catches 5xx / timeout; falls back to `processUserMessage` | Falls back to deterministic command parser | Recovers automatically when Gemini returns | **Resilient** |
| **CoinMarketCap Outage**| `/api/prices` | Catches 5xx; queries CoinGecko -> 1Click -> cache | Continues displaying prices from secondary sources | Cache refreshes when primary recovers | **Resilient** |
| **Twitter API 402** | `/api/user/search` | Catches 402; falls back to Unavatar / DiceBear | Shows synthetic identicon instead of real avatar | Profile updates when API credits renewed | **Degraded** |
| **Defuse 1Click 400** | `/api/quotes` | Throws error; aborts quote generation | Red toast: "1Click Solver error: Quoting unavailable" | User must adjust pair or amount | **Failing** |
| **Base RPC Timeout** | `/api/evm/balance` | Catches timeout; returns `"0.0000"` balance | EVM balance card displays 0.00 ETH | Next refresh re-polls RPC node | **Vulnerable (Silent 0)** |
| **NEAR MPC Node Busy** | `/api/evm/send-mpc` | Throws `MPC_SIGNING_FAILED` | Toast: "Failed to sign transaction on NEAR MPC" | Funds remain untouched; retry available | **Safe Fail** |
| **User Tab Closed** | Autonomous Terminal | Client React interval terminates | Autonomous rules pause execution | Resumes on next session or via server cron | **Fragile** |
| **MongoDB Outage** | Global APIs | Catches DB disconnect; falls back to memory maps | Session / transactions saved in memory only | Reconnects via Mongoose connection pool | **Degraded** |

---

## 3. Detailed Reliability & Failure-Point Findings

### [REL-001] [CRITICAL] Complete Absence of Automated Test Framework
- **Severity:** CRITICAL
- **Status:** Broken / Missing
- **Affected File:** `package.json` (lines 5–12)
- **Actual Code Snippet & Analysis:**
  ```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test:1click": "node scripts/test-1click-quote.mjs",
    "test:ai": "node scripts/test-ai-tools.mjs"
  }
  ```
  The repository contains zero test runners (`jest`, `vitest`, `mocha`, `cypress`, `playwright`). Running `npm test` fails with `Missing script: "test"`.
  Across 34,000+ lines of TypeScript covering elliptic curve key derivation, transaction serialization, escrow claiming, and algorithmic trading, there are no regression tests.
- **Impact:** Refactoring or upgrading dependencies can silently break core financial pipelines without detection.
- **Recommended Remediation:**
  1. Install Vitest: `npm install -D vitest @vitest/coverage-v8`.
  2. Add `"test": "vitest run"` to `package.json`.
  3. Author unit test suites covering:
     - `tests/unit/near-chain-signatures.test.ts` (additive tweak math verification)
     - `tests/unit/trading-copilot.test.ts` (DCA condition and bracket order triggers)
     - `tests/unit/oracle-service.test.ts` (price fallback chain logic)

---

### [REL-002] [HIGH] Repository Test Script `test:1click` Fails on Default Execution
- **Severity:** HIGH
- **Status:** Broken
- **Affected Files:**
  - `package.json` (line 10)
  - `scripts/test-1click-quote.mjs` (lines 33–66)
- **Actual Code Snippet & Analysis:**
  Executing `npm run test:1click` produces:
  ```
  === 1Click API Tracer Bullet ===
  1. Fetching live token catalog...
  ✓ Total tokens indexed: 257
  ✓ Base USDC Asset ID: nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near
  ✓ NEAR wNEAR Asset ID: nep141:wrap.near

  2. Requesting a verified dry-run quote (10 Base USDC -> wNEAR)...
  Error: Quote failed (400): {"message":"Quoting for this pair is not available","correlationId":"...","path":"/v0/quote"}
  ```
- **Impact:** The only integration test script packaged in `package.json` crashes. Developers or judges running `npm run test:1click` encounter a failure on the primary cross-chain intent route.
- **Recommended Remediation:** Update `scripts/test-1click-quote.mjs` with an active pair recognized by 1Click solvers, or update the asset identifier formatting to match current Defuse API requirements.

---

### [REL-003] [HIGH] Inadequate Attached Deposit on NEAR MPC Signature Function Calls
- **Severity:** HIGH
- **Status:** Broken / Potential On-Chain Panic
- **Affected File:** `src/lib/near-chain-signatures.ts` (lines 220–230)
- **Actual Code Snippet & Analysis:**
  ```typescript
  export async function requestMpcSignature(
    nearAccount: nearAPI.Account,
    derivationPath: string,
    txPayloadHash: Uint8Array,
    mpcContractId: string = NEAR_MPC_CONTRACT_TESTNET
  ): Promise<MpcSignatureResult> {
    const signArgs = {
      request: {
        payload: Array.from(txPayloadHash),
        path: derivationPath,
        key_type: "Ecdsa",
        domain_id: 0,
      },
      domain_id: 0,
    };
    ...
    result = await (nearAccount as any).callFunction({
      contractId: mpcContractId,
      methodName: "sign",
      args: signArgs,
      gas: BigInt("300000000000000"), // 300 Tgas
      deposit: BigInt("1"),           // 1 yoctoNEAR
    });
  ```
  The NEAR Chain Signatures contract on testnet (`v1.signer-prod.testnet`) enforces a signature deposit fee (typically 0.05 NEAR or 0.25 NEAR, depending on protocol version) to deter spam and compensate MPC signers.
  Passing `deposit: BigInt("1")` (1 yoctoNEAR) risks on-chain panic: `Smart contract panicked: Requires attached deposit of at least ... yoctoNEAR`.
- **Impact:** Outbound EVM transactions initiated from derived addresses can fail on-chain at the MPC signing step.
- **Recommended Remediation:** Attach the required MPC signer fee:
  ```typescript
  deposit: BigInt("50000000000000000000000") // 0.05 NEAR
  ```

---

### [REL-004] [MEDIUM] Silent Default Fallbacks Masking Real RPC Errors
- **Severity:** MEDIUM
- **Status:** Verified Existing
- **Affected File:** `src/app/api/evm/balance/route.ts` (lines 102–127)
- **Actual Code Snippet & Analysis:**
  ```typescript
  async function queryEthBalance(rpcUrl: string, address: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(rpcUrl, { ... });
      ...
      return (Number(wei) / 1e18).toFixed(4);
    } catch {
      clearTimeout(timeoutId);
      return "0.0000"; // SILENT ZERO FALLBACK!
    }
  }
  ```
  If `sepolia.base.org` experiences rate-limiting (HTTP 429) or network disconnects, the catch block silently swallows the error and reports `0.0000 ETH`.
- **Impact:** A user with a funded EVM address sees a zero balance during temporary RPC blips, leading them to believe funds were lost.
- **Recommended Remediation:** Return an error status or `{ balance: null, error: "RPC_UNAVAILABLE" }` so the UI can display a retry button rather than a false zero balance.

---

### [REL-005] [MEDIUM] Autonomous Trading Engine Tied to Active Browser Client Session
- **Severity:** MEDIUM
- **Status:** Verified Existing
- **Affected Files:**
  - `src/lib/trading-copilot.ts` (lines 815–860)
  - `src/app/terminal/page.tsx` (lines 800–850)
- **Actual Code Snippet & Analysis:**
  In `src/app/terminal/page.tsx`:
  ```typescript
  // Autonomous evaluation heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      if (portfolio.rules.length > 0) {
        const result = evaluateTradingRules(portfolio.rules, liveAssets, portfolio, "simulation");
        ...
      }
    }, 2200);
    return () => clearInterval(interval);
  }, [portfolio, liveAssets]);
  ```
  The autonomous evaluation loop executes inside `setInterval` in the client's React component.
- **Impact:** The "Autonomous AI Agent" only runs while the user keeps the terminal open in their browser. If the tab is closed, DCA schedules and stop-loss monitoring cease executing. While a server-side route `/api/agent/cron-rebalance` exists, it is invoked only once every 15 minutes via `vercel.json`, failing to provide continuous 24/7 sub-minute execution.
- **Recommended Remediation:** Persist active trading rules in MongoDB with user-configured cron triggers, and run a dedicated background daemon worker to evaluate rules server-side.

---

## 4. Stuck Fund Audit Walkthrough

A critical reliability question for financial software: **Can user funds become permanently locked?**

1. **NEAR Escrow Contract (`contracts/veilx-escrow/src/lib.rs`):**
   - **Native NEAR Tips:** Transferred via `Promise::new(recipient_wallet).transfer(...)`. Native transfers cannot fail due to token pause or storage requirements.
   - **Refund Protection:** Lines 324–363 implement `refund_tip(tip_id)`, allowing senders to reclaim unclaimed tips after a 7-day timelock.
   - **Verdict: ZERO STUCK FUND RISK in NEAR Escrow.**
2. **Derived Base EVM Address (`src/lib/near-chain-signatures.ts`):**
   - Derived addresses are standard Secp256k1 EOAs. The private key is mathematically bound to the user's NEAR account ID and derivation path.
   - Anyone holding the NEAR account can always request an MPC signature to withdraw funds, provided they have Base ETH for gas.
   - **Verdict: ZERO CUSTODIAL LOCK RISK in EVM Derivation.**

---

## 5. Testing & Reliability Recommendations

1. **P0 (Test Infrastructure):** Set up Vitest and create automated unit tests for NEAR MPC derivation and DCA rule evaluation (`REL-001`).
2. **P0 (Live Integration):** Fix `scripts/test-1click-quote.mjs` to restore passing status on `npm run test:1click` (`REL-002`).
3. **P1 (Smart Contract):** Increase attached deposit on `requestMpcSignature` to `0.05 NEAR` to prevent MPC node panics (`REL-003`).
4. **P1 (User Feedback):** Differentiate RPC timeouts from zero balances in `/api/evm/balance` (`REL-004`).
5. **P2 (Architecture):** Migrate autonomous rule evaluation from client `setInterval` to server-side daemon workers (`REL-005`).
