# Implementation Plan: Veil UI/UX Transformation & Audit Remediation

## Executive Overview
This implementation plan addresses the complete set of user requirements alongside **every finding from `01_FRONTEND_UI_UX_AUDIT.md` (`FE-001` through `FE-006`)**. It refines the product identity from **"VeilX Agent"** to **"Veil"**, modernizes the authentication modal with the official 𝕏 brand identity, cleans up landing page CTAs and typography, implements full mobile and tablet responsiveness, guarantees smart onboarding bypass for existing users, fixes WCAG contrast and button tooltips, and seals state loss upon logout/login.

---

## 1. Traceability Matrix: User Directives & Audit Findings (`FE-001` – `FE-006`)

| Finding / Directive | Source | Description | Proposed Implementation Fix |
| :--- | :---: | :--- | :--- |
| **Brand Identity** | User Request | Rename "VeilX Agent" $\to$ **"Veil"** | Update global headers, titles, dialogs, terminal banners, and hero copy across the entire codebase to reference **"Veil"**. |
| **Auth Modal Redesign** | User Request | Clean, unclustered modal; official 𝕏 logo; remove manual handle/wallet inputs | Replace character glyph with official vector SVG 𝕏 logo (`M18.244 2.25h3.308...`). Remove lines 162–213 of `AuthModal.tsx` (custom NEAR and manual input form). Keep single OAuth 2.0 PKCE button. |
| **Landing CTAs** | User Request | All CTA buttons should direct to login modal and not auto-login | Replace auto-navigation in `handleLaunchFlow` with explicit `setIsAuthModalOpen(true)` whenever `!isLoggedIn`. Secondary buttons act as scroll anchors or informational dialogs. |
| **Typography & Adjoints** | User Request | Remove adjoined words with `&` or `/` | Audit and replace all adjoined copy (e.g. `"Connect 𝕏 / Launch"` $\to$ `"Launch"`, `"Account & Identity"` $\to$ `"Account"`, `"Social payments & 38-chain PayLinks"` $\to$ `"Social payments with omnichain PayLinks"`). |
| **Hero Truthfulness** | User Request | Hero section must accurately state what Veil does without speculation | Rewrite hero headline and subtext to reflect real capabilities: autonomous AI stock trading and DCA in sandbox simulation, non-custodial social tips on X, and cross-chain PayLinks. |
| **Icon Standardization** | User Request | Use standard professional icons (no AI emojis or synthetic icons) | Audit all pages and components; replace synthetic emojis and custom inline SVGs with standard Lucide-React / React Icons. |
| **Smart Onboarding Bypass** | User Request | Skip onboarding if user already has an account / portfolio | In `LandingPage` and `OnboardingPage`, query `/api/user?handle=...` or `/api/portfolio?handle=...`. If record exists, set `veilx_onboarded = true` and route directly to `/terminal`. |
| **Mobile & Tablet Layout** | User Request & `FE-003` | App is not responsive on mobile and tablet layout | In `src/app/terminal/page.tsx`, replace the fixed-width desktop splitter with a mobile-first segmented switch (`[ 📈 Chart & Orders ]` vs `[ 💬 Veil Copilot ]`) on viewports $< 1024\text{px}$. Ensure chart and chat take 100% full width. |
| **Logout Redirection** | User Request | Redirect to landing page on logout instead of remaining on dashboard | In `AuthContext.tsx:logout()`, clear all local state and force `window.location.href = "/"`. |
| **Guardrail & Spending Persistence** | User Request | Logging in and out clears guardrails and fails to update spending balance | Fetch `spendingLimitUsd` and `spentUsd` directly from MongoDB `/api/user` during `syncBalances()` so spending limits and spent balances survive sessions. |
| **[FE-001] WCAG Contrast** | `01_FRONTEND` | Muted metadata `#8C7A6B` (3.78:1) and `#9B8C80` (3.20:1) fail AA 4.5:1 | Darken muted text tokens to `#6E5D4F` (5.22:1 contrast against `#FAF7F0` canvas and 5.58:1 against white cards) across terminal, chart, ledger, and paylink. |
| **[FE-002] Icon Hover Tooltips** | `01_FRONTEND` | Icon-only buttons lack accessible names and hover tooltips | Keep buttons clean without permanent text labels; add subtle CSS hover tooltips (`group-hover:block`) and invisible `aria-label` tags for screen readers on all 15+ icon buttons. |
| **[FE-003] Splitter Keyboard Nav** | `01_FRONTEND` | Desktop draggable splitter lacks keyboard resizing | Add `role="separator"`, `tabIndex={0}`, `aria-valuenow`, and `ArrowLeft`/`ArrowRight` key handlers to the splitter divider in `terminal/page.tsx`. |
| **[FE-004] Suggestion Overflow** | `01_FRONTEND` | Suggestion pills hide overflow scrollbar without edge affordance | Add a subtle right-edge linear-gradient fade overlay (`from-transparent to-[#FAF7F0]`) on the suggestion chips container in `terminal/page.tsx` and `ChatContainer.tsx`. |
| **[FE-005] Landing Network Badge** | `01_FRONTEND` | Landing page statically shows "NEAR MAINNET" regardless of network | Bind landing page header badge to `networkMode` from `useAuth()` (`"NEAR MAINNET"` vs `"NEAR TESTNET"`). |
| **[FE-006] Session Revocation Guard** | `01_FRONTEND` | Terminal and chat retain authenticated view upon mid-session disconnect | Display a non-intrusive re-auth banner when session key is disconnected or revoked, with a 1-click `"Connect 𝕏 to Trade"` button. |

