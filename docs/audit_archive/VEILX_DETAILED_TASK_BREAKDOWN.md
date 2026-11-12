# VEILX AGENT — DETAILED TASK-LEVEL SPECIFICATIONS

**Document Version:** 1.0.0  
**Status:** DRAFT — AWAITING USER APPROVAL (PLANNING ONLY)  
**Date:** November 2, 2026  
**Total Granular Tasks:** 28

---

## SECTION 1: CRITICAL SECURITY & CONTAINMENT (P0)

### TASK-SEC-01: Eliminate Session Forgery Bypass in `verifySessionToken`
- **Original Audit Ref:** `SEC-AUTH-01`
- **Area:** Authentication & Cryptographic Session Management
- **Priority:** **P0 — Critical**
- **Current Problem:** `src/lib/session.ts` line 18 contains `if (token.startsWith("{")) return JSON.parse(token);`. Any HTTP request with `veilx_session={"xHandle":"victim"}` bypasses HMAC-SHA256 signature checks.
- **Root Cause:** Insecure backwards compatibility left in place for legacy unsigned test cookies.
- **Proposed Solution:** Delete lines 17–20. Enforce that all session cookies must be base64url-encoded JSON envelopes with valid HMAC-SHA256 signatures verified via `crypto.timingSafeEqual`.
- **Exact Implementation Steps:**
  1. Open `src/lib/session.ts`.
  2. Remove lines 17–20 (`if (token.startsWith("{")) ...`).
  3. Ensure `verifySessionToken` returns `null` if the envelope structure is missing or signature verification fails.
  4. Ensure `signSessionPayload` includes an `iat` (issued-at) and `exp` (expiration) timestamp inside the signed payload.
  5. Check `exp` timestamp in `verifySessionToken` and return `null` if expired.
- **Files Changed:** `src/lib/session.ts`
- **Dependencies:** None.
- **External Services/Credentials:** `SESSION_SECRET` in `.env.local`.
- **Security Implications:** Closes critical identity spoofing and unauthorized escrow claiming.
- **Database/Contract Implications:** None.
- **Failure Scenarios Addressed:** Scenario 12 (Unauthorized user claims escrow).
- **Required Tests:** Unit test verifying forged cookie returns `null`; authentic signed cookie returns payload.
- **Acceptance Criteria:** `verifySessionToken('{"xHandle":"admin"}')` returns `null`.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** Yes (Affects active user sessions).

---

### TASK-SEC-02: Lock Down `POST /api/user` Against Unauthenticated Account Reassignment
- **Original Audit Ref:** `SEC-USER-01`
- **Area:** User Profile Management & Session Minting
- **Priority:** **P0 — Critical**
- **Current Problem:** `POST /api/user` allows unauthenticated clients to overwrite `nearAccountId` and receive a signed 30-day session cookie for any `xHandle`.
- **Root Cause:** Missing authentication guard on registration/update endpoint.
- **Proposed Solution:** Require an active authenticated Twitter session cookie (`veilx_session`) matching `xHandle`, or require a cryptographic Ed25519 signature from `publicKey` verifying ownership of the private key before modifying `nearAccountId`.
- **Exact Implementation Steps:**
  1. Open `src/app/api/user/route.ts`.
  2. Read `veilx_session` cookie and verify caller identity.
  3. If caller has an active Twitter session where `session.xHandle === cleanHandle`, permit update.
  4. If caller is registering a new key, verify that a signed nonce payload is provided and validates against `publicKey`.
  5. If unauthorized, reject with HTTP 401 / HTTP 403.
- **Files Changed:** `src/app/api/user/route.ts`
- **Dependencies:** `TASK-SEC-01`.
- **External Services/Credentials:** None.
- **Security Implications:** Prevents account takeover and rogue wallet subaccount reassignment.
- **Database/Contract Implications:** Protects `users` collection integrity.
- **Failure Scenarios Addressed:** Scenario 1, Scenario 12.
- **Required Tests:** Test POST request without cookie returns 401; test POST with mismatched handle returns 403.
- **Acceptance Criteria:** An unauthenticated POST request to `/api/user` cannot alter user data or receive a session cookie.
- **Complexity:** Medium
- **Parallelizable:** No (Depends on `TASK-SEC-01`).
- **Requires Personal Approval:** Yes.

---

### TASK-SEC-03: Enforce On-Chain RPC Receipt Validation in `PATCH /api/paylinks`
- **Original Audit Ref:** `SEC-PAY-01`
- **Area:** Payment Settlement & Invoice Life Cycle
- **Priority:** **P0 — Critical**
- **Current Problem:** `PATCH /api/paylinks` marks invoices `settled` and creates inflow transaction records based entirely on unverified client-provided `settledTx` strings.
- **Root Cause:** Absence of on-chain verification before database mutation.
- **Proposed Solution:** In `PATCH /api/paylinks`, query NEAR RPC node (`tx` or `EXPERIMENTAL_tx_status`) with `settledTx`. Verify that:
  - The transaction executed successfully (`FinalExecutionStatus::SuccessValue`).
  - The receiver ID matches `recipientNearAccount`.
  - The deposit amount satisfies the requested invoice amount.
- **Exact Implementation Steps:**
  1. Open `src/app/api/paylinks/route.ts`.
  2. If `status === "settled"`, require `settledTx`.
  3. Connect to `NEAR_RPC_NODE` using `JsonRpcProvider`.
  4. Fetch transaction status: `provider.txStatus(settledTx, payerWallet || recipientNearAccount)`.
  5. Check execution outcome. If failed, reject with HTTP 400 (`"Transaction not confirmed or invalid on-chain"`).
  6. Verify transferred yoctoNEAR matches or exceeds `amountNear`.
  7. Only update `PayLink.status = "settled"` after on-chain validation passes.
