# VEILX AGENT — END-TO-END SYSTEM FAILURE SCENARIOS & RECOVERY MATRIX

**Target System:** VeilX Omnichain Agent System  
**Audit Date:** November 3, 2026  
**Auditor:** Senior Site Reliability Engineer & Smart Contract Auditor  
**Scope:** 25 Comprehensive Failure Conditions Across Frontend, Backend, Database, Blockchain & AI  

---

## 25 DETAILED FAILURE SCENARIOS

### Scenario 1: User Connects a Wallet but Authentication Fails
- **Trigger:** Browser wallet signs an invalid challenge or session cookie expiration occurs during OAuth callback.
- **Affected Components:** `src/components/modals/WalletSessionModal.tsx`, `/api/auth/me`.
- **Current Behavior:** UI displays a generic red error message: *"Failed to authenticate"*. Session key remains partially stored in `localStorage` in an unlinked state.
- **Expected Behavior:** Clear the partial session, notify user of authentication signature mismatch, and prompt clean reconnect.
- **Financial / User Impact:** None financial. User cannot view pending tips or linked Twitter profile.
- **Data Consistency:** Minor orphaned session key in browser `localStorage`.
- **Recovery & Manual Intervention:** Automatic. Clearing cache or re-initiating wallet connection resolves. No manual intervention.
- **Prevention:** Wrap session creation in atomic handshake requiring verified signature verification before writing to local storage.

---

### Scenario 2: User Submits a Tip Twice (Double Click / Rapid Tapping)
- **Trigger:** User double-clicks the "Send Tip" confirmation button on a slow mobile connection.
- **Affected Components:** `src/app/page.tsx`, `src/app/api/near/send-tip/route.ts`, MongoDB `EscrowTip`.
- **Current Behavior:** Two concurrent requests hit `/api/near/send-tip`. If nonces collide, the second transaction fails on-chain; if nonces increment, two separate escrow deposits are created.
- **Expected Behavior:** Frontend disables button immediately on first tap; backend enforces client idempotency key per intent.
- **Financial / User Impact:** **HIGH.** User risks sending duplicate funds to escrow.
- **Data Consistency:** Two distinct `tipId` records created in database.
- **Recovery:** User must invoke `refund_tip` on the duplicate escrow.
- **Prevention:** Implement client-side debounce and a unique `idempotencyKey` header checked atomically in Redis/MongoDB.

---

### Scenario 3: User's Wallet Disconnects During Signing
- **Trigger:** User closes the browser extension or rejects the signing pop-up.
- **Affected Components:** `near-wallet-connector.ts`, `WalletSessionModal.tsx`.
- **Current Behavior:** Unhandled rejection logged to console; modal remains stuck in loading state.
- **Expected Behavior:** Modal catches rejection, displays *"Transaction cancelled by user"*, and returns to review state.
- **Financial / User Impact:** None. Funds remain in user's wallet.
- **Data Consistency:** No on-chain or database state change.
- **Recovery:** Automatic. No manual intervention.
- **Prevention:** Comprehensive try/catch on `signAndSendTransaction` with specific handling for `UserRejected` errors.

---

### Scenario 4: AI Identifies the Wrong Recipient
- **Trigger:** Ambiguous prompt like *"Tip 1 NEAR to alex"* when user meant `@alex_near` instead of `@alex`.
- **Affected Components:** `src/lib/ai-gateway.ts`, `ChatInterface.tsx`.
- **Current Behavior:** AI extracts `@alex` and builds confirmation card for `@alex`.
- **Expected Behavior:** The user is presented with the confirmation card showing `@alex` and must explicitly click "Confirm & Sign".
- **Financial / User Impact:** If user blindly confirms without reading, funds go to the wrong recipient escrow.
- **Data Consistency:** Consistent with user's signed intent.
- **Recovery:** Sender can invoke `refund_tip` if the escrow remains unclaimed.
- **Prevention:** Show full recipient profile preview (avatar, verification badge) on the confirmation card before signing.

---

