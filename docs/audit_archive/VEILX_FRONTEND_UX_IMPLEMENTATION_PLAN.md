# VEILX AGENT — FRONTEND, UI/UX & MOBILE IMPLEMENTATION PLAN

**Document Version:** 1.0.0  
**Status:** DRAFT — AWAITING USER APPROVAL (PLANNING ONLY)  
**Date:** November 2, 2026  
**Scope:** `src/app/`, `src/components/`, `src/context/`, Tailwind CSS, and Responsive Layouts

---

## 1. COMPONENT & PAGE REMEDIATION BLUEPRINT

```
+----------------------------------------------------------------------------------------------------+
|                                      FRONTEND COMPONENT TREE                                       |
|                                                                                                    |
|  [Root Layout (src/app/layout.tsx)]                                                                |
|  ├── [AuthProvider (src/context/AuthContext.tsx)]                                                  |
|  │   ├── [HeaderNav (src/components/layout/HeaderNav.tsx)]                                         |
|  │   │   ├── Brand Identity                                                                        |
|  │   │   ├── Chat / Dashboard Switcher                                                             |
|  │   │   ├── Omnichain Balance Dropdown Menu (TASK-UX-01)                                          |
|  │   │   └── Connected User Profile & Auth Modal Trigger                                           |
|  │   │                                                                                             |
|  │   ├── [Main View Routes]                                                                        |
|  │   │   ├── Route: / (src/app/page.tsx)                                                           |
|  │   │   │   └── [ChatContainer (src/components/chat/ChatContainer.tsx)] (TASK-SEC-05, TASK-AI-01)  |
|  │   │   │       ├── Message List & Action Cards                                                   |
|  │   │   │       ├── Suggestion Pills                                                              |
|  │   │   │       └── Chat Input with Precision @mentions                                           |
|  │   │   │                                                                                         |
|  │   │   ├── Route: /dashboard (src/app/dashboard/page.tsx)                                        |
|  │   │   │   └── [TransactionDashboard] (TASK-UX-02)                                               |
|  │   │   │       ├── Live Platform Activity Ticker                                                 |
|  │   │   │       ├── Executive Balance Hero Card                                                   |
|  │   │   │       ├── Financial Flow Metric Cards                                                   |
|  │   │   │       └── Tabs: Transaction History vs. Active PayLinks                                 |
|  │   │   │                                                                                         |
|  │   │   └── Route: /pay/[slug] (src/app/pay/[slug]/page.tsx) (TASK-SEC-04)                       |
|  │   │       ├── Digital Invoice Receipt                                                           |
|  │   │       ├── Multi-Chain Tabs: NEAR / Base / Solana                                            |
|  │   │       ├── QR Code & Copy Pill                                                               |
|  │   │       └── Confetti Celebration & Settlement Metadata                                        |
|  │   │                                                                                             |
|  │   └── [Modals & Overlay System]                                                                 |
|  │       ├── [SessionOnboardingModal (NEW)] (TASK-FRONT-01)                                        |
|  │       ├── [DepositModal (Updated with Base tab)] (TASK-FRONT-02)                                 |
|  │       ├── [WithdrawModal]                                                                       |
|  │       ├── [WalletSessionModal]                                                                  |
|  │       └── [TwitterClaimModal]                                                                   |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. FIRST-TIME USER EXPERIENCE (FTUX) ONBOARDING JOURNEY

### 2.1 The Problem Today
When a user clicks "Connect 𝕏", they are redirected back to the app with an active session, but are immediately dumped into the chat input without understanding:
1. What their personal account (`*.veilx-agent.testnet`) is.
2. What a delegated session key is.
3. Why their agent has a $50 daily spending limit.

### 2.2 The Remediation Onboarding Flow (`TASK-FRONT-01`)
Upon first authentication, before displaying the chat input, trigger `SessionOnboardingModal.tsx`:
- **Screen 1: Welcome & Omnichain Wallet Generation**:
  - *"Welcome @handle! We have created your personal, non-custodial NEAR account: `handle.veilx-agent.testnet`."*
  - *"Using NEAR Chain Signatures MPC, this single account also controls an EVM address on Base: `0x...`."*
- **Screen 2: Delegated Session Authority**:
  - *"To allow instant tipping without prompting your wallet popup on every $0.10 micro-tip, VeilX creates a scoped session key in your browser."*
  - Visual slider showing the default **$50.00 USD / day** limit.
  - Bulleted guarantees:
    - ✔ Scoped strictly to social tips and invoice settlement.
    - ✔ Cannot withdraw funds to external accounts.
    - ✔ Revocable with 1 click in your header menu anytime.
- **Action Button**: `[ Authorize & Enter VeilX ]` $\rightarrow$ saves `veilx_onboarded_v1 = true` and launches chat.

---

## 3. UI/UX SIMPLIFICATION & COMPONENT REMOVALS

| Component / Area | Action | Justification |
| :--- | :--- | :--- |
| **`AISettingsModal.tsx`** | **Remove / Consolidate** | Already removed from header navigation. Move custom API key inputs into an "Advanced" accordion inside `WalletSessionModal.tsx` and delete the standalone modal file. |
| **`In Escrow` Dashboard Tab** | **Preserve Removal** | Verified removed in previous session. The dashboard now cleanly filters by `All`, `Inflow`, and `Outflow`. |
| **`StatusRadar.tsx` in Chat** | **Simplify** | Consolidate from 4 redundant steps to 3 meaningful steps: 1. *Session Authorized*, 2. *Broadcast to NEAR*, 3. *Confirmed on Explorer*. |
| **Solana Tab on PayLink Page** | **Add Judge Notice** | Until 1Click solvers operate on testnet, add a clear badge: *"Solana 1Click Solver — Active on Mainnet Launch (Powered by Defuse Protocol)"* to prevent user confusion. |

---

## 4. MOBILE RESPONSIVENESS AUDIT & LAYOUT SPECIFICATIONS

### 4.1 Breakpoint-by-Breakpoint Layout Rules

```
Breakpoint        Width Range     Required Layout Behavior
───────────────────────────────────────────────────────────────────────────────────
320px             < 360px         • Username text: max-w-[65px] truncate
(iPhone SE 1st)                   • Balance pill: compact "$X.XX (Ⓝ) ▾"
                                  • Dashboard buttons: flex-col w-full
                                  • Modal padding: p-4 instead of p-6

