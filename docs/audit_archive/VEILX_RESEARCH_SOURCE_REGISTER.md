# VEILX AGENT — RESEARCH SOURCE REGISTER & CITATION LOG

> **Document Created:** November 7, 2026  
> **Repository:** `C:\Users\HomePC\Downloads\VeilX-Agent`  
> **Purpose:** Verifiable Audit Trail of all primary documentation, technical standards, X posts, codebases, and external resources utilized in the research report.

---

## 1. Primary Technical Documentation

| Resource Name | Source URL | Verified Access Date | Key Findings Utilized |
| :--- | :--- | :---: | :--- |
| **NEAR Intents Portal** | `https://intents.near.org/` | Nov 7, 2026 | User-centric intent model, solver competition, zero-slippage guarantee, atomic settlement. |
| **NEAR Intents Official Docs** | `https://docs.near-intents.org/` | Nov 7, 2026 | Architecture, WebSocket Message Bus, Verifier contract, Intents SDK (`@defuse-protocol/intents-sdk`). |
| **Confidential Intents Specs** | `https://docs.near-intents.org/` / NEAR Private Shards | Nov 7, 2026 | Private shard encryption, PBFT validator consensus (~200ms), TEE-based cross-chain bridge, selective disclosure attestations. |
| **Defuse 1Click Swap API** | `https://1click.chaindefuser.com` | Nov 7, 2026 | Quote solicitation, deposit address generation, solver execution lifecycle polling. |
| **NEAR Chain Signatures (MPC)**| `https://docs.near.org/abstraction/chain-signatures` | Nov 7, 2026 | Universal EVM address derivation from NEAR accounts (`v1.signer-prod.testnet`), threshold ECDSA signing. |
| **NEAR NEP-366 Session Keys** | `https://github.com/near/NEPs/blob/master/neps/nep-0366.md` | Nov 7, 2026 | Scoped `FunctionCall` access keys, autonomous spending allowances, non-custodial delegation. |
| **NEAR AI Cloud (TEE Enclaves)**| `https://api.near.ai/` | Nov 7, 2026 | Hardware TEE confidential model execution (`meta-llama/Llama-3.3-70B-Instruct`), remote attestation proofs. |
| **Ondo Finance Tokenized Notes**| Ondo Documentation & NEAR Token Contracts | Nov 7, 2026 | NEP-141 wrapped equity notes (`NVDAon`, `TSLAon`, `SPYon`, `GLDon`), bankruptcy-remoteness, pricing mechanics. |

---

## 2. Primary X / Twitter Posts Log (Retrieved via Twitter Syndication API)

| Author Handle | Tweet ID & URL | Status | Core Technical Contribution to VeilX |
| :--- | :--- | :---: | :--- |
| **G will❤️‍🔥 (`@Big14teru`)** | `status/2118790570717950450` | **Verified & Retrieved** | *Chaperone Walkthrough*: On-chain smart contract refusal of poisoned invoices; independent verification of TEE model verdicts. |
| **shinigami (`@t7pkaaa`)** | `status/2118777298921136597` | **Verified & Retrieved** | *Milestone Vault*: Multi-agent threshold consensus ($m$-of-$n$ sandboxed AI auditors) releasing smart contract escrow. |
| **Adelekejr.eth (`@Ade_lekeJr`)**| `status/2118745431651885226` | **Verified & Retrieved** | *Glassbox*: On-chain agent promise registration (code hash, config, permissions); fail-closed evaluation (`PROVEN`, `NOT PROVEN`, `RISKY`). |
| **G will❤️‍🔥 (`@Big14teru`)** | `status/2118752617073414491` | **Verified & Retrieved** | *Prompt Injection Threat Model*: Documented the May 4 Morse code exploit draining $150K; necessity of separating wallet key from agent authority. |
| **ileri 𖣂 (`@0xileri`)** | `status/2118611793987698955` | **Verified & Retrieved** | *SpactVault*: Sub-account vault architecture (`agent.user.near`); tiered spending limits (instant, pending approval, hard block). |

---

## 3. Internal Repository Codebase Evidence

| File Inspected | Key Lines / Functions Audited | Evidence Found |
| :--- | :--- | :--- |
| [`src/lib/1click.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/1click.ts) | Lines 365–540 (`getLiveQuote`, `createIntentOrder`, `pollIntentExecution`) | Active REST client connecting to `1click.chaindefuser.com`. Real cross-chain inbound order generation. |
| [`src/lib/trading-copilot.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/trading-copilot.ts) | Lines 379–393 (`mockTxHash`, instant order execution) | **Simulated execution in memory**; generates synthetic `0x...` hashes; does not submit orders to solvers. |
| [`src/lib/market-analyst.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/market-analyst.ts) | Lines 86–165 (`evaluateMarketAndGenerateDecisions`) | Autonomous stop-loss (-5%) and take-profit (+10%) logic; generates mock hashes for portfolio rebalancing. |
| [`src/app/pay/[slug]/page.tsx`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/app/pay/[slug]/page.tsx) | Lines 63–145 (multichain PayLink checkout) | Functional solver quote integration; lacks visual countdown progress ring for quote expiry. |
| [`src/components/chat/ChatContainer.tsx`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/components/chat/ChatContainer.tsx) | Lines 400–515, 915–990 | Live NEAR testnet tipping via `/api/near/send-tip`; real faucet integration; state updates in-place. |
| [`src/components/chat/MessageBubble.tsx`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/components/chat/MessageBubble.tsx) | Complete AST markdown engine | Zero-emoji policy; sanitized content pipeline; neutral VeilX design system. |
| [`src/components/modals/SpendingCapModal.tsx`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/components/modals/SpendingCapModal.tsx) | Lines 25–95 (autonomous cap controller) | Flat $50 slider; lacks per-transaction and rolling time-window controls. |

---

## 4. Research Limitations & Explicit Disclaimers

1. **No Application Code Was Modified:** Per strict scope instructions, zero application files or configurations were altered. All research is non-destructive.
2. **Confidential Intents Maturity:** Confidential Intents on NEAR is currently in **Beta** on testnet private shards. Production deployments must account for permissioned validator set assumptions.
3. **Tokenized Stock Legal Nature:** Tokenized equities (Ondo) are contractual debt/derivative wrappers tracking stock spot prices; they are not direct SEC-registered common stock.
