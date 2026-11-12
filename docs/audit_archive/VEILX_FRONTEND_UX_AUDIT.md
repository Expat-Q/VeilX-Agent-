# VEILX AGENT — FRONTEND, UI/UX & PRODUCT EXPERIENCE AUDIT

**Target System:** VeilX Agent Frontend Architecture (`src/app`, `src/components`, `src/lib`)  
**Audit Date:** November 3, 2026  
**Auditor:** Senior Full-Stack Software Architect & Product Designer  
**Scope:** Functional Completeness, Component Architecture, UI/UX Usability, Mobile Responsiveness (320px–1440px+), and Failure State Handling.

---

## 1. EXECUTIVE SUMMARY & PAGE-BY-PAGE INVENTORY

The VeilX frontend is constructed as a Next.js 14 App Router application styled with Tailwind CSS, utilizing Lucide React icons and client-side reactive components. The application targets three core user goals: (1) Social tipping via Twitter/X handles, (2) Non-custodial escrow invoicing with privacy-preserving commitments, and (3) AI-assisted cross-chain settlement (NEAR Intents / Defuse).

### 1.1 Page & Route Functional Inventory

| Route | Primary Component | Functional Status | Verified Capabilities | Broken / Mocked / Simulated Areas |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `src/app/page.tsx` | **Partially Functional** | AI Chat prompt submission, wallet session status badge, modal triggers, fast-path tip intents. | Uses in-memory session keys; hardcoded faucet limits; modal backdrop stacking bugs on mobile. |
| `/dashboard` | `src/app/dashboard/page.tsx` & `TransactionDashboard.tsx` | **Partially Functional** | Tab switching (tips, invoices, intents), filter badges, basic pagination shell. | Invoices fallback to hardcoded mock (`expatq3`, `$15.0`) when DB query fails; export CSV button unlinked. |
| `/pay/[slug]` | `src/app/pay/[slug]/page.tsx` | **Partially Functional** | PayLink memo decrypt, NEAR direct payment, QR code rendering. | **CRITICAL BUG:** Hardcoded NEAR/USD exchange rate `$4.29` on line 105; falls back to dummy mock data if slug not found. |
| `/api/auth/twitter` | Server Redirect | **Blocked / External** | OAuth 2.0 PKCE challenge generator. | Requires live Twitter Developer API Client ID (`TWITTER_CLIENT_ID`); fails with 500 if unset. |

---

## 2. MODAL & INTERACTION AUDIT

### 2.1 `WalletSessionModal.tsx` (`src/components/modals/WalletSessionModal.tsx`, 880 lines)
- **Status:** Functional with architectural risk.
- **Observed Behavior:** Manages NEAR session keys, allowance caps (e.g., 5.0 NEAR), and expiration timers. Keypair generation occurs locally via `near-api-js/lib/key_stores`.
- **Finding (P0-FE-01):** When a user triggers an automated transaction via the modal, the client exposes the session secret key directly to the server in `/api/near/send-tip` (line 89) instead of signing the transaction locally in the browser.
- **UX Issue:** The modal contains 4 sub-screens (Session Setup, Key Derivation, Allowance Selection, Confirmation) with no persistent breadcrumbs or step indicator, leading to high drop-off.

### 2.2 `DepositModal.tsx` & `WithdrawModal.tsx`
- **DepositModal:** Generates a QR code and NEAR account address for funding the embedded wallet. Verified working.
- **WithdrawModal:** Prompts for target NEAR account ID. **Vulnerability (P1-FE-02):** Lack of recipient address validation before sending; if an invalid `.near` suffix is typed, transaction fails silently with generic error banner.

### 2.3 `TwitterClaimModal.tsx`
- **Observed Behavior:** Allows recipients of Twitter tips to claim funds using OAuth proof.
- **Defect (P1-FE-03):** Does not poll contract status dynamically. If contract claim transaction takes >10 seconds, UI reports timeout error even though on-chain settlement succeeded.

---

## 3. UI/UX, COGNITIVE LOAD & PRODUCT CLARITY AUDIT

### 3.1 First-Time User Experience (FTUX)
1. **Landing Page Value Proposition:** The headline "Autonomous Privacy & Social Payments on NEAR" is technically descriptive but fails to explain to a non-crypto native what an "Autonomous Agent" actually does with their funds.
2. **Mental Model Collision:** Users are confused between **Embedded Wallets** (local session key) vs **External Wallets** (Meteor/HERE/MyNearWallet). The interface displays "Connected" even when only a local session key exists with 0 balance.
3. **Escrow vs Direct Transfer Ambiguity:** When tipping `@jack`, the user is not told whether the funds are held in the `veilx-escrow.testnet` smart contract or sent directly to an account named `jack.testnet`.

### 3.2 Terminology Inconsistencies
- The term **"Commitment Hash"** is exposed in the user-facing invoice receipt modal. Users have no context that this represents `SHA256(recipient + salt)`. It should be labeled **"Privacy Shield ID"** or hidden under an "Advanced Cryptography" toggle.
- "NEAR Intents / 1Click" is alternately referred to as "Cross-Chain Bridge", "Defuse Swap", and "Intent Solver" across `TransactionDashboard.tsx` and `ChatInterface.tsx`.

