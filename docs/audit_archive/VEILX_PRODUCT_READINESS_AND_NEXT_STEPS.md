# VEILX AGENT — PRODUCT READINESS CHECKLISTS & ACTIONABLE NEXT STEPS

> **Document Date:** November 7, 2026  
> **Status:** Actionable Readiness Plan  
> **Strict Scope Boundary:** Design, UX, Policy, and Architecture Planning Only. No implementation code altered.

---

## 1. Readiness Checklists by Sub-System

### 1.1 Social APay UI/UX Checklist

| # | Task | Why It Is Required | Current State | Required Outcome | Priority | Dependencies | Decision Needed? | Category |
| :-: | :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| **AP-01** | **Solver Quote Expiry Progress Ring** | Quotes expire in 60s; users currently experience silent fails | Static text displays expiry timestamp | Live animated countdown ring with 1-click auto-requote | **Critical** | Frontend only | No | Design / UX |
| **AP-02** | **Recipient Impersonation Warning Badge** | Protect users from sending funds to newly created copycat handles | Any handle accepted blindly | Yellow warning banner if X account is <14 days old or unverified | **High** | X API lookup | **Yes** | Product / Safety |
| **AP-03** | **Tipping Quick-Preset Pills** | Reduce friction for social micro-tipping | User must type full prompt manually | Clickable `$1`, `$5`, `$10`, `$25` pills above chat input | **Medium** | Frontend only | No | Design / UX |
| **AP-04** | **Gasless Escrow Sweeper Drawer** | Unregistered recipients struggle to find and claim pending tips | Hidden text in header nav | Sliding drawer showing pending tips with 1-Click "Claim All" | **High** | `/api/near/pending-tips` | No | Design / UX |

---

### 1.2 Stocks Trading UI/UX Checklist

| # | Task | Why It Is Required | Current State | Required Outcome | Priority | Dependencies | Decision Needed? | Category |
| :-: | :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| **ST-01** | **Deceptive Mock Hash Resolution** | Terminal displays fake `0x...` hashes; causes severe user mistrust | Code generates random hex in `trading-copilot.ts` | Replace with real 1Click execution OR explicit "[Paper Trading Sandbox]" tag | **Critical** | Product Strategy | **Yes** | Product / Integrity |
| **ST-02** | **Pre-Trade Slippage & Fee Modal** | Protect users from execution loss on thin Ondo token pools | Order placed immediately with no confirmation modal | Pre-trade preview showing min received, max slippage (1%), and fees | **Critical** | 1Click Quote API | No | Design / Safety |
| **ST-03** | **Emergency Trading Halt Switch** | Stop autonomous agent rebalancing immediately during volatility | No global pause button in Terminal | Prominent "PAUSE TRADING" toggle in terminal header and top nav | **Critical** | State Manager | No | Design / Safety |
| **ST-04** | **Market Hours & Tokenized Note Disclaimers** | Regulatory transparency; users must know they hold Ondo notes | No disclaimers on Terminal | Concise institutional disclaimer explaining note custody & market hours | **High** | Compliance text | **Yes** | Product / Legal |

---

### 1.3 Agent Conversational & Security Experience Checklist

| # | Task | Why It Is Required | Current State | Required Outcome | Priority | Dependencies | Decision Needed? | Category |
| :-: | :--- | :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| **SEC-01** | **Multi-Tiered Spending Cap Modal** | Current cap is single lump sum; vulnerable to rapid single-day drain | Flat $50 slider in `SpendingCapModal.tsx` | Tiered controls: Max Per-Tip ($15), Daily Budget ($50), Monthly Ceiling ($250) | **High** | Session state | **Yes** | Design / Safety |
| **SEC-02** | **Reactive Faucet $\rightarrow$ Intent Flow** | When balance is low, claiming faucet dead-ends the original transaction | Faucet claim succeeds, but user must retype prompt | After faucet dispense, card displays "Gas Refilled: [Proceed with Transfer]" | **Medium** | Frontend state | No | Design / UX |
| **SEC-03** | **Interactive Clarification Cards** | Prevent agent from guessing when amount or symbol is ambiguous | LLM guesses defaults (e.g. $50) | Renders selection pills: "Did you mean TSLA or AAPL?" | **Medium** | `MessageBubble.tsx` | No | Design / UX |

---

## 2. Phased Categorization of Work

```mermaid
flowchart TD
    subgraph A [Phase A: Must Complete Before Proceeding]
        A1[Resolve Mocked Trade Hashes vs Live Execution]
        A2[Implement Quote Expiration Timer on PayLinks]
        A3[Add Emergency Trading Freeze Toggle in Terminal]
        A4[Add Slippage & Pre-Trade Preview Confirmation Modal]
    end

    subgraph B [Phase B: Next Development Phase]
        B1[Integrate Multi-Tier Spending Caps (Per-Tx / Daily / Monthly)]
        B2[Add Recipient Account Age / Impersonation Check]
        B3[Build Inbound Escrow Claim Drawer]
        B4[Wire Real 1Click Swaps for Ondo Equities]
    end

    subgraph C [Phase C: Post-Launch Enhancements]
        C1[Integrate Confidential Intents Private Shard]
        C2[Add Direct WebSocket Solver Message Bus]
        C3[Implement Multi-Auditor AI Consensus for Trades >$250]
        C4[Batch Multi-Recipient Tipping]
    end

    A --> B --> C
```