- **Files Changed:** `src/app/api/paylinks/route.ts`
- **Dependencies:** None.
- **External Services/Credentials:** NEAR Testnet RPC (`NEXT_PUBLIC_NEAR_NODE_URL`).
- **Security Implications:** Completely eliminates fake invoice payment spoofing.
- **Database/Contract Implications:** Prevents spurious inflow `Transaction` records.
- **Failure Scenarios Addressed:** Scenario 21 (Invoice paid but shows unpaid / fake invoice paid).
- **Required Tests:** Test patching invoice with non-existent transaction hash returns 400; test with valid transaction succeeds.
- **Acceptance Criteria:** An invoice cannot transition to `settled` unless the transaction hash exists and succeeded on NEAR Testnet.
- **Complexity:** Medium
- **Parallelizable:** Yes
- **Requires Personal Approval:** Yes.

---

### TASK-SEC-04: Purge Hardcoded Fallback Deposit Addresses in PayLink Checkout
- **Original Audit Ref:** `SEC-FALLBACK-01`
- **Area:** Cross-Chain Invoice Checkout UI
- **Priority:** **P0 — Critical**
- **Current Problem:** `src/app/pay/[slug]/page.tsx` lines 328–329 fall back to hardcoded strings (`0x2eed7...`, `5U3bSapFRXeistmGghFsagkE814e8E9qG2vU2K1`) if quoting fails or derived address is missing.
- **Root Cause:** Defensive coding fallback using placeholder test strings instead of an explicit error state.
- **Proposed Solution:** Remove hardcoded strings. If `depositAddress` or `derivedEvm.checksumAddress` is null, set `activePayAddress = null` and render an explicit error/loading card: *"Retrieving payment address from NEAR MPC..."*.
- **Exact Implementation Steps:**
  1. Open `src/app/pay/[slug]/page.tsx`.
  2. Locate lines 324–330.
  3. Replace ternary fallbacks with clean nullable expressions.
  4. In the JSX rendering block, if `!activePayAddress`, display an interactive retry banner instead of rendering a QR code for a foreign address.
- **Files Changed:** `src/app/pay/[slug]/page.tsx`
- **Dependencies:** None.
- **External Services/Credentials:** None.
- **Security Implications:** Eliminates irreversible user fund loss on cross-chain checkout.
- **Database/Contract Implications:** None.
- **Failure Scenarios Addressed:** Scenario 19, Scenario 20.
- **Required Tests:** Component test with empty solver quote renders retry state without rendering QR code.
- **Acceptance Criteria:** Under no circumstance does `/pay/[slug]` display or encode an unowned hardcoded address.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

## SECTION 2: SMART CONTRACT & SIGNING INFRASTRUCTURE (P1 / P2)

### TASK-SEC-05: Refactor On-Chain Tip & Withdrawal Signing to Non-Custodial Client
- **Original Audit Ref:** `SEC-KEY-01`
- **Area:** Non-Custodial Key Management & Cryptography
- **Priority:** **P1 — High**
- **Current Problem:** `POST /api/near/send-tip` and `POST /api/near/withdraw` accept `senderPrivateKey` over HTTP.
- **Root Cause:** Convenience architecture in early prototype to avoid browser-side transaction construction.
- **Proposed Solution:** Move transaction signing into client-side utility (`src/lib/near-wallet-connector.ts`). The client uses its local Ed25519 session key to sign `transactions.createTransaction` directly in the browser and sends the signed transaction to `/api/near/broadcast` or directly to NEAR RPC via `provider.sendTransaction`.
- **Exact Implementation Steps:**
  1. Create client-side helper `signAndBroadcastTipTransaction(session, recipient, amountNear)` in `src/lib/near-embedded-wallet.ts`.
  2. Use `@near-js/transactions` to construct and sign the transaction locally.
  3. Send pre-signed `SignedTransaction` binary to NEAR RPC `broadcast_tx_commit`.
  4. Remove `senderPrivateKey` parameter completely from `/api/near/send-tip` and `/api/near/withdraw`.
  5. The backend endpoint now acts purely as a transaction indexer and metadata logger.
- **Files Changed:** `src/app/api/near/send-tip/route.ts`, `src/app/api/near/withdraw/route.ts`, `src/lib/near-embedded-wallet.ts`, `src/components/chat/ChatContainer.tsx`.
- **Dependencies:** `TASK-SEC-02`.
- **External Services/Credentials:** NEAR RPC Node.
- **Security Implications:** Restores 100% non-custodial integrity; server never sees private keys.
- **Database/Contract Implications:** None.
- **Failure Scenarios Addressed:** Scenario 3, Scenario 25.
- **Required Tests:** Verify transaction can be signed and broadcast without sending private key over network inspector.
- **Acceptance Criteria:** Network payload inspection of tip execution contains zero private key material.
- **Complexity:** Large / Architectural
- **Parallelizable:** No (Requires careful testing).
- **Requires Personal Approval:** Yes.

---

### TASK-SC-01: Remove Relayer Override in Smart Contract Recipient Validation
- **Original Audit Ref:** `SEC-SC-01`
- **Area:** Rust Smart Contract Security
- **Priority:** **P2 — Medium**
- **Current Problem:** `contracts/veilx-escrow/src/lib.rs` line 141 contains `|| env::predecessor_account_id() == self.owner_id`, allowing relayer to divert escrow funds to any arbitrary wallet address.
- **Root Cause:** Relayer debugging bypass left in smart contract code.
- **Proposed Solution:** Remove the override clause. Ensure the contract validates that the recipient subaccount prefix strictly matches `tip.recipient_handle`.
- **Exact Implementation Steps:**
  1. Open `contracts/veilx-escrow/src/lib.rs`.
  2. Edit line 141 to:
     ```rust
     let subaccount_prefix = recipient_wallet.as_str().split('.').next().unwrap_or("");
     require!(
         subaccount_prefix.eq_ignore_ascii_case(&tip.recipient_handle),
         "Recipient wallet does not match tip handle"
     );
     ```
  3. Recompile contract: `cargo build --target wasm32-unknown-unknown --release`.
  4. Run contract test suite: `cargo test`.