### 3.3 Elements Recommended for Removal or Simplification
1. **Redundant Faucet Banner:** The top faucet banner competes visually with the Agent Chat prompt. Consolidate into a `/faucet` quick-action pill in the chat.
2. **Simulated Zero-Knowledge Sliders:** The "Anonymity Level" slider in the advanced invoice modal does not alter on-chain privacy parameters; it merely adjusts client-side salt lengths. Either remove or wire to actual stealth subaccount routing.

---

## 4. MOBILE RESPONSIVENESS MATRIX (9 VIEWPORTS AUDITED)

| Viewport Width | Device Archetype | Layout Integrity | Issues Identified & Root Cause | Recommended Fix |
| :--- | :--- | :--- | :--- | :--- |
| **320px** | iPhone SE (1st Gen) | **BROKEN** | Horizontal overflow (342px total width). Header navigation icons collide with network badge. | Apply `overflow-x-hidden` on `body`; collapse Header icons into a hamburger drawer below 380px. |
| **360px** | Galaxy S8 / Android Mini | **DEGRADED** | Chat input submit button (`Send`) wraps below input field, causing text displacement. | Use `flex-nowrap` on chat input container; replace text "Send" with an icon-only arrow button. |
| **375px** | iPhone Mini / iPhone X | **ACCEPTABLE** | Modal dialog padding `p-6` takes 85% of screen height; buttons push below viewport fold. | Reduce modal padding to `p-4` on `max-sm`; add `max-h-[85vh] overflow-y-auto`. |
| **390px** | iPhone 12 / 13 / 14 | **ACCEPTABLE** | Minor text truncation on invoice status pill ("CONFIRMATION_PENDING"). | Use concise badge labels: "PENDING" instead of full enum names. |
| **414px** | iPhone 11 Pro Max / Plus | **GOOD** | Clear spacing, touch targets meet 44px minimum recommendation. | None required. |
| **430px** | iPhone 14 Pro Max / 15 Plus| **GOOD** | Stable layout; card grid stacks cleanly into single column. | None required. |
| **768px** | iPad Mini / Tablet Portrait | **EXCELLENT** | 2-column dashboard layout renders without distortion. | None required. |
| **1024px** | iPad Pro / Desktop Small | **EXCELLENT** | Full desktop sidebar expands; chat and analytics side-by-side. | None required. |
| **1440px+** | Desktop Large / Ultrawide | **EXCELLENT** | Content properly constrained by `max-w-7xl mx-auto`. | None required. |

---

## 5. FRONTEND FAILURE SCENARIOS & RESILIENCE

### 5.1 Network Interruption During Transaction Submission
- **Current Behavior:** The UI shows an infinite spinning loader in `WalletSessionModal.tsx`. If the user refreshes, the transaction state in `localStorage` is cleared, leaving the user unsure if their tip was sent.
- **Required Behavior:** Implement idempotent transaction tracking in `IndexedDB` with a persistent "Restoring Pending Transaction..." banner on reload.

### 5.2 Wallet Disconnect During Signing
- **Current Behavior:** An uncaught exception is logged to console: `Uncaught (in promise) Error: Wallet closed`. The modal stays open without an error notification.
- **Required Behavior:** Wrap external wallet adapters in an explicit try/catch boundary that emits an actionable user toast: *"Wallet connection was cancelled. No funds were debited."*

### 5.3 Stale Exchange Rates on Invoice Checkout
- **Current Behavior:** `src/app/pay/[slug]/page.tsx` line 105 uses a constant `const nearPrice = 4.29;`. If NEAR trades at $3.50 or $5.50, invoice conversions between USD and NEAR will either undercharge or overcharge the payer by 20%–40%.
- **Required Behavior:** Fetch real-time price via `/api/near/price` with a 30-second TTL cache and display a timestamped exchange rate quote to the user.

---

## 6. PRIORITIZED FRONTEND REMEDIATIONS

1. **[P0] Remove Plaintext Secret Key Handling from Client Submissions:** Refactor `send-tip` client invocations to perform Ed25519 signing locally via `near-api-js`.
2. **[P1] Fix Hardcoded $4.29 Exchange Rate:** Replace line 105 in `src/app/pay/[slug]/page.tsx` with dynamic price fetching from `src/lib/near-price.ts`.
3. **[P1] Eliminate Fake Mock Fallbacks:** In `/pay/[slug]` and `/dashboard`, do not display simulated data (`expatq3`) when API fails; render a clean `404 Not Found` or `Invoice Expired` state.
4. **[P2] Mobile Overflow Resolution:** Fix CSS layout rules on 320px–360px viewports in `HeaderNav.tsx` and `ChatInterface.tsx`.
5. **[P2] Terminology Clarification:** Replace technical cryptographic jargon with user-centric labels across all modal workflows.