### Scenario 5: AI Extracts the Wrong Amount
- **Trigger:** User writes *"Invoice for 100 with 5% discount"*; AI extracts `100` instead of `95`.
- **Affected Components:** `src/lib/ai-gateway.ts`.
- **Current Behavior:** Fast-path regex extracts the first digit `100`.
- **Expected Behavior:** LLM calculates arithmetic or requests clarification on final invoice total.
- **Financial / User Impact:** Overcharging or undercharging payer.
- **Data Consistency:** Accurate to the generated invoice.
- **Recovery:** Creator cancels invoice using `/api/paylinks` void endpoint and creates a new one.
- **Prevention:** Enforce pre-generation review card in chat for all AI-parsed invoices.

---

### Scenario 6: Backend Accepts a Request but Smart Contract Rejects It
- **Trigger:** Attached deposit is less than the minimum required storage staking fee, or subaccount prefix check fails.
- **Affected Components:** `/api/near/send-tip`, `contracts/veilx-escrow/src/lib.rs`.
- **Current Behavior:** API returns 500 error with raw NEAR RPC panic log. DB record is created in `"broadcasting"` state and remains stale.
- **Expected Behavior:** API catches contract panic, updates DB record to `"failed"`, and returns user-friendly error.
- **Financial / User Impact:** Gas fee lost; principal funds remain untouched.
- **Data Consistency:** Temporary inconsistency until `/api/reconcile` runs.
- **Recovery:** Reconciliation worker flags transaction as failed.
- **Prevention:** Implement pre-flight simulation (`dry_run` view call) before broadcasting transaction.

---

### Scenario 7: Contract Succeeds but Database Update Fails
- **Trigger:** MongoDB network timeout or connection exhaustion immediately following on-chain transaction finality.
- **Affected Components:** `/api/near/send-tip`, MongoDB Atlas `EscrowTip`.
- **Current Behavior:** On-chain escrow exists, but database has no record or leaves it in `"broadcasting"`. User dashboard does not display the tip.
- **Expected Behavior:** Background reconciliation worker detects on-chain contract events and automatically backfills MongoDB.
- **Financial / User Impact:** Zero financial loss; temporary visual discrepancy for user.
- **Data Consistency:** On-chain ground truth preserved; off-chain DB out of sync.
- **Recovery:** `/api/reconcile` cron queries `get_tip` on-chain and inserts/updates DB record.
- **Prevention:** Dual-write queue or event listener indexing NEAR contract receipts.

---

### Scenario 8: Database Succeeds but Blockchain Transaction Fails
- **Trigger:** API saves "pending" tip record, then NEAR RPC fails with `InvalidNonce` or node timeout.
- **Affected Components:** `/api/near/send-tip`, `src/models/EscrowTip.ts`.
- **Current Behavior:** If not wrapped in try/catch, DB record remains in `"pending"` forever.
- **Expected Behavior:** DB write should only be committed AFTER on-chain transaction hash is received.
- **Financial / User Impact:** User believes funds were sent when they were not.
- **Data Consistency:** DB shows false positive pending escrow.
- **Recovery:** `/api/reconcile` checks hash on-chain, finds non-existent transaction, and marks record `"failed"`.
- **Prevention:** Never persist pending status before receiving valid RPC broadcast response.

---

### Scenario 9: Transaction is Pending for an Extended Period
- **Trigger:** NEAR network congestion or gas price spike during peak load.
- **Affected Components:** `TransactionDashboard.tsx`, NEAR RPC.
- **Current Behavior:** Dashboard displays spinning "Broadcasting..." badge indefinitely until page refresh.
- **Expected Behavior:** Poll transaction receipt every 3 seconds for 30 seconds; if still pending, switch to "Processing on-chain (Pending Finality)".
- **Financial / User Impact:** User anxiety, potential duplicate submission attempt.
- **Data Consistency:** State resolves once block inclusion occurs.
- **Recovery:** Automatic polling or manual page refresh.
- **Prevention:** Exponential backoff poller with explicit timeout and Explorer link.

---