- **Files Changed:** `contracts/veilx-escrow/src/lib.rs`
- **Dependencies:** None.
- **External Services/Credentials:** Rust Toolchain & `near-cli-rs`.
- **Security Implications:** On-chain cryptographic enforcement that funds can only be claimed by the legitimate recipient subaccount.
- **Database/Contract Implications:** Requires redeployment or upgrade of contract on testnet.
- **Failure Scenarios Addressed:** Scenario 12 (Unauthorized claim attempt).
- **Required Tests:** Unit test verifying claim panics if `recipient_wallet` prefix does not match `recipient_handle`.
- **Acceptance Criteria:** Relayer cannot claim tip to an arbitrary wallet address.
- **Complexity:** Medium
- **Parallelizable:** Yes
- **Requires Personal Approval:** Yes (Requires contract deployment approval).

---

### TASK-SC-02: Implement Atomic Resolve Callback on Native NEAR Transfers
- **Original Audit Ref:** `SEC-SC-02`
- **Area:** Smart Contract Asynchronous Call Safety
- **Priority:** **P2 — Medium**
- **Current Problem:** Native NEAR transfers in `claim_tip` lack a resolve callback; if transfer fails, `tip.claimed = true` remains permanently set, trapping funds.
- **Root Cause:** Asynchronous promise not chained with `.then()`.
- **Proposed Solution:** Implement private method `near_resolve_claim(tip_id: String)` chained via `.then()` to `Promise::new(recipient_wallet).transfer(...)`. If promise fails, revert `tip.claimed = false`.
- **Exact Implementation Steps:**
  1. In `contracts/veilx-escrow/src/lib.rs`, define:
     ```rust
     #[private]
     pub fn near_resolve_claim(&mut self, tip_id: String) -> bool {
         match env::promise_result_checked(0, 1024) {
             Ok(_) => true,
             Err(_) => {
                 if let Some(tip) = self.tips.get_mut(&tip_id) {
                     tip.claimed = false;
                 }
                 false
             }
         }
     }
     ```
  2. Attach callback in `claim_tip`:
     ```rust
     Promise::new(recipient_wallet)
         .transfer(NearToken::from_yoctonear(amount.0))
         .then(Self::ext(env::current_account_id()).with_static_gas(GAS_FOR_RESOLVE).near_resolve_claim(tip_id))
     ```
  3. Recompile and test with mock VM context.
- **Files Changed:** `contracts/veilx-escrow/src/lib.rs`
- **Dependencies:** `TASK-SC-01`.
- **External Services/Credentials:** Rust Toolchain.
- **Security Implications:** Prevents permanent escrow fund lockups on transfer failures.
- **Database/Contract Implications:** Contract upgrade on testnet.
- **Failure Scenarios Addressed:** Scenario 6, Scenario 13.
- **Required Tests:** Unit test mocking transfer promise failure verifies `tip.claimed` returns to `false`.
- **Acceptance Criteria:** `get_tip(tip_id)` returns `claimed: false` if transfer fails.
- **Complexity:** Medium
- **Parallelizable:** Yes
- **Requires Personal Approval:** Yes.

---

### TASK-SC-03: Mitigate Storage Staking Exhaustion in `ft_on_transfer`
- **Original Audit Ref:** `SEC-SC-03`
- **Area:** Smart Contract Economics & DoS Defense
- **Priority:** **P2 — Medium**
- **Current Problem:** An attacker can flood `ft_on_transfer` with 1 yocto-token deposits, consuming contract storage staking without attaching NEAR.
- **Root Cause:** NEP-141 transfers cannot attach native NEAR deposits.
- **Proposed Solution:** Require that the sender account has pre-registered a storage deposit on the contract, or implement dynamic storage deduction where unverified micro-tips $< 0.10$ USD equivalent are rejected in `ft_on_transfer`.
- **Exact Implementation Steps:**
  1. Inspect `msg` in `ft_on_transfer`.
  2. Assert minimum token amount (e.g. at least 100,000 yocto-USDC, equivalent to $0.10).
  3. Prune claimed tips from storage via `self.tips.remove(&tip_id)` upon settlement to free storage.
- **Files Changed:** `contracts/veilx-escrow/src/lib.rs`
- **Dependencies:** `TASK-SC-01`.
- **External Services/Credentials:** None.
- **Security Implications:** Mitigates contract out-of-gas / out-of-storage denial-of-service.
- **Database/Contract Implications:** State storage reclaimed on settlement.
- **Failure Scenarios Addressed:** Contract state exhaustion attack.
- **Required Tests:** Unit test verifying `ft_on_transfer` panics on zero/micro amounts.
- **Acceptance Criteria:** Contract does not exhaust storage under high-volume micro-transfers.
- **Complexity:** Medium
- **Parallelizable:** Yes
- **Requires Personal Approval:** Yes.

---

## SECTION 3: BACKEND API & DATABASE CONSISTENCY (P1 / P2)

### TASK-BACK-01: Enforce Server-Side Spending Cap with Atomic Database Increments
- **Original Audit Ref:** `SEC-CAP-01`
- **Area:** Financial Guardrails & Multi-Device Synchronization
- **Priority:** **P1 — High**
- **Current Problem:** Spending limit ($50/day) is evaluated strictly in the frontend browser `localStorage`. A user tipping on multiple devices simultaneously can exceed the cap.
- **Root Cause:** Missing server-side check in `/api/near/send-tip`.
- **Proposed Solution:** In `/api/near/send-tip`, atomically check and increment `spentUsd` in MongoDB using `User.findOneAndUpdate` with conditional operators before broadcasting on-chain transactions.
- **Exact Implementation Steps:**
  1. Open `src/app/api/near/send-tip/route.ts`.
  2. Calculate USD valuation: `usdVal = isNearAsset ? requestedNum * 3.5 : requestedNum`.
  3. Query user record:
     ```ts
     const updatedUser = await User.findOneAndUpdate(
       {
         xHandle: cleanSenderHandle,
         $expr: { $lte: [{ $add: ["$spentUsd", usdVal] }, "$spendingLimitUsd"] }
       },
       { $inc: { spentUsd: usdVal } },
       { new: true }
     );
     if (!updatedUser) {
       return NextResponse.json({ error: "Session spending limit exceeded for today" }, { status: 403 });
     }
     ```
  4. If on-chain broadcast fails, roll back: `{ $inc: { spentUsd: -usdVal } }`.