360px             360px - 374px   • Username text: max-w-[85px] truncate
(Android Small)                   • Suggestion pills: horizontal scroll snap
                                  • Action cards: full-width with compact text

375px - 430px     375px - 767px   • Standard mobile viewport
(iPhone 12-16)                    • Full-width cards with comfortable 16px margins
                                  • Touch targets: minimum 44px height

768px - 1023px    768px - 1023px  • Tablet view
(iPad / Tablets)                  • 2-column metrics grid on Dashboard
                                  • Floating PayLink card max-w-[420px]

1024px+           >= 1024px       • Desktop view
                                  • 3-column metrics grid on Dashboard
                                  • Centered max-w-4xl container on Chat
```

---

## 5. FRONTEND ACCEPTANCE CRITERIA

1. **Mobile Header Fit**: At 320px viewport, `HeaderNav.tsx` displays brand logo, view toggle, balance dropdown, and username without horizontal scrolling or wrapping onto a second line.
2. **Deposit Clarity**: `DepositModal.tsx` allows switching between NEAR Protocol deposit instructions and Base Sepolia EVM deposit instructions with zero confusion.
3. **No Dead Clicks**: Every button across the application either executes an action, opens a modal, or surfaces an explicit disabled state with an explanatory tooltip.
4. **Explorer Proof**: Every transaction action card in chat provides a clickable direct link opening `https://testnet.nearblocks.io/txns/<hash>`.