---

## 2. Detailed Implementation Phases

### Phase 1: Brand & Authentication Modal Overhaul
**Target File:** `src/components/modals/AuthModal.tsx`
1. **Rebrand:** Change title from "Connect 𝕏 & Wallet" to "Connect 𝕏", and subtitle to "Autonomous Finance with Veil on NEAR".
2. **Official 𝕏 SVG:** Replace character text `"𝕏"` with standard vector path:
   ```tsx
   <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
     <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
   </svg>
   ```
3. **De-cluttering:** Completely remove lines 162–213 (the manual handle input form and custom NEAR input section). The modal presents a single primary button: `"Continue with 𝕏"`.
4. **Accessible Dismiss:** Add `aria-label="Close dialog"` to the top-right close button.

---

### Phase 2: Landing Page Polish & Typography Sanitation
**Target File:** `src/app/page.tsx`
1. **CTA Routing:** Update `handleLaunchFlow`:
   ```tsx
   const handleLaunchFlow = () => {
     if (!isLoggedIn) {
       setIsAuthModalOpen(true);
     } else {
       router.push("/terminal");
     }
   };
   ```
2. **Remove Adjoined Words (`&` and `/`):**
   * Change `"Connect 𝕏 / Launch"` $\to$ `"Launch"`
   * Change `"Account & Identity"` $\to$ `"Account"`
   * Change `"Autonomous Ondo Stock Trading & Social Finance"` $\to$ `"Autonomous Stock Trading with Social Finance"`
   * Change `"Social payments & 38-chain PayLinks"` $\to$ `"Social payments with omnichain PayLinks"`
3. **Evidence-Backed Hero Copy:**
   * **Headline:** *"Autonomous trading for tokenized equities."*
   * **Subheadline:** *"Deploy Veil to automate your stock strategies with mathematical stop-loss and DCA rules in sandbox mode, send social tips on X, and accept payments across chains."*
4. **Fix Static Network Badge (`FE-005`):**
   * Replace hardcoded `<span>NEAR MAINNET</span>` with dynamic value based on `networkMode`:
     ```tsx
     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
     <span>{networkMode === "mainnet" ? "NEAR MAINNET" : "NEAR TESTNET"}</span>
     ```

---

### Phase 3: Mobile & Tablet Responsiveness Architecture
**Target Files:** `src/app/terminal/page.tsx`, `src/components/terminal/TradingChart.tsx`, `src/components/layout/HeaderNav.tsx`
1. **Terminal Splitter Transformation (`FE-003` & Mobile):**
   * Replace the fixed horizontal flex layout with responsive viewport handling:
     * **Desktop ($\ge 1024\text{px}$):** Keep the two-column resizable layout with keyboard accessibility (`role="separator"`, `tabIndex={0}`, arrow keys).
     * **Mobile & Tablet ($< 1024\text{px}$):**
       * Hide the vertical splitter handle completely.
       * Insert a sticky segmented control at the top of the terminal:
         ```tsx
         <div className="flex lg:hidden bg-[#FAF3E0] border border-[#EBE3D5] p-1 rounded-xl mx-4 mb-2 shrink-0">
           <button
             onClick={() => setMobileTab("chart")}
             className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
               mobileTab === "chart" ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs" : "text-[#6E5D4F]"
             }`}
           >
             📈 Chart & Orders
           </button>
           <button
             onClick={() => setMobileTab("copilot")}
             className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
               mobileTab === "copilot" ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs" : "text-[#6E5D4F]"
             }`}
           >
             💬 Veil Copilot
           </button>
         </div>
         ```
       * Render either the Chart View or the Copilot View at 100% full width and height depending on `mobileTab`.
2. **Chart Controls on Tablet:** Add `overflow-x-auto no-scrollbar` to the top chart toolbar so interval pills and indicator buttons never clip on iPad/tablet viewports.
3. **HeaderNav on Mobile:** Collapse menu items into a compact dropdown or drawer, preserving the wallet address and network toggle.