- **Files Changed:** `src/app/api/near/send-tip/route.ts`, `src/models/User.ts`.
- **Dependencies:** `TASK-SEC-05`.
- **External Services/Credentials:** MongoDB Atlas.
- **Security Implications:** Prevents spending allowance bypasses across multiple devices.
- **Database/Contract Implications:** Atomic transaction tracking on `users`.
- **Failure Scenarios Addressed:** Scenario 17, Scenario 25.
- **Required Tests:** Concurrent test script executing two $30 tips against a $50 limit; exactly one succeeds and one receives 403.
- **Acceptance Criteria:** Spending cap is strictly enforced across concurrent sessions.
- **Complexity:** Medium
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

### TASK-BACK-02: Protect Transaction History Endpoint Against Unauthenticated Injection
- **Original Audit Ref:** `SEC-TX-01`
- **Area:** Backend API Security
- **Priority:** **P1 — High**
- **Current Problem:** `POST /api/transactions` accepts arbitrary transaction records with zero authentication.
- **Root Cause:** Development shortcut for manual activity logging.
- **Proposed Solution:** Restrict `POST /api/transactions` to internal service calls or verified user sessions. If called by user, verify that `txHash` is authentic on NEAR RPC before saving to MongoDB.
- **Exact Implementation Steps:**
  1. Open `src/app/api/transactions/route.ts`.
  2. Add session verification check: `const session = verifySessionToken(...)`.
  3. Assert `session.xHandle === userHandle`.
  4. If `txHash` is provided, verify on-chain existence via RPC.
  5. Reject unauthorized or spoofed records.
- **Files Changed:** `src/app/api/transactions/route.ts`
- **Dependencies:** `TASK-SEC-01`.
- **External Services/Credentials:** None.
- **Security Implications:** Prevents fake volume and history spoofing.
- **Database/Contract Implications:** Protects `transactions` collection.
- **Failure Scenarios Addressed:** Scenario 8.
- **Required Tests:** Unauthenticated POST to `/api/transactions` returns 401.
- **Acceptance Criteria:** Only verified transactions can be persisted to user activity history.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

### TASK-BACK-03: Implement Auto-Expiry and Recovery for Stuck Claiming Locks
- **Original Audit Ref:** `SEC-MUTEX-01`
- **Area:** Database Concurrency & Relayer Reliability
- **Priority:** **P1 — High**
- **Current Problem:** If a claim crashes midway, `EscrowTip.status` remains `"claiming"`, locking the tip permanently.
- **Root Cause:** Mutex lacks TTL or timeout recovery mechanism.
- **Proposed Solution:** In `/api/relay/claim`, release any lock where `status === "claiming"` and `claimLockedAt` is older than 5 minutes.
- **Exact Implementation Steps:**
  1. In `src/app/api/relay/claim/route.ts`, before locking, execute:
     ```ts
     await EscrowTip.updateMany(
       { status: "claiming", claimLockedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
       { $set: { status: "pending" }, $unset: { claimLockedAt: 1 } }
     );
     ```
  2. Allow user to retry claim after 5 minutes.
- **Files Changed:** `src/app/api/relay/claim/route.ts`
- **Dependencies:** None.
- **External Services/Credentials:** None.
- **Security Implications:** Prevents permanent escrow lockouts on network dropouts.
- **Database/Contract Implications:** Self-healing MongoDB state.
- **Failure Scenarios Addressed:** Scenario 11, Scenario 23.
- **Required Tests:** Create tip with `status: "claiming"` and `claimLockedAt: 10 mins ago`; trigger claim; verify tip resets and claims successfully.
- **Acceptance Criteria:** Tips stuck in `claiming` automatically unlock after 5 minutes.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

### TASK-BACK-04: Implement Multi-RPC Fallback Provider for NEAR RPC Outages
- **Original Audit Ref:** System Reliability Findings
- **Area:** Infrastructure Resilience
- **Priority:** **P2 — Medium**
- **Current Problem:** The application relies entirely on `rpc.testnet.near.org`. If the official node rate limits or fails, the entire platform stops working.
- **Root Cause:** Single hardcoded RPC URL in `near-rpc.ts`.
- **Proposed Solution:** Implement an RPC rotation manager with automatic failover between:
  1. `https://rpc.testnet.near.org`
  2. `https://testnet.neardata.xyz/v1/node`
  3. `https://near-testnet.api.pagoda.co/rpc/v1`
- **Exact Implementation Steps:**
  1. Open `src/lib/near-rpc.ts`.
  2. Define `RPC_FALLBACKS` array.
  3. Wrap RPC calls in a retry loop that tries the next provider if an HTTP 429/500/timeout occurs.
- **Files Changed:** `src/lib/near-rpc.ts`, `src/lib/near-utils.ts`.
- **Dependencies:** None.
- **External Services/Credentials:** Public Testnet RPC endpoints.
- **Security Implications:** High uptime and resilience against DDoS or node downtime.
- **Database/Contract Implications:** None.
- **Failure Scenarios Addressed:** Scenario 24 (RPC provider goes offline).
- **Required Tests:** Simulate network failure on primary RPC; verify secondary RPC handles request seamlessly.
- **Acceptance Criteria:** Platform continues operating even if `rpc.testnet.near.org` is unreachable.
- **Complexity:** Medium
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