### Scenario 10: User Refreshes While Payment is Processing
- **Trigger:** User refreshes browser on `/pay/[slug]` after clicking "Pay Now".
- **Affected Components:** `src/app/pay/[slug]/page.tsx`, `localStorage`.
- **Current Behavior:** React component unmounts; in-flight promise drops. On reload, invoice page resets to initial unpaid state.
- **Expected Behavior:** Check on-chain invoice status on mount; if settlement transaction was confirmed, display immediate Success receipt.
- **Financial / User Impact:** User may pay twice if they believe the first payment failed.
- **Data Consistency:** PayLink status eventually updated by reconcile worker.
- **Recovery:** Payer must contact recipient for manual refund if duplicate payment sent.
- **Prevention:** Cache transaction hash in `sessionStorage` and immediately query status on page load.

---

### Scenario 11: User Claims the Same Escrow Twice
- **Trigger:** User opens claim link in two tabs and clicks "Claim" simultaneously.
- **Affected Components:** `/api/relay/claim`, `veilx-escrow.testnet`.
- **Current Behavior:** First transaction claims funds; second transaction fails with contract panic: `"Tip already claimed"`.
- **Expected Behavior:** Second tab detects contract status `claimed == true` and displays *"Tip has already been claimed into your wallet."*
- **Financial / User Impact:** None. Smart contract double-claim guard prevents loss.
- **Data Consistency:** Consistent.
- **Recovery:** Automatic.
- **Prevention:** Smart contract invariant I-01 strictly prevents double withdrawal.

---

### Scenario 12: Unauthorized User Attempts to Claim Escrow
- **Trigger:** Attacker discovers `tip_id` and submits claim with their own NEAR account.
- **Affected Components:** `veilx-escrow.testnet`, `/api/relay/claim`.
- **Current Behavior:** Contract verifies `predecessor == owner_id` (relayer) and validates handle prefix. Direct attacker call fails with `"Unauthorized"`.
- **Expected Behavior:** Contract rejects transaction; relayer verifies Twitter OAuth proof before signing.
- **Financial / User Impact:** Zero. Attacker cannot claim funds.
- **Data Consistency:** Secure.
- **Recovery:** No action needed.
- **Prevention:** Multi-layer authorization: OAuth verification on relayer + cryptographic commitment pre-image verification on contract.

---

### Scenario 13: Token Transfer Fails Because of Missing Storage Registration
- **Trigger:** Depositor sends NEP-141 token (e.g. USDC) to recipient whose account is not registered on the token contract.
- **Affected Components:** `veilx-escrow.testnet`, `contracts/veilx-escrow/src/lib.rs` (`ft_transfer`).
- **Current Behavior:** NEP-141 transfer panics with `The account is not registered on the token contract`. Contract callback `ft_resolve_claim` reverts `tip.claimed = false`.
- **Expected Behavior:** Relayer checks recipient storage registration prior to claim; attaches 0.00125 NEAR to register recipient automatically if needed.
- **Financial / User Impact:** Claim fails; funds remain safely in escrow.
- **Data Consistency:** `ft_resolve_claim` rollback ensures consistency.
- **Recovery:** Register account on token contract and re-attempt claim.
- **Prevention:** Pre-claim check for storage registration.

---

### Scenario 14: Telegram Bot Receives Duplicate Webhook Updates
- **Trigger:** Telegram server re-sends webhook because response exceeded 5 seconds.
- **Affected Components:** `src/app/api/telegram/webhook/route.ts`, `src/models/PayLink.ts`.
- **Current Behavior:** Endpoint processes message twice, creating two identical invoices in MongoDB.
- **Expected Behavior:** Webhook checks `update_id` in deduplication cache; returns immediate 200 OK for duplicates.
- **Financial / User Impact:** Confusion from receiving duplicate PayLinks in chat.
- **Data Consistency:** Duplicate database records.
- **Recovery:** User ignores duplicate invoice.
- **Prevention:** Atomic Redis `SETNX` lock on `telegram_update_<update_id>` with 60-second TTL.

---

