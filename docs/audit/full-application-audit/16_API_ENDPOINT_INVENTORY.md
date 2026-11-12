# 16 — COMPLETE API ENDPOINT INVENTORY & ROUTE CATALOG
**Project:** VeilX Autonomous Omnichain Social Finance & Tokenized Equities Terminal  
**Auditor:** Agent 3 — Backend, API & Endpoint Security Specialist  
**Status:** Audit Complete — Complete Endpoint Line-by-Line Inventory  
**Date:** November 11, 2026  
**Target Repository:** `C:\Users\HomePC\Downloads\VeilX-Agent`  

---

## 1. Executive Summary & Inventory Architecture

The VeilX application backend is built using Next.js 14 App Router Route Handlers located under `src/app/api/`.
- **Total Route Files:** 36 `route.ts` files
- **Total HTTP Method Handlers:** 50 distinct exported endpoint handlers (`GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS`)
- **Core Functional Domains:** 6 operational domains (AI Copilot & Trading, Authentication, NEAR Protocol & Escrow, Omnichain EVM, PayLinks & Swaps, Market Data & Social Webhooks)

---

## 2. Complete 50-Endpoint Method Inventory Table

| # | Route Path | Method | File Location | Line | Auth Requirement | Rate Limit | DB Models Accessed | Primary Purpose |
| :-: | :--- | :---: | :--- | :-: | :--- | :---: | :--- | :--- |
| **1** | `/api/agent/analyze` | `POST` | `src/app/api/agent/analyze/route.ts` | 6 | None (Public) | None | None | Technical market analysis (RSI, MA) |
| **2** | `/api/agent/cron-rebalance` | `GET` | `src/app/api/agent/cron-rebalance/route.ts` | 8 | `Bearer <CRON_SECRET>` | None | `Portfolio` | Autonomous portfolio rebalancing |
| **3** | `/api/auth/callback/twitter` | `GET` | `src/app/api/auth/callback/twitter/route.ts` | 12 | OAuth PKCE State Cookie | None | `User` | Twitter OAuth 2.0 PKCE code exchange |
| **4** | `/api/auth/me` | `GET` | `src/app/api/auth/me/route.ts` | 10 | `veilx_session` Cookie | None | `User` | Retrieves active authenticated session |
| **5** | `/api/auth/me` | `DELETE` | `src/app/api/auth/me/route.ts` | 56 | None (Clears Cookie) | None | None | Signs out and clears session cookie |
| **6** | `/api/auth/twitter` | `GET` | `src/app/api/auth/twitter/route.ts` | 9 | None (Public) | None | None | Initiates Twitter OAuth 2.0 PKCE |
| **7** | `/api/chat` | `POST` | `src/app/api/chat/route.ts` | 535 | None (Optional Key) | **None** | `Portfolio`, `PayLink` | Gemini 2.0 Flash / NEAR AI Copilot |
| **8** | `/api/chat/history` | `GET` | `src/app/api/chat/history/route.ts` | 5 | **None (IDOR)** | None | `ChatMessage` | Retrieves chat turns for a handle |
| **9** | `/api/chat/history` | `POST` | `src/app/api/chat/history/route.ts` | 45 | **None (Spoofable)** | None | `ChatMessage` | Appends a chat turn to database |
| **10** | `/api/chat/history` | `DELETE` | `src/app/api/chat/history/route.ts` | 105 | **None (Vulnerable)** | None | `ChatMessage` | Deletes all chat turns for handle |
| **11** | `/api/cron/evaluate-rules` | `GET` | `src/app/api/cron/evaluate-rules/route.ts` | 11 | **None** | None | `Portfolio` | Evaluates active trading rules (DCA) |
| **12** | `/api/evm/balance` | `GET` | `src/app/api/evm/balance/route.ts` | 164 | None (Public) | **None** | None | Scrapes 7 EVM testnets for MPC address |
| **13** | `/api/evm/broadcast-tx` | `POST` | `src/app/api/evm/broadcast-tx/route.ts` | 19 | `veilx_session` Cookie | None | None | Broadcasts MPC-signed raw EVM tx |
| **14** | `/api/evm/prepare-tx` | `POST` | `src/app/api/evm/prepare-tx/route.ts` | 52 | `veilx_session` Cookie | None | None | Encodes unsigned EIP-1559 tx |
| **15** | `/api/evm/send-mpc` | `POST` | `src/app/api/evm/send-mpc/route.ts` | 18 | `veilx_session` Cookie | None | `User` | NEAR MPC threshold sign + EVM send |
| **16** | `/api/intents` | `GET` | `src/app/api/intents/route.ts` | 79 | None (Public lookup) | None | `IntentOrder` | Queries 1Click intent order by ID |
| **17** | `/api/intents` | `POST` | `src/app/api/intents/route.ts` | 11 | None (Public order) | None | `IntentOrder` | Creates cross-chain 1Click swap order |
| **18** | `/api/intents` | `PATCH` | `src/app/api/intents/route.ts` | 128 | `veilx_session` Cookie | None | `IntentOrder` | Updates order hashes and status |
| **19** | `/api/near/account` | `GET` | `src/app/api/near/account/route.ts` | 8 | None (Public Proxy) | None | None | Fetches NEAR account balance & storage |
| **20** | `/api/near/chain-signatures/derive` | `GET` | `src/app/api/near/chain-signatures/derive/route.ts` | 8 | None (Pure Math) | None | None | Computes derived MPC EVM addresses |
| **21** | `/api/near/claim-subaccount` | `POST` | `src/app/api/near/claim-subaccount/route.ts` | 19 | `veilx_session` Cookie | None | `EscrowTip`, `Transaction` | Ephemeral subaccount stealth payout |
| **22** | `/api/near/faucet` | `POST` | `src/app/api/near/faucet/route.ts` | 12 | None (Public Faucet) | **IP & Account** | None | Disburses 0.25 testnet NEAR tokens |
| **23** | `/api/near/pending-tips` | `GET` | `src/app/api/near/pending-tips/route.ts` | 9 | None (Public) | None | `EscrowTip` | Returns unclaimed tips for handle |
| **24** | `/api/near/price` | `GET` | `src/app/api/near/price/route.ts` | 6 | None (Public) | None | None | Real-time NEAR USD oracle price |
| **25** | `/api/near/rpc` | `POST` | `src/app/api/near/rpc/route.ts` | 15 | None (Open Proxy) | **None** | None | CORS-free JSON-RPC proxy to NEAR |
| **26** | `/api/near/rpc` | `OPTIONS` | `src/app/api/near/rpc/route.ts` | 84 | None | None | None | Preflight CORS handler for RPC proxy |
| **27** | `/api/near/send-tip` | `POST` | `src/app/api/near/send-tip/route.ts` | 18 | Optional Session | None | `User`, `EscrowTip`, `Transaction` | Formulates social escrow tip |
| **28** | `/api/near/withdraw` | `POST` | `src/app/api/near/withdraw/route.ts` | 9 | Optional Session | None | `Transaction` | Verifies and logs on-chain withdrawal |
| **29** | `/api/paylinks` | `GET` | `src/app/api/paylinks/route.ts` | 10 | None (Public) | None | `PayLink` | Queries PayLink by slug or creator |
| **30** | `/api/paylinks` | `POST` | `src/app/api/paylinks/route.ts` | 47 | None (Public) | None | `PayLink` | Generates universal multichain invoice |
| **31** | `/api/paylinks` | `PATCH` | `src/app/api/paylinks/route.ts` | 105 | Session (Cancel only) | None | `PayLink`, `Transaction` | Settles or cancels PayLink invoice |
| **32** | `/api/portfolio` | `GET` | `src/app/api/portfolio/route.ts` | 9 | None (Public) | None | `Portfolio` | Queries portfolio holdings & rules |
| **33** | `/api/portfolio` | `POST` | `src/app/api/portfolio/route.ts` | 52 | `veilx_session` Cookie | None | `Portfolio` | Persists holdings, cash, and rules |
| **34** | `/api/price` | `GET` | `src/app/api/price/route.ts` | 6 | None (Public) | None | None | Single token/equity price quote |
| **35** | `/api/prices` | `GET` | `src/app/api/prices/route.ts` | 9 | None (Public) | None | None | Multi-asset quotes for terminal |
| **36** | `/api/proofs` | `GET` | `src/app/api/proofs/route.ts` | 68 | None (Public) | None | `DisclosureProof` | Verifies selective disclosure proof |
| **37** | `/api/proofs` | `POST` | `src/app/api/proofs/route.ts` | 15 | None (Public) | None | `DisclosureProof` | Generates selective disclosure proof |
| **38** | `/api/quotes` | `POST` | `src/app/api/quotes/route.ts` | 29 | None (Public) | None | None | Queries Defuse 1Click solver quote |
| **39** | `/api/quotes/status` | `GET` | `src/app/api/quotes/status/route.ts` | 5 | None (Public) | None | None | Live execution status of 1Click swap |
| **40** | `/api/reconcile` | `GET` | `src/app/api/reconcile/route.ts` | 12 | **None** | None | `EscrowTip`, `Transaction` | Checks on-chain tip settlement |
| **41** | `/api/reconcile` | `POST` | `src/app/api/reconcile/route.ts` | 16 | **None** | None | `EscrowTip`, `Transaction` | Manual trigger for reconciliation |
| **42** | `/api/relay/claim` | `POST` | `src/app/api/relay/claim/route.ts` | 18 | `veilx_session` Cookie | None | `EscrowTip`, `Transaction` | Gasless meta-transaction relayer claim |
| **43** | `/api/stocks/tokens` | `GET` | `src/app/api/stocks/tokens/route.ts` | 6 | None (Public) | None | None | Ondo tokenized US equities catalog |
| **44** | `/api/telegram/webhook` | `GET` | `src/app/api/telegram/webhook/route.ts` | 75 | None (Public) | None | None | Telegram webhook health check |
| **45** | `/api/telegram/webhook` | `POST` | `src/app/api/telegram/webhook/route.ts` | 25 | Secret Header (if set) | None | None | Inbound Telegram message dispatcher |
| **46** | `/api/transactions` | `GET` | `src/app/api/transactions/route.ts` | 7 | None (Public) | None | `Transaction` | Lists ledger transactions for handle |
| **47** | `/api/transactions` | `POST` | `src/app/api/transactions/route.ts` | 31 | `veilx_session` Cookie | None | `Transaction` | Records verified on-chain transaction |
| **48** | `/api/user` | `GET` | `src/app/api/user/route.ts` | 8 | None (Public) | None | `User` | User profile and vanity lookup |
| **49** | `/api/user` | `POST` | `src/app/api/user/route.ts` | 42 | **Flawed Session** | None | `User` | **Account takeover & session minting** |
| **50** | `/api/user/search` | `GET` | `src/app/api/user/search/route.ts` | 77 | None (Public) | None | `User` | Prefix search for ecosystem handles |