### TASK-DATA-01: Schema Standardization & Index Optimization
- **Original Audit Ref:** Database Architecture Findings
- **Area:** MongoDB Atlas Data Integrity
- **Priority:** **P2 — Medium**
- **Current Problem:** Some collections lack compound indexes, and legacy subaccount naming (`.veilx.testnet`) exists in older records.
- **Root Cause:** Evolving naming scheme during hackathon development.
- **Proposed Solution:** Add compound index `{ userHandle: 1, createdAt: -1 }` on `transactions`, index `{ creatorHandle: 1, status: 1 }` on `paylinks`, and run a 1-time migration script to normalize legacy account IDs.
- **Exact Implementation Steps:**
  1. Update `src/models/Transaction.ts` and `src/models/PayLink.ts` with compound schema indexes.
  2. Write safe, idempotent migration script `scripts/migrate-schemas.mjs`.
  3. Verify index creation via Mongoose `autoIndex`.
- **Files Changed:** `src/models/Transaction.ts`, `src/models/PayLink.ts`, `scripts/migrate-schemas.mjs`.
- **Dependencies:** None.
- **External Services/Credentials:** MongoDB Atlas.
- **Security Implications:** Improved query performance and data consistency.
- **Database/Contract Implications:** Optimized index allocation.
- **Failure Scenarios Addressed:** Scenario 7, Scenario 23.
- **Required Tests:** Script runs cleanly without duplicating records.
- **Acceptance Criteria:** Indexes appear in MongoDB Atlas collections.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** Yes (Affects production database).

---

### TASK-DATA-02: Implement Background Settlement Reconciliation Poller
- **Original Audit Ref:** Financial Reconciliation Findings
- **Area:** Accounting & Distributed Ledger Synchronization
- **Priority:** **P2 — Medium**
- **Current Problem:** Invoices paid directly via external wallets remain `status: "active"` in MongoDB unless the payer calls `PATCH /api/paylinks`.
- **Root Cause:** Missing on-chain block indexer / reconciliation listener.
- **Proposed Solution:** Create a lightweight server-side reconciliation job (or Next.js API route poller `/api/reconcile`) that checks active PayLinks and queries NEAR RPC for incoming transfers to `recipientNearAccount`.
- **Exact Implementation Steps:**
  1. Create `src/app/api/reconcile/route.ts`.
  2. Fetch all `PayLink.find({ status: "active" })`.
  3. Query NEAR RPC for recent receipts sent to `recipientNearAccount`.
  4. If a matching deposit is detected, mark `status = "settled"`, record transaction records, and alert creator.
- **Files Changed:** `src/app/api/reconcile/route.ts`
- **Dependencies:** `TASK-SEC-03`.
- **External Services/Credentials:** NEAR RPC.
- **Security Implications:** Guarantees eventual consistency between blockchain and UI.
- **Database/Contract Implications:** Automatic state transition.
- **Failure Scenarios Addressed:** Scenario 21 (Invoice paid but shows unpaid).
- **Required Tests:** Manually send NEAR to invoice account; trigger reconciliation; verify PayLink transitions to `settled`.
- **Acceptance Criteria:** Direct on-chain transfers automatically settle active PayLinks.
- **Complexity:** Medium
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

## SECTION 4: TELEGRAM BOT COMPLETION & SECURITY (P1 / P2)

### TASK-TG-01: Add Webhook Secret Token Verification Header
- **Original Audit Ref:** `SEC-TG-01`
- **Area:** Telegram Bot Webhook Security
- **Priority:** **P1 — High**
- **Current Problem:** `src/app/api/telegram/webhook/route.ts` does not verify `X-Telegram-Bot-Api-Secret-Token`.
- **Root Cause:** Rapid prototyping without webhook secret configuration.
- **Proposed Solution:** Read `process.env.TELEGRAM_WEBHOOK_SECRET` and reject any webhook request that does not match the secret header with HTTP 401.
- **Exact Implementation Steps:**
  1. Open `src/app/api/telegram/webhook/route.ts`.
  2. Add verification:
     ```ts
     const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
     if (!process.env.TELEGRAM_WEBHOOK_SECRET || secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
       return NextResponse.json({ error: "Unauthorized update" }, { status: 401 });
     }
     ```
- **Files Changed:** `src/app/api/telegram/webhook/route.ts`
- **Dependencies:** None.
- **External Services/Credentials:** `TELEGRAM_WEBHOOK_SECRET` in `.env.local`.
- **Security Implications:** Blocks forged Telegram webhook updates.
- **Database/Contract Implications:** Prevents unauthorized database writes via fake webhooks.
- **Failure Scenarios Addressed:** Scenario 14.
- **Required Tests:** Send POST without header $\rightarrow$ 401; send with correct header $\rightarrow$ 200.
- **Acceptance Criteria:** Webhook strictly rejects unauthenticated updates.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** Yes (Requires configuring secret with BotFather).

---

### TASK-TG-02: Implement Secure Telegram Account Linking (`/link` & Deep-Link Token)
- **Original Audit Ref:** `TG-LINK-01`
- **Area:** Telegram Multi-User Identity & Wallet Mapping
- **Priority:** **P2 — Medium**
- **Current Problem:** All Telegram users share `DEFAULT_NEAR_ACCOUNT` (`veilx-agent.testnet`).
- **Root Cause:** Lack of user-to-wallet mapping schema for Telegram IDs.
- **Proposed Solution:**
  1. Create `TelegramUser` schema mapping `telegramUserId` to `xHandle` and `nearAccountId`.
  2. Implement `/link` in Telegram: bot generates single-use token and URL `https://veilx.app/auth/telegram?token=...`.
  3. When user opens URL and logs into VeilX with Twitter, the backend binds the Telegram ID to their personal subaccount.