---

### Phase 4: Smart Onboarding Bypass & Auth Flow Optimization
**Target Files:** `src/app/onboarding/page.tsx`, `src/app/page.tsx`
1. **Onboarding Skip:** In `src/app/onboarding/page.tsx`:
   ```tsx
   useEffect(() => {
     if (!isLoggedIn || !user?.xHandle) return;
     // Check if user has already onboarded or has a portfolio in DB
     fetch(`/api/portfolio?handle=${user.xHandle}`)
       .then((r) => r.json())
       .then((data) => {
         if (data?.portfolio && data.portfolio.positions?.length > 0) {
           localStorage.setItem("veilx_onboarded", "true");
           router.replace("/terminal");
         }
       })
       .catch(() => {});
   }, [isLoggedIn, user?.xHandle, router]);
   ```
2. **Landing Page Skip:** If `isLoggedIn` and `veilx_onboarded === "true"`, pressing "Launch" navigates immediately to `/terminal`.

---

### Phase 5: Logout Redirection, Guardrail Persistence & Contrast Fixes
**Target Files:** `src/context/AuthContext.tsx`, `src/app/terminal/page.tsx`, `src/components/terminal/TradingChart.tsx`
1. **Clean Logout Redirection:**
   * In `AuthContext.tsx:logout()`:
     ```tsx
     const logout = () => {
       localStorage.removeItem(AUTH_STORAGE_KEY);
       localStorage.removeItem("veilx_onboarded");
       localStorage.removeItem("veilx_portfolio_setup");
       revokeAgentSession();
       setUser(null);
       setSpentUsd(0);
       setNearBalance("0.0");
       setBalanceUsd(0.0);
       setEvmBalance(null);
       fetch("/api/auth/me", { method: "DELETE" }).catch(() => {});
       window.location.href = "/";
     };
     ```
2. **Guardrail State Persistence:**
   * In `syncBalances()`, ensure `spendingLimitUsd` and `spentUsd` are read from the backend `/api/user?handle=${clean}` response, and update React state and local session so the spending balance never resets to zero on page reloads.
3. **WCAG Contrast Color Fix (`FE-001`):**
   * Replace all occurrences of `#8C7A6B` with `#6E5D4F` (5.22:1 contrast ratio against `#FAF7F0`).
   * Replace all occurrences of `placeholder-[#9B8C80]` with `placeholder-[#6E5D4F]`.
4. **Accessible Icon Tooltips (`FE-002`):**
   * Add invisible `aria-label="..."` attributes to all icon-only buttons.
   * Add subtle hover tooltips using `title` and CSS hover wrappers so buttons remain clean without visible clutter.
5. **Horizontal Suggestion Overflow Fade (`FE-004`):**
   * Add a right-edge gradient fade container over the suggestion chips in `terminal/page.tsx` and `ChatContainer.tsx`.
6. **Session Revocation Guard (`FE-006`):**
   * When `!isLoggedIn` inside `/terminal`, display a sticky top banner: *"View-Only Mode. Connect 𝕏 to execute trades and automate rules."* with a 1-click button to open `AuthModal`.

---

## 3. Verification & Acceptance Checklist

- [ ] **Brand Check:** All headers, modals, and landing sections display "Veil".
- [ ] **Auth Modal:** Opens cleanly with the official vector 𝕏 logo; no manual handle/wallet input fields.
- [ ] **Landing Page CTAs:** Unauthenticated clicks on any CTA button open the Auth Modal; no adjoined words (`&`, `/`) exist in headlines.
- [ ] **Hero Section:** Accurately describes Veil's autonomous stock trading in sandbox, social tipping, and cross-chain PayLinks.
- [ ] **Icon Standards:** All icons are clean Lucide-React vector components; zero synthetic emojis.
- [ ] **Onboarding Bypass:** Users with existing accounts skip the onboarding stepper and land directly on `/terminal`.
- [ ] **Mobile & Tablet:** On screen widths $< 1024\text{px}$, the terminal provides a 2-tab switch (`[ 📈 Chart ]` vs `[ 💬 Copilot ]`) with no horizontal blowout.
- [ ] **Logout Flow:** Clicking "Log Out" cleans all state and immediately redirects to `/`.
- [ ] **Spending Balance:** Refreshing or logging in preserves the user's spending limit and spent balance.
- [ ] **WCAG AA Contrast:** Muted text uses `#6E5D4F` meeting the 4.5:1 ratio.
- [ ] **Icon Tooltips & ARIA:** All icon buttons have hover tooltips and screen-reader `aria-label` tags.
- [ ] **Splitter Accessibility:** Desktop splitter supports arrow key resizing.
- [ ] **Network Badge:** Landing page dynamically shows "NEAR MAINNET" or "NEAR TESTNET" based on active mode.