---

## 3. Route Domain Categorization & Security Profile

### Domain 1: AI Copilot & Autonomous Trading (7 Endpoints)
- Primary entry points: `/api/chat` (LLM proxy), `/api/chat/history` (Conversation CRUD), `/api/cron/evaluate-rules` (DCA engine), `/api/agent/cron-rebalance` (Autonomous trading), `/api/agent/analyze` (Technicals).
- **Security Assessment:** `/api/chat` has zero rate limiting, leaving the backend vulnerable to LLM API quota exhaustion. `/api/chat/history` has zero authorization checks across GET, POST, and DELETE, exposing all conversation turns to public scraping and tampering. `/api/cron/evaluate-rules` lacks authentication.

### Domain 2: Authentication & Identity Management (6 Endpoints)
- Routes: `/api/auth/twitter`, `/api/auth/callback/twitter`, `/api/auth/me` (GET/DELETE), `/api/user` (GET/POST), `/api/user/search`.
- **Security Assessment:** `/api/auth/callback/twitter` correctly uses PKCE with state verification and immutable `xUserId` binding. However, `POST /api/user` contains a critical logic flaw: if an unauthenticated attacker submits a request without a session cookie, the check is skipped, the target account's NEAR address is overwritten, and the server mints a valid session token for that handle.