- **Exact Implementation Steps:**
  1. Create model `src/models/TelegramUser.ts`.
  2. In `src/lib/telegram-bot.ts`, replace `DEFAULT_NEAR_ACCOUNT` with a dynamic lookup by `user.id`.
  3. If unlinked, bot prompts: *"You are using a temporary guest wallet. Type /link to connect your VeilX account."*
  4. Implement `/api/auth/telegram/link` route to process deep links.
- **Files Changed:** `src/lib/telegram-bot.ts`, `src/models/TelegramUser.ts`, `src/app/api/auth/telegram/link/route.ts`.
- **Dependencies:** `TASK-SEC-01`, `TASK-SEC-02`.
- **External Services/Credentials:** Telegram Bot Token.
- **Security Implications:** Prevents account impersonation and shared wallet fund collisions.
- **Database/Contract Implications:** New collection `telegram_users`.
- **Failure Scenarios Addressed:** Scenario 15 (Telegram linked to wrong account).
- **Required Tests:** Link Telegram account via webapp; verify `/evm` in bot returns user's personal derived address.
- **Acceptance Criteria:** Each Telegram user has their own isolated subaccount and balances.
- **Complexity:** Large
- **Parallelizable:** No (Requires backend auth).
- **Requires Personal Approval:** Yes.

---

### TASK-TG-03: Move Telegram Conversational Memory to MongoDB
- **Original Audit Ref:** `TG-MEM-01`
- **Area:** Telegram Multi-Turn Context Persistence
- **Priority:** **P2 — Medium**
- **Current Problem:** `telegramSessionHistory` is an in-memory `Map`, lost on server restarts and unshared across serverless instances.
- **Root Cause:** Temporary prototyping structure.
- **Proposed Solution:** Store recent chat turns in a MongoDB collection `telegram_chats` with a 24-hour TTL index.
- **Exact Implementation Steps:**
  1. Define schema `TelegramChatTurn`: `{ telegramUserId: Number, role: String, content: String, createdAt: Date }` with `expireAfterSeconds: 86400`.
  2. In `src/lib/telegram-bot.ts`, replace `telegramSessionHistory.get(userId)` with `TelegramChatTurn.find({ telegramUserId }).sort({ createdAt: 1 }).limit(10)`.
  3. Save incoming and outgoing messages to `TelegramChatTurn`.
- **Files Changed:** `src/lib/telegram-bot.ts`, `src/models/TelegramChatTurn.ts`.
- **Dependencies:** None.
- **External Services/Credentials:** MongoDB Atlas.
- **Security Implications:** Scalable multi-turn memory without memory leaks.
- **Database/Contract Implications:** New collection with TTL.
- **Failure Scenarios Addressed:** Server restart wipes conversational context.
- **Required Tests:** Send message; restart Next.js server; send follow-up "$0.5"; verify bot retains prior invoice context.
- **Acceptance Criteria:** Multi-turn conversational memory survives server restarts.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

### TASK-TG-04: Implement Group Chat Privacy & Sensitive Data Shielding
- **Original Audit Ref:** `SEC-TG-04`
- **Area:** User Privacy & Group Chat Security
- **Priority:** **P2 — Medium**
- **Current Problem:** If the bot is invited to a group chat, executing `/evm` or checking balances prints private financial data publicly.
- **Root Cause:** Missing chat type check.
- **Proposed Solution:** Check `message.chat.type === "private"`. If invoked in a group, respond with a private message or direct the user to DM.
- **Exact Implementation Steps:**
  1. In `src/lib/telegram-bot.ts`, inspect `message.chat.type`.
  2. If `type !== "private"` and command is `/evm`, `/balance`, or `/pay`, reply:
     *"🔒 For your financial privacy, sensitive commands can only be executed in a private direct message with @VeilXAgentBot."*
- **Files Changed:** `src/lib/telegram-bot.ts`
- **Dependencies:** None.
- **External Services/Credentials:** None.
- **Security Implications:** Prevents public leakage of user wallet balances in shared Telegram channels.
- **Database/Contract Implications:** None.
- **Failure Scenarios Addressed:** Group chat information exposure.
- **Required Tests:** Invoke `/evm` in group chat; verify sensitive balances are suppressed.
- **Acceptance Criteria:** Sensitive financial commands refuse execution in public groups.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

## SECTION 5: AI AGENT EXPANSION & FUNCTIONAL COPILOT (P2)

### TASK-AI-01: Add `cancel_invoice` Tool Declaration to AI Engine
- **Original Audit Ref:** `AI-TOOL-01`
- **Area:** AI Copilot Tool Architecture
- **Priority:** **P2 — Medium**
- **Current Problem:** When a user asks *"Cancel invoice inv_123"*, the agent returns `tool: "unknown"` because no cancellation tool exists.
- **Root Cause:** Incomplete tool definition in `GEMINI_TOOLS_CONFIG` and `ai-gateway.ts`.
- **Proposed Solution:** Add `cancel_invoice` tool declaration, deterministic regex matcher, and backend handler updating `PayLink.status = "cancelled"`.
- **Exact Implementation Steps:**
  1. Open `src/lib/ai-gateway.ts` and add regex pattern for `cancel invoice (inv_[a-z0-9_-]+)`.
  2. Open `src/app/api/chat/route.ts` and add `cancel_invoice` to `GEMINI_TOOLS_CONFIG` and `OPENAI_TOOLS_CONFIG`.
  3. In `ChatContainer.tsx`, handle `result.tool === "cancel_invoice"`, call `PATCH /api/paylinks` with `status: "cancelled"`, and append confirmation message.
