# VEILX AGENT — PERSONAL ACTION & DELEGATION CHECKLIST

**Target Project:** VeilX Omnichain Agent System  
**Audit Date:** November 3, 2026  
**Auditor:** Senior Technical Project Manager & Solution Architect  
**Objective:** Clear separation of engineering agent tasks, personal founder/owner responsibilities, and key architectural sign-offs.

---

## CATEGORY A: TASKS THE CODING AGENT CAN COMPLETE AUTONOMOUSLY
*(Can be executed immediately upon user approval without external secrets or financial credentials)*

- [ ] **A1. Eliminate Plaintext Private Key Transmission in `/api/near/send-tip` & `/withdraw`:**
  - Refactor frontend components to sign transactions locally using `near-api-js` in the browser.
  - Remove `senderPrivateKey` from all backend route parameters.
- [ ] **A2. Remove Hardcoded Fake Mock Data in `/pay/[slug]` & `/dashboard`:**
  - Delete fake fallback mock (`expatq3`, `$15.0`) on lines 54–65 of `src/app/pay/[slug]/page.tsx`.
  - Replace with standard `404 Not Found` or `Invoice Not Available` UI screen.
- [ ] **A3. Fix Hardcoded $4.29 Exchange Rate:**
  - Replace line 105 in `src/app/pay/[slug]/page.tsx` with dynamic price fetching from `src/lib/near-price.ts`.
- [ ] **A4. Resolve Mobile CSS Overflow on Viewports 320px–360px:**
  - Add `overflow-x-hidden` on main container and fix flex wrapping on `HeaderNav.tsx` and `ChatInterface.tsx`.
- [ ] **A5. Smart Contract Ephemeral Stealth Subaccount Patch:**
  - Update `contracts/veilx-escrow/src/lib.rs` to allow authorized ephemeral subaccounts (`claim-[6hex].veilx-agent.testnet`) to claim private tips without triggering prefix mismatch panics.
- [ ] **A6. Implement Smart Contract Refund Timelock & Resolution Callback:**
  - Add `created_at` timestamp and enforce minimum timelock before sender can invoke `refund_tip`.
  - Attach `near_resolve_refund` promise callback to prevent permanent fund locking on failed refund transfers.
- [ ] **A7. Standardize Module Import Extensions for ESM Test Runners:**
  - Fix missing `.ts` extensions in `src/lib/ai-gateway.ts` to allow direct execution of unit test suites via standalone Node.js.
- [ ] **A8. Telegram Webhook Deduplication Lock:**
  - Add 60-second atomic cache on incoming Telegram `update_id` to eliminate duplicate invoice generation.

---

## CATEGORY B: TASKS REQUIRING YOUR PERSONAL INVOLVEMENT
*(Cannot be done by the coding agent; requires personal accounts, API keys, dashboard access, and testnet funding)*

### 1. Telegram Bot Configuration (`@BotFather`)
- [ ] **B1. Create Telegram Bot:** Open `@BotFather` on Telegram, create `@VeilXAgentBot` (or your chosen bot handle), and obtain the HTTP API Bot Token.
- [ ] **B2. Configure Bot Commands:** In `@BotFather`, run `/setcommands` and paste the official command list:
  ```text
  start - Launch VeilX Omnichain Copilot
  help - View command guide and examples
  invoice - Create an instant non-custodial PayLink
  tip - Send a social tip to any Twitter handle
  pay - Pay any NEAR (*.testnet) or Base/EVM (0x...) wallet
  evm - View your deterministic Base/Ethereum address via NEAR MPC
  wallet - View your session account details and balances
  link - Link Telegram to your VeilX WebApp session
  ```
- [ ] **B3. Set Webhook Secret:** Choose a secure random string for `TELEGRAM_WEBHOOK_SECRET` and configure the webhook URL with Telegram API.

### 2. Twitter / X Developer Portal Setup
- [ ] **B4. Create X Developer App:** Sign in to [developer.x.com](https://developer.x.com), create a project, and enable **User Authentication Settings (OAuth 2.0)**.
- [ ] **B5. Configure OAuth 2.0 Credentials:**
  - App Type: **Web App** (Confidential Client).
  - Callback URI: `https://<your-domain>/api/auth/callback/twitter` (or `http://localhost:3000/api/auth/callback/twitter` for local testing).
  - Website URL: `https://<your-domain>`.
- [ ] **B6. Obtain Client ID & Client Secret:** Copy `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` into your `.env.local` file.

### 3. Database & Hosting Setup (MongoDB Atlas)
- [ ] **B7. Network Access Whitelist:** In your MongoDB Atlas dashboard under **Network Access**, ensure `0.0.0.0/0` (or your production hosting IP addresses) is added to the IP Whitelist.
- [ ] **B8. Database Connection String:** Verify `MONGODB_URI` in `.env.local` contains valid username, password, and database name (`veilx`).

### 4. NEAR Protocol Testnet Account Funding
- [ ] **B9. Master Relayer & Contract Deployer Account:**
  - Ensure `veilx-agent.testnet` (or your designated relayer account) has at least **20 NEAR** testnet balance to sponsor gas fees, deploy contracts, and cover storage staking.
- [ ] **B10. Faucet Dispenser Account:**
  - Fund the dedicated faucet dispenser account with at least **10 NEAR** testnet to dispense 0.5 NEAR grants to new users.

---

## CATEGORY C: STRATEGIC DECISIONS REQUIRING OWNER SIGNOFF

### Decision 1: Client-Side Direct Signing vs Relayer Gas Sponsorship
- **Option 1 (Recommended):** Client signs transactions locally in the browser; transactions are broadcast directly to NEAR RPC. (Zero relayer dependency, 100% non-custodial, eliminates P0 private key exposure).
- **Option 2:** Client signs NEP-366 Meta-Transactions (off-chain payload), and VeilX Relayer submits them on-chain paying gas. (Gasless for new users, but requires relayer gas budget).
- **Status:** **PENDING FOUNDER DECISION.**

### Decision 2: Escrow Timelock & Refund Duration
- What should be the mandatory lockup period before a sender can refund an unclaimed Twitter tip?
  - *Option A:* 7 days (Recommended for social payments to give recipients time to notice notifications).
  - *Option B:* 48 hours (Faster capital return).
  - *Option C:* Configurable per tip by the sender.
- **Status:** **PENDING FOUNDER DECISION.**

### Decision 3: Ephemeral Stealth Subaccount Gas Sponsorship Policy
- When Phase 4 creates an ephemeral claim subaccount (`claim-[6hex].veilx-agent.testnet`), who pays the 0.005 NEAR account creation fee?
  - *Option A (Current):* VeilX master deployer sponsors the account creation fee.
  - *Option B:* Deduct 0.005 NEAR from the claimed tip amount.
- **Status:** **PENDING FOUNDER DECISION.**