### Domain 3: NEAR Protocol & Social Escrow (10 Endpoints)
- Routes: `/api/near/account`, `/api/near/rpc` (POST/OPTIONS), `/api/near/faucet`, `/api/near/send-tip`, `/api/near/pending-tips`, `/api/near/claim-subaccount`, `/api/relay/claim`, `/api/near/withdraw`, `/api/near/price`.
- **Security Assessment:** `/api/near/faucet` is the only route with sliding-window rate limiting. Critical state discrepancies exist: `POST /api/near/send-tip` creates tips with `status: "locked"` and misses `depositTxHash`, preventing them from ever being claimed via `/api/relay/claim` (which expects `status: "pending"`). `POST /api/near/claim-subaccount` crashes with a Mongoose `ValidationError` on `Transaction.create()`.

### Domain 4: Omnichain & Chain Signatures (EVM) (5 Endpoints)
- Routes: `/api/evm/balance`, `/api/near/chain-signatures/derive`, `/api/evm/prepare-tx`, `/api/evm/send-mpc`, `/api/evm/broadcast-tx`.
- **Security Assessment:** `/api/evm/balance` concurrently scrapes 7 EVM networks with zero rate limiting. In `/api/evm/send-mpc`, the derived EVM address is computed from the user subaccount, but the NEAR MPC contract call is signed by the relayer contract, creating a signer derivation mismatch.

### Domain 5: PayLinks, Intents & Swaps (8 Endpoints)
- Routes: `/api/paylinks` (GET/POST/PATCH), `/api/quotes`, `/api/quotes/status`, `/api/intents` (GET/POST/PATCH).
- **Security Assessment:** PayLink settlement enforces cryptographic verification of on-chain receipts via NEAR RPC before marking invoices settled. However, unauthenticated callers can create PayLinks claiming arbitrary creators.

### Domain 6: Market Data & Integrations (14 Endpoints)
- Routes: `/api/prices`, `/api/price`, `/api/stocks/tokens`, `/api/portfolio` (GET/POST), `/api/proofs` (GET/POST), `/api/reconcile` (GET/POST), `/api/telegram/webhook` (GET/POST), `/api/transactions` (GET/POST).
- **Security Assessment:** `GET /api/portfolio` and `GET /api/transactions` publicly leak private financial holdings and transaction history without requiring authentication. `/api/reconcile` can be triggered without secrets.