- **Files Changed:** `src/lib/ai-gateway.ts`, `src/app/api/chat/route.ts`, `src/components/chat/ChatContainer.tsx`.
- **Dependencies:** `TASK-SEC-03`.
- **External Services/Credentials:** None.
- **Security Implications:** Only the creator can cancel their own active invoices.
- **Database/Contract Implications:** Transitions `paylinks.status` to `"cancelled"`.
- **Failure Scenarios Addressed:** User unable to cancel mistake invoices.
- **Required Tests:** Ask agent *"Cancel invoice inv_test"*; verify invoice is cancelled in DB.
- **Acceptance Criteria:** User can cancel active invoices through chat.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

### TASK-AI-02: Add `query_transactions` History Tool to AI Engine
- **Original Audit Ref:** `AI-TOOL-02`
- **Area:** AI Copilot Context & Conversational History
- **Priority:** **P2 — Medium**
- **Current Problem:** Users asking *"How much have I spent today?"* or *"What was my last transaction?"* get a generic fallback.
- **Root Cause:** No history query tool in the agent.
- **Proposed Solution:** Add tool `query_transactions` that inspects `Transaction` records and session spend for the active user and returns an formatted summary.
- **Exact Implementation Steps:**
  1. Add function declaration `query_transactions` with optional parameter `timeframe` (`"today"`, `"all"`).
  2. In `ChatContainer.tsx`, read active transactions and return:
     *"📊 You have sent $XX.XX across X transactions today. Remaining cap: $YY.YY."*
- **Files Changed:** `src/lib/ai-gateway.ts`, `src/app/api/chat/route.ts`, `src/components/chat/ChatContainer.tsx`.
- **Dependencies:** None.
- **External Services/Credentials:** None.
- **Security Implications:** Scoped strictly to the authenticated user's own data.
- **Database/Contract Implications:** Read-only query on `transactions`.
- **Failure Scenarios Addressed:** User inquiring about spending status.
- **Required Tests:** Ask *"How much have I tipped today?"*; verify accurate summary returned.
- **Acceptance Criteria:** Agent accurately answers transaction and spending history queries.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

## SECTION 6: FRONTEND POLISH, UI/UX & ONBOARDING (P2 / P3)

### TASK-FRONT-01: Create Delegated Session Key Onboarding Modal
- **Original Audit Ref:** `UX-ONBOARD-01`
- **Area:** User Experience & Security Education
- **Priority:** **P2 — Medium**
- **Current Problem:** First-time users do not understand what a session key is or what authority is being delegated when they connect their 𝕏 account.
- **Root Cause:** Missing educational onboarding step.
- **Proposed Solution:** Build a 1-screen modal `SessionOnboardingModal.tsx` shown on first login explaining:
  - *"VeilX generates a delegated session key stored in your browser."*
  - *"This allows instant social micro-tips without approving every single transaction in your wallet."*
  - *"Default allowance: $50/day. You can adjust or revoke this key anytime."*
- **Exact Implementation Steps:**
  1. Create `src/components/modals/SessionOnboardingModal.tsx`.
  2. Check `localStorage.getItem("veilx_onboarded_v1")`. If missing after login, display modal.
  3. When user clicks *"I Understand & Authorize"*, save flag and close.
- **Files Changed:** `src/components/modals/SessionOnboardingModal.tsx`, `src/components/layout/HeaderNav.tsx`.
- **Dependencies:** None.
- **External Services/Credentials:** None.
- **Security Implications:** Informed user consent for cryptographic delegation.
- **Database/Contract Implications:** None.
- **Failure Scenarios Addressed:** User surprise or mistrust regarding autonomous tipping.
- **Required Tests:** Test new user login triggers modal; existing user login bypasses it.
- **Acceptance Criteria:** First-time users receive clear explanation before first autonomous spend.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

### TASK-FRONT-02: Add Base Sepolia EVM Funding Tab to Deposit Modal
- **Original Audit Ref:** Frontend Enhancement Findings
- **Area:** Omnichain Portfolio Usability
- **Priority:** **P2 — Medium**
- **Current Problem:** `DepositModal.tsx` only displays NEAR account deposit instructions; users wanting to fund their derived EVM address have no deposit guide.
- **Root Cause:** Modal was built prior to NEAR Chain Signatures MPC integration.
- **Proposed Solution:** Add a chain selector to `DepositModal.tsx`:
  - Tab 1: **NEAR Protocol Testnet** (`user.nearAccountId` + QR + Faucet link)
  - Tab 2: **Base Sepolia (EVM via NEAR MPC)** (`evmBalance.address` + QR + BaseScan link + Alchemy faucet link)
- **Exact Implementation Steps:**
  1. Open `src/components/modals/DepositModal.tsx`.
  2. Add tab state `activeTab: "near" | "base"`.
  3. Render derived EVM address and QR code when "Base" is selected.
  4. Include copy button and link to Base Sepolia testnet faucet.
- **Files Changed:** `src/components/modals/DepositModal.tsx`
- **Dependencies:** None.
- **External Services/Credentials:** None.
- **Security Implications:** Facilitates legitimate omnichain funding without confusion.
- **Database/Contract Implications:** None.
- **Failure Scenarios Addressed:** User unsure how to fund derived EVM wallet.
- **Required Tests:** Open modal, toggle to Base, verify derived address matches header dropdown.
- **Acceptance Criteria:** Deposit modal clearly presents funding paths for both NEAR and Base Sepolia.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

### TASK-UX-01: Fix Mobile Header Username Overflow at 320px–360px
- **Original Audit Ref:** `UX-MOB-01`
- **Area:** Mobile Responsive Design
- **Priority:** **P2 — Medium**
- **Current Problem:** On small viewports (320px–360px), long usernames push the balance pill and cause horizontal wrapping in `HeaderNav.tsx`.
- **Root Cause:** Unconstrained text width on username label.
- **Proposed Solution:** Add responsive max-width truncation: `max-w-[70px] sm:max-w-[120px] md:max-w-none truncate`.
- **Exact Implementation Steps:**
  1. Open `src/components/layout/HeaderNav.tsx`.
  2. In the user profile button, update username span styling.
  3. Verify clean display on 320px viewport emulation in Chrome DevTools.