### Scenario 15: Telegram Account is Linked to the Wrong VeilX Account
- **Trigger:** User shares one-time `/link` URL with another person or opens it in a browser logged into a different X account.
- **Affected Components:** `src/lib/telegram-bot.ts`, `src/models/TelegramChat.ts`.
- **Current Behavior:** Telegram identity binds to whatever session cookie is active on the browser that clicks the link.
- **Expected Behavior:** Prompt confirmation dialog displaying: *"Link Telegram @user to X handle @target? [Confirm / Reject]"*.
- **Financial / User Impact:** Misdirected tip notifications.
- **Data Consistency:** Database stores incorrect linkage.
- **Recovery:** User types `/link` again and re-authenticates with proper X account.
- **Prevention:** Explicit confirmation page displaying both social handles before database commit.

---

### Scenario 16: User's Delegated Session Key Expires or is Revoked
- **Trigger:** 24-hour session timer elapses or user clears browser data.
- **Affected Components:** `src/components/modals/WalletSessionModal.tsx`, `near-embedded-wallet.ts`.
- **Current Behavior:** Transaction fails on-chain with `AccessKeyNotFound` or `InvalidSignature`.
- **Expected Behavior:** Frontend detects expired session key and prompts 1-Click Session Renewal modal.
- **Financial / User Impact:** None. Funds safe.
- **Data Consistency:** Local storage updated to expired.
- **Recovery:** User re-authorizes session key.
- **Prevention:** Active session countdown timer in HeaderNav with warning at 30 minutes remaining.

---

### Scenario 17: Spending Allowance is Exhausted
- **Trigger:** Cumulative tip transactions exceed user's configured session allowance (e.g. 5.0 NEAR).
- **Affected Components:** `WalletSessionModal.tsx`, `ai-gateway.ts`.
- **Current Behavior:** Client-side check stops transaction and opens WalletSessionModal to request allowance increase.
- **Expected Behavior:** Smooth modal transition with clear message: *"Session allowance reached (5.0/5.0 NEAR). Increase limit to continue."*
- **Financial / User Impact:** Protects user from runaway spending or unauthorized automated drains.
- **Data Consistency:** Secure.
- **Recovery:** User clicks "Increase Allowance" and confirms with main wallet.
- **Prevention:** Real-time allowance progress bar in UI.

---

### Scenario 18: AI Provider (Gemini / NEAR AI) Becomes Unavailable
- **Trigger:** Upstream API outage or rate limit exhaustion.
- **Affected Components:** `src/lib/ai-gateway.ts`, `/api/chat`.
- **Current Behavior:** Hybrid router circuit-breaker triggers: Tier 1 Fast-Path Regex executes seamlessly; Tier 2 Gemini fails over to Tier 3 NEAR AI Cloud. If all fail, returns clear error.
- **Expected Behavior:** Structured fallback to rule-based pattern matching.
- **Financial / User Impact:** Complex conversational queries unavailable; standard commands (`/invoice`, `/tip`) continue working via Tier 1.
- **Data Consistency:** Safe.
- **Recovery:** Automatic when upstream recovers.
- **Prevention:** Multi-provider fallback architecture (already implemented in Phase 3).

---

### Scenario 19: Cross-Chain Quote Expires
- **Trigger:** User reviews Defuse 1Click swap quote for >60 seconds before confirming.
- **Affected Components:** `src/lib/1click.ts`, `src/app/api/quotes/route.ts`.
- **Current Behavior:** Solver rejects execution with `QuoteExpired`. UI shows error toast.
- **Expected Behavior:** Auto-refresh quote countdown bar (60s timer); refresh quote automatically when timer hits 0.
- **Financial / User Impact:** None. Expired orders are never executed.
- **Data Consistency:** Order marked expired in database.
- **Recovery:** Click "Refresh Quote" to get new rate.
- **Prevention:** Visual circular progress ring with automatic quote re-fetch.

---

### Scenario 20: Cross-Chain Settlement Fails After a Quote Was Accepted
- **Trigger:** Source chain transaction succeeds, but solver runs out of destination chain liquidity.
- **Affected Components:** Defuse 1Click Solver network, `IntentOrder.ts`.
- **Current Behavior:** Defuse protocol smart contract automatically refunds source deposit back to user after solver timeout (5 minutes).
- **Expected Behavior:** Dashboard shows *"Settlement Delayed — Auto-Refund in Progress"*.
- **Financial / User Impact:** Capital temporarily locked for 5 minutes during solver refund cycle.
- **Data Consistency:** IntentOrder status transitions from `"executing"` to `"refunded"`.
- **Recovery:** Defuse on-chain protocol enforces automatic deposit return.
- **Prevention:** Query solver depth before displaying quote to user.

