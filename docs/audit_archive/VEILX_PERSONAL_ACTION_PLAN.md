# VEILX AGENT — PERSONAL ACTION PLAN & DEVELOPER PREREQUISITES

**Document Version:** 1.0.0  
**Status:** DRAFT — AWAITING USER APPROVAL (PLANNING ONLY)  
**Date:** November 2, 2026  
**Audience:** Project Owner & Lead Developer

---

## PART A — CREDENTIALS & EXTERNAL SERVICE PROVISIONING

### Task PERS-01: Telegram Bot Creation via @BotFather
- **Exact Action:** Message `@BotFather` on Telegram, create bot, obtain Bot Token, and configure webhook secret.
- **Reason:** Required for Telegram Copilot to receive updates and send notifications.
- **Where to Perform:** Telegram App $\rightarrow$ `@BotFather`.
- **Required Information:** Bot display name (e.g., `VeilX Omnichain Copilot`) and username (e.g., `VeilXAgentBot`).
- **Expected Result:** HTTP API Token string (e.g., `123456789:ABCdefGHI...`).
- **How to Verify:** `curl https://api.telegram.org/bot<TOKEN>/getMe` returns `{ "ok": true, "result": { "is_bot": true } }`.
- **Blocked Tasks:** `TASK-TG-01`, `TASK-TG-02`.

---

### Task PERS-02: 𝕏 (Twitter) Developer Portal OAuth 2.0 Configuration
- **Exact Action:** Create an OAuth 2.0 Project in Twitter Developer Portal, enable PKCE Confidential Web App, and configure callback URLs.
- **Reason:** Required for user authentication, immutable user ID mapping, and profile resolution.
- **Where to Perform:** `https://developer.x.com` $\rightarrow$ Projects & Apps $\rightarrow$ User Authentication Settings.
- **Required Information:**
  - Callback URLs:
    - `http://localhost:3000/api/auth/callback/twitter`
    - `https://your-production-domain.com/api/auth/callback/twitter`
  - Scopes: `tweet.read`, `users.read`, `offline.access`.
- **Expected Result:** `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET`.
- **How to Verify:** Click "Connect 𝕏" on webapp; Twitter authorization consent screen loads.
- **Blocked Tasks:** `TASK-SEC-02`, user onboarding flow.

---

### Task PERS-03: MongoDB Atlas Network IP Whitelisting
- **Exact Action:** Add developer IP or `0.0.0.0/0` (for dynamic cloud hosting) to MongoDB Atlas IP Access List.
- **Reason:** Prevents database connection timeouts during API operations and Next.js builds.
- **Where to Perform:** MongoDB Atlas Console $\rightarrow$ Network Access.
- **Required Information:** Current outbound IP or cloud subnet CIDR block.
- **Expected Result:** Status shows "Active".
- **How to Verify:** `npm run build` connects to MongoDB without `MongooseServerSelectionError`.
- **Blocked Tasks:** `TASK-DATA-01`, `TASK-BACK-01`.

---

### Task PERS-04: NEAR Testnet Relayer Funding (`veilx-agent.testnet`)
- **Exact Action:** Fund `veilx-agent.testnet` with at least 25 to 50 testnet NEAR.
- **Reason:** Sponsoring gasless claims for recipients (`/api/relay/claim`), funding new subaccounts (`ensureNearSubAccountExists`), and dispensing faucet tokens (`/api/near/faucet`).
- **Where to Perform:** NEAR Testnet Web Wallet or Faucet (`https://faucet.testnet.near.org`).
- **Required Information:** Account ID `veilx-agent.testnet`.
- **Expected Result:** Available balance $\ge 25\text{ NEAR}$.
- **How to Verify:** Check `https://testnet.nearblocks.io/address/veilx-agent.testnet`.
- **Blocked Tasks:** Gasless claim flow, testnet onboarding.

---

## PART B — INFRASTRUCTURE & ENVIRONMENT CONFIGURATION

| Variable Name | Environment | Source / How to Obtain | Status in `.env.local` |
| :--- | :--- | :--- | :---: |
| `MONGODB_URI` | Server | MongoDB Atlas Cluster Connection String | **Present** |
| `GEMINI_API_KEY` | Server | Google AI Studio Console | **Present** |
| `NEXT_PUBLIC_NEAR_NODE_URL` | Public | Official NEAR RPC (`https://rpc.testnet.near.org`) | **Present** |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID` | Public | Deployed Contract Account (`veilx-agent.testnet`)| **Present** |
| `ESCROW_PRIVATE_KEY` | Server | Relayer Ed25519 Keypair | **Present** |
| `SESSION_SECRET` | Server | Random 32-byte hex string for HMAC signing | **Present** |
| `TWITTER_CLIENT_ID` | Server | Twitter Developer Portal | **Present** |
| `TWITTER_CLIENT_SECRET` | Server | Twitter Developer Portal | **Present** |
| `TELEGRAM_BOT_TOKEN` | Server | Generated via `@BotFather` | **MISSING — Required for Phase 5** |
| `TELEGRAM_WEBHOOK_SECRET` | Server | Random 24-byte hex string configured in webhook | **MISSING — Required for Phase 5** |

---

## PART C — FORMAL PRODUCT & FINANCIAL APPROVAL GATES

You must explicitly review and approve the following before Phase 1 / Phase 2 execution:

1. **Smart Contract Upgrade Approval**:
   - Do you approve applying `TASK-SC-01` (removing relayer recipient override) and `TASK-SC-02` (native NEAR callback) and redeploying `contracts/veilx-escrow` on `veilx-agent.testnet`?
2. **Client-Side Signing Transition Approval**:
   - Do you approve refactoring `/api/near/send-tip` to accept pre-signed binary transactions and eliminating `senderPrivateKey` from HTTP requests (`TASK-SEC-05`)?
3. **Session Spending Cap Approval**:
   - Do you confirm keeping the default daily allowance at **$50.00 USD / day** with atomic server-side enforcement (`TASK-BACK-01`)?
4. **1Click Solvers Presentation Policy**:
   - Do you approve documenting Defuse 1Click solvers as mainnet-ready and utilizing native NEAR on testnet?

---

## PART D — TESTING & ACCEPTANCE ACTIONS REQUIRING USER PARTICIPATION

1. **Physical Device Testing**: Open `http://localhost:3000` on your mobile phone (via local Wi-Fi IP) to verify touch targets and responsive layout at 360px viewport.
2. **Twitter OAuth Smoke Test**: Log in with your personal 𝕏 handle to verify Twitter OAuth PKCE redirect and avatar rendering.
3. **External Wallet Signature Smoke Test**: Open a generated PayLink `/pay/inv_...` and test paying via Meteor Wallet or MyNearWallet.
4. **Telegram Bot Chat Test**: Send `/start` and `/invoice 0.05 NEAR` to your newly created bot to verify Telegram webhook delivery.