- **Files Changed:** `src/components/layout/HeaderNav.tsx`
- **Dependencies:** None.
- **External Services/Credentials:** None.
- **Security Implications:** None.
- **Database/Contract Implications:** None.
- **Failure Scenarios Addressed:** Mobile layout breakage.
- **Required Tests:** Test with handle `@verylongusernametest` at 320px; verify no header overflow.
- **Acceptance Criteria:** Header navbar fits cleanly without horizontal scroll at 320px.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

### TASK-UX-02: Optimize Dashboard Action Buttons for Small Screens
- **Original Audit Ref:** `UX-MOB-02`
- **Area:** Mobile Responsive Design
- **Priority:** **P2 — Medium**
- **Current Problem:** On screens $< 360\text{px}$, "Deposit Funds" and "Withdraw" buttons in the dashboard hero card collide.
- **Root Cause:** `flex-row` without wrap on small screens.
- **Proposed Solution:** Apply `flex-col sm:flex-row w-full sm:w-auto` to action buttons in `TransactionDashboard.tsx`.
- **Exact Implementation Steps:**
  1. Open `src/components/dashboard/TransactionDashboard.tsx`.
  2. Locate lines 248–264.
  3. Update button container to `flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3`.
- **Files Changed:** `src/components/dashboard/TransactionDashboard.tsx`
- **Dependencies:** None.
- **External Services/Credentials:** None.
- **Security Implications:** None.
- **Database/Contract Implications:** None.
- **Failure Scenarios Addressed:** Mobile button collision.
- **Required Tests:** Verify dashboard buttons stack cleanly at 320px and 360px.
- **Acceptance Criteria:** Buttons are full-width and easily tappable on mobile devices.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

### TASK-CODE-01: Replace `<img>` Tags with Next.js `<Image />` Component
- **Original Audit Ref:** `CODE-IMG-01`
- **Area:** Frontend Performance & Linting Standards
- **Priority:** **P3 — Low**
- **Current Problem:** Next.js build emits warnings for unoptimized `<img>` tags in `HeaderNav.tsx`, `ChatContainer.tsx`, and `MessageBubble.tsx`.
- **Root Cause:** Standard HTML `<img>` elements used for avatars.
- **Proposed Solution:** Replace with `next/image` `<Image />` or add explicit unoptimized configuration for remote unavatar images.
- **Exact Implementation Steps:**
  1. Update `next.config.mjs` with remote image domains (`unavatar.io`, `pbs.twimg.com`).
  2. Use `<Image width={32} height={32} ... />` in affected components.
- **Files Changed:** `next.config.mjs`, `src/components/layout/HeaderNav.tsx`, `src/components/chat/MessageBubble.tsx`.
- **Dependencies:** None.
- **External Services/Credentials:** None.
- **Security Implications:** None.
- **Database/Contract Implications:** None.
- **Failure Scenarios Addressed:** None.
- **Required Tests:** `npm run build` succeeds with zero image lint warnings.
- **Acceptance Criteria:** Zero ESLint `@next/next/no-img-element` warnings.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

### TASK-CODE-02: Deprecate and Remove Orphaned `AISettingsModal.tsx`
- **Original Audit Ref:** `CLEAN-MODAL-01`
- **Area:** Code Cleanliness & Dead Code Elimination
- **Priority:** **P3 — Low**
- **Current Problem:** `AISettingsModal.tsx` is no longer accessible from the header navigation but remains in the codebase as dead weight.
- **Root Cause:** Header cleanup removed the trigger button.
- **Proposed Solution:** Either safely delete `AISettingsModal.tsx` or relocate it into an *"Advanced Developer Options"* expandable section in `WalletSessionModal.tsx`.
- **Exact Implementation Steps:**
  1. Move API key input fields into `WalletSessionModal.tsx` under an accordion tab.
  2. Delete `src/components/modals/AISettingsModal.tsx`.
- **Files Changed:** `src/components/modals/WalletSessionModal.tsx`, delete `src/components/modals/AISettingsModal.tsx`.
- **Dependencies:** None.
- **External Services/Credentials:** None.
- **Security Implications:** Reduces attack surface.
- **Database/Contract Implications:** None.
- **Failure Scenarios Addressed:** None.
- **Required Tests:** Verify build compiles without broken imports.
- **Acceptance Criteria:** Orphaned modal eliminated.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.

---

### TASK-FRONT-03: Add Transaction Proof Links to Chat Completion Cards
- **Original Audit Ref:** UI Polish Findings
- **Area:** Product Transparency & Trust
- **Priority:** **P3 — Low**
- **Current Problem:** Some tip cards show a transaction hash as raw text rather than a direct clickable link to NEARBlocks.
- **Root Cause:** Plain text formatting in message template.
- **Proposed Solution:** In `ChatContainer.tsx`, format transaction hashes as markdown explorer links: `[View on NEARBlocks ↗](https://testnet.nearblocks.io/txns/${txHash})`.
- **Exact Implementation Steps:**
  1. Open `src/components/chat/ChatContainer.tsx`.
  2. Update lines 440, 930, 990 to format transaction hashes as direct clickable links.
- **Files Changed:** `src/components/chat/ChatContainer.tsx`
- **Dependencies:** None.
- **External Services/Credentials:** None.
- **Security Implications:** Improved verification transparency for users and judges.
- **Database/Contract Implications:** None.
- **Failure Scenarios Addressed:** User unable to verify on-chain settlement.
- **Required Tests:** Execute tip; click explorer link; verify it opens NEARBlocks in a new tab.
- **Acceptance Criteria:** All transaction cards include 1-click external explorer links.
- **Complexity:** Small
- **Parallelizable:** Yes
- **Requires Personal Approval:** No.