---

### Scenario 21: Invoice is Paid but the Application Still Shows Unpaid
- **Trigger:** WebSocket disconnects or webhook dropped while user viewing invoice.
- **Affected Components:** `src/app/pay/[slug]/page.tsx`, `TransactionDashboard.tsx`.
- **Current Behavior:** Screen remains on "Awaiting Payment" until manual reload.
- **Expected Behavior:** Fallback HTTP polling every 4 seconds on `/api/paylinks` while invoice page is mounted.
- **Financial / User Impact:** Payer uncertainty.
- **Data Consistency:** On-chain is paid; local UI state stale.
- **Recovery:** Page refresh or `/api/reconcile` run.
- **Prevention:** Hybrid polling + WebSocket connection on payment checkout screen.

---

### Scenario 22: User Opens an Expired or Invalid PayLink
- **Trigger:** Navigating to `/pay/non-existent-slug` or invoice older than 30 days.
- **Affected Components:** `src/app/pay/[slug]/page.tsx`.
- **Current Behavior:** **CRITICAL DEFECT:** Line 57 falls back to hardcoded mock data for "expatq3" for $15.00!
- **Expected Behavior:** Display clean 404 error page: *"This PayLink does not exist or has expired."*
- **Financial / User Impact:** Payer could accidentally send funds to mock address.
- **Data Consistency:** Bad data presentation.
- **Recovery:** Fix code to remove fallback mock.
- **Prevention:** Remove mock fallback; render error state.

---

### Scenario 23: Database (MongoDB Atlas) is Temporarily Unavailable
- **Trigger:** Atlas maintenance, connection limit spike, or bad network route.
- **Affected Components:** All API routes calling `connectToDatabase()`.
- **Current Behavior:** API calls hang until 10s connection timeout, then return 500 error.
- **Expected Behavior:** Immediate circuit-breaker response: *"Service temporarily operating in read-only degraded mode"*. Direct on-chain queries continue working.
- **Financial / User Impact:** Cannot create new off-chain invoices; existing on-chain claims can still be executed directly via smart contract.
- **Data Consistency:** Preserved.
- **Recovery:** Automatic when Atlas reconnects.
- **Prevention:** Mongoose connection pool tuning (`maxPoolSize: 20`) and connection caching.

---

### Scenario 24: RPC Provider Goes Offline
- **Trigger:** `rpc.testnet.near.org` suffers outage or 429 throttling.
- **Affected Components:** `near-rpc.ts`, `ai-gateway.ts`, `contracts/veilx-escrow`.
- **Current Behavior:** Automatic multi-RPC fallback rotates across:
  1. `https://rpc.testnet.near.org`
  2. `https://test.rpc.fastnear.com`
  3. `https://rpc.testnet.pagoda.co`
- **Expected Behavior:** Seamless failover with <500ms delay.
- **Financial / User Impact:** Minimal.
- **Data Consistency:** Intact.
- **Recovery:** Automatic failover.
- **Prevention:** Robust multi-provider RPC pooling (already implemented).

---

### Scenario 25: User Attempts a Financial Action from Multiple Devices Simultaneously
- **Trigger:** User sends a tip on mobile while initiating an invoice payment on desktop using the same session account.
- **Affected Components:** NEAR Account Nonce, `near-api-js`.
- **Current Behavior:** One transaction succeeds; the other fails with `InvalidNonce: Transaction nonce 45 must be larger than 45`.
- **Expected Behavior:** Client-side nonce synchronization and retry loop (up to 3 retries with fresh nonce query).
- **Financial / User Impact:** One transaction fails; no fund loss.
- **Data Consistency:** Safe.
- **Recovery:** Re-submitting the failed transaction succeeds with fresh nonce.
- **Prevention:** Fetch latest access key nonce immediately before transaction signing.
