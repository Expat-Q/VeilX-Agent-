# VEILX AGENT — TESTNET VS MAINNET READINESS MATRIX & ENVIRONMENT INVENTORY

**System:** VeilX Agent (`VeilX-Agent` / `XTip`)  
**Audit Baseline:** `VEILX_BLOCKCHAIN_WEB3_TRANSACTION_AUDIT.md`  
**Document Version:** 1.0.0  
**Status:** ARCHITECTURAL SPECIFICATION & ENVIRONMENT INVENTORY  

---

## 1. COMPREHENSIVE FEATURE READINESS MATRIX

This matrix provides an exhaustive, feature-by-feature evaluation of VeilX Agent's capabilities across both **NEAR Testnet / Base Sepolia** and **NEAR Mainnet / Base Mainnet**.

### Status Classification Key:
* **FULLY IMPLEMENTED AND VERIFIED:** Verified end-to-end with real on-chain transaction hashes.
* **IMPLEMENTED BUT NOT VERIFIED:** Code exists, but unverified due to missing credentials, rate limits, or liquidity.
* **PARTIALLY IMPLEMENTED:** Partial execution path exists, but downstream confirmation or UI is missing.
* **BROKEN:** Code exists but crashes or reverts due to identified bugs (e.g. fee cap crash, signer mismatch).
* **MOCKED:** Completely simulated via `localStorage` or hardcoded responses with zero on-chain broadcast.
* **UNAVAILABLE ON THIS NETWORK:** The underlying protocol (e.g. 1Click Solvers) does not operate on this network.
* **UNSUPPORTED BY PROVIDER:** The external vendor/solver does not support this token or chain pair.
* **BLOCKED BY CONFIGURATION:** Missing production keys, contract addresses, or RPC endpoints.
* **BLOCKED BY PRODUCT DECISION:** Requires user decision on architecture (e.g., direct vs escrow tips).
* **DISABLED FOR SAFETY:** Intentionally disabled until audit remediation passes.

---

### Master Feature Readiness Inventory

| Feature | Protocol / Layer | Testnet Status | Mainnet Status | Actual Execution Route | Wallet Requirement | Asset Requirement | Known Blockers |
|---|---|---|---|---|---|---|---|
| **Wallet Connection (Embedded)** | NEAR Protocol | **FULLY IMPLEMENTED AND VERIFIED** | **IMPLEMENTED BUT NOT VERIFIED** | Local Ed25519 keypair in `localStorage` | Browser session key | None | Key stored in plaintext; vulnerable to XSS |
| **External Wallet Signing** | Meteor / Sender | **BROKEN** | **BROKEN** | Injected browser wallet extensions | Browser extension wallet | Connected wallet balance | `near-wallet-connector.ts` connected to UI modal, but bypassed by `ChatContainer.tsx` |
| **NEAR Account Operations** | NEAR Protocol | **FULLY IMPLEMENTED AND VERIFIED** | **IMPLEMENTED BUT NOT VERIFIED** | JSON-RPC `query` (`view_account`, `view_access_key_list`) | Read-only RPC | None | Public RPC rate limits (429) |
| **NEAR Native Transfers** | NEAR Protocol | **FULLY IMPLEMENTED AND VERIFIED** | **IMPLEMENTED BUT NOT VERIFIED** | `account.transfer()` via `near-client-signer.ts` | Browser session key | Native NEAR | Subaccount must have session key registered via `AddKey` |
| **NEAR Token Transfers (NEP-141)** | NEAR Protocol | **PARTIALLY IMPLEMENTED** | **PARTIALLY IMPLEMENTED** | `ft_transfer_call()` on NEP-141 contract | Browser session key | NEP-141 tokens (wNEAR, USDC) | Storage deposit registration required prior to transfer |
| **Social Tipping (Instant Direct)** | NEAR Protocol | **FULLY IMPLEMENTED AND VERIFIED** | **IMPLEMENTED BUT NOT VERIFIED** | Direct native transfer to `recipient.veilx-agent.testnet` | Browser session key | Native NEAR | Misreported as "locked in escrow" in database |
| **Escrow Deposits (Native NEAR)** | NEAR Protocol | **BROKEN** | **BLOCKED BY CONFIGURATION** | `deposit_near_tip` on `veilx-agent.testnet` | Browser session key | Native NEAR (min 0.01 NEAR) | Frontend currently calls direct transfer instead of contract method |
| **Escrow Claims (Gasless)** | NEAR Protocol | **BROKEN** | **BLOCKED BY CONFIGURATION** | `claim_tip` via `/api/relay/claim` (Relayer sponsored) | Relayer `ESCROW_PRIVATE_KEY` | Relayer gas (~30 Tgas) | Reverts with `"Tip not found"` because tips bypassed contract |
| **Escrow Refunds** | NEAR Protocol | **PARTIALLY IMPLEMENTED** | **BLOCKED BY CONFIGURATION** | `refund_tip` on smart contract after 7 days | Sender or Relayer | Gas | Relayer refund endpoint missing cron worker |
| **PayLink Creation** | NEAR / Next.js | **FULLY IMPLEMENTED AND VERIFIED** | **FULLY IMPLEMENTED AND VERIFIED** | MongoDB persistence + AES-256-GCM memo encryption | Authenticated session | None | Unauthenticated POST route needs session token enforcement |
| **PayLink Payments & Invoicing** | NEAR Protocol | **BROKEN** | **BROKEN** | Payer transfers to invoice recipient; verified via RPC | Payer wallet | Native NEAR / USDC | RPC verification queries recipient instead of payer; fails check |
| **Withdrawals to External Wallet** | NEAR Protocol | **BROKEN** | **BROKEN** | Native transfer to external address; verified via RPC | Browser session key | Native NEAR | Passes recipient to RPC query; legacy plaintext key fallback in API |
| **Gasless Relayer Operations** | NEAR Protocol | **PARTIALLY IMPLEMENTED** | **BLOCKED BY CONFIGURATION** | Server calls contract methods using `ESCROW_PRIVATE_KEY` | Server keypair | Server NEAR balance | Single relayer account bottleneck; key exhausted risk |
| **Testnet Faucet Dispense** | NEAR Protocol | **FULLY IMPLEMENTED AND VERIFIED** | **UNAVAILABLE ON THIS NETWORK** | Transmits 0.25 NEAR from `veilx-agent.testnet` | Relayer key | Testnet NEAR | Mainnet has no free faucet by design |
| **MPC EVM Address Derivation** | NEAR Chain Signatures | **FULLY IMPLEMENTED AND VERIFIED** | **IMPLEMENTED BUT NOT VERIFIED** | Derives Secp256k1 EVM address via `v1.signer-prod.testnet` | NEAR Account ID | None | Address derived deterministically; unverified on Mainnet MPC |
| **EVM Native Transfers (ETH)** | Base Sepolia / Base Mainnet | **BROKEN** | **BROKEN** | Constructs EIP-1559 tx; signs via NEAR MPC; broadcasts to Base RPC | Derived EVM / Relayer | ETH for gas + transfer amount | `viem` crashes on hardcoded priority fee (`1 gwei > maxFeePerGas`) |
| **EVM ERC-20 Transfers (USDC)** | Base Sepolia / Base Mainnet | **BROKEN** | **BROKEN** | Encodes ERC-20 `transfer(to, amount)`; signs via NEAR MPC | Derived EVM / Relayer | Base ETH (gas) + Base USDC | Missing explicit `gas` limit; fee cap serialization crash |
| **Cross-Chain Quotes (1Click)** | Defuse Protocol | **SIMULATED (FOR TESTNET DEMO)** | **IMPLEMENTED BUT NOT VERIFIED** | `POST https://1click.chaindefuser.com/v0/quote` | None (Public API) | None | Solvers operate on Mainnet; Testnet mode simulates quotes for demo with explicit warning badge |
| **Cross-Chain Single-Use Deposit** | Defuse Protocol | **SIMULATED (FOR TESTNET DEMO)** | **IMPLEMENTED BUT NOT VERIFIED** | Solvers generate deposit address for origin asset | Sender wallet | Origin asset (e.g. NEAR, SOL, BTC) | Testnet mode simulates deposit flow with clear testnet badge |
| **Cross-Chain Settlement Tracking** | Defuse Protocol | **SIMULATED (FOR TESTNET DEMO)** | **BROKEN** | `GET https://1click.chaindefuser.com/v0/status?depositAddress=...` | None | None | Application currently fabricates destination hash; Mainnet requires async polling |
| **Tokenized Equity Trading (TSLAon, NVDAon)** | Ondo / NEAR Intents | **MOCKED (TESTNET DEMO)** | **REGULATION S GATED (MAINNET)** | Testnet: Local Paper Sandbox; Mainnet: Eligible non-U.S. users route via compliant NEAR Intents; U.S./unverified users stay in Paper Sandbox | Active Session / Wallet | USDC / Crypto | Regulation S restricts U.S. and Canadian persons; requires IP geofencing on Mainnet; Testnet operates as Paper Sandbox |
| **DCA Execution (Automated)** | Autonomous Agent | **MOCKED** | **MOCKED** | Cron endpoint `/api/agent/cron-rebalance` updates DB | Server session | Capital | No on-chain smart contract for automated recurring execution |
| **Portfolio Rebalancing** | Autonomous Agent | **MOCKED** | **MOCKED** | Simulated trades in `trading-copilot.ts` | Server session | Capital | Fully simulated portfolio updates |
| **Transaction History Store** | MongoDB & LocalStorage | **FULLY IMPLEMENTED AND VERIFIED** | **FULLY IMPLEMENTED AND VERIFIED** | Dual-write client `localStorage` + MongoDB `Transaction` | Active session | None | Collapses distinct on-chain states into premature "completed" |
| **On-Chain Reconciliation** | Worker Route | **BROKEN** | **BROKEN** | `/api/reconcile` queries smart contract `get_tip` | Relayer key | RPC gas | Always returns 0 matches because tips bypass contract |

---

## 2. ENVIRONMENT-SPECIFIC CONFIGURATION INVENTORY

This table defines every environment configuration parameter required to run VeilX Agent in Testnet vs. Mainnet without cross-environment pollution.

| Configuration Variable | Purpose | Testnet Target | Mainnet Target | Validation Method | Risk Assessment |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | Global environment flag | `"testnet"` | `"mainnet"` | Build-time validation | Critical: Determines network defaults and UI badges |
| `NEXT_PUBLIC_NEAR_NETWORK_ID` | NEAR Network Identifier | `"testnet"` | `"mainnet"` | `nearAPI.connect()` config check | High: Prevents connecting testnet keys to mainnet RPC |
| `NEXT_PUBLIC_NEAR_NODE_URL` | NEAR Primary RPC Endpoint | `https://rpc.testnet.near.org` | `https://rpc.mainnet.near.org` | Query `status` endpoint on boot | High: RPC rate-limiting causes UI timeouts |
| `NEXT_PUBLIC_NEAR_ARCHIVAL_URL` | Archival RPC for Tx Verification | `https://archival-rpc.testnet.near.org` | `https://archival-rpc.mainnet.near.org` | Query block header | Medium: Needed to verify transactions older than 5 epochs |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID` | VeilX Escrow Smart Contract | `veilx-agent.testnet` | `veilx-agent.near` (Pending deployment) | Call `get_tip` view method | Critical: Wrong address loses all deposited funds |
| `ESCROW_PRIVATE_KEY` | Server Relayer Master Signing Key | Secure Env (Testnet Ed25519 key) | Secure Vault / KMS (Mainnet Ed25519 key) | Verify public key matches contract owner | Critical: Relayer key compromise allows draining tips & faucet |
| `NEXT_PUBLIC_MPC_CONTRACT_ID` | NEAR Chain Signatures Contract | `v1.signer-prod.testnet` | `v1.signer` | Call `public_key` view method | High: Derives EVM addresses; mismatched contract changes address |
| `NEXT_PUBLIC_BASE_RPC_URL` | Base Layer 2 RPC Provider | `https://sepolia.base.org` | `https://mainnet.base.org` | Query `eth_chainId` (84532 vs 8453) | High: Incorrect chain ID causes signature rejection |
| `NEXT_PUBLIC_BASE_CHAIN_ID` | Base EVM Numeric Chain ID | `84532` (Base Sepolia) | `8453` (Base Mainnet) | Compare with RPC `eth_chainId` | Critical: EIP-155 replay protection rejects wrong chain ID |
| `NEXT_PUBLIC_USDC_CONTRACT_BASE` | USDC Token Address on Base | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Verify ERC-20 `symbol()` == "USDC" | Critical: Wrong token address transfers wrong asset or reverts |
| `NEXT_PUBLIC_ONECLICK_BASE` | Defuse 1Click API Gateway | `https://1click.chaindefuser.com` | `https://1click.chaindefuser.com` | Ping `/v0/tokens` | Medium: Single endpoint handles mainnet routing; no testnet support |
| `SESSION_SECRET` | HMAC Secret for Session Cookies | Secure 64-char hex string | Secure 64-char hex string | Assert length >= 32 and != default fallback | Critical: Default fallback allows session spoofing |
| `MONGODB_URI` | Application Database URI | Testnet DB Cluster | Mainnet DB Cluster | Ping MongoDB connection | High: Sharing DB between testnet/mainnet causes balance confusion |

---

## 3. IDENTIFIED PROTOCOL & ROUTE AVAILABILITY CONFLICTS

### 1. Defuse Protocol 1Click Omnichain Solvers (NEAR Intents)
* **Mainnet Availability:** **FULL**. Defuse operates solvers for Bitcoin, Solana, Ethereum, Base, Arbitrum, Dogecoin, and NEAR Mainnet. Real quotes and execution tracking exist.
* **Testnet Availability:** **UNAVAILABLE**. Defuse operates exclusively on Mainnet liquidity. Testnet tokens (e.g. Testnet NEAR, Base Sepolia USDC) have no solver market makers.
* **Current App Behavior:** When a user executes a cross-chain swap on Testnet, the app falls back to hardcoded exchange rates, pretends a solver provided a deposit address, and instantly marks it "Settled" using the source deposit hash.
* **Required Resolution:** 
  * Explicitly disable 1Click Omnichain Swaps in the Testnet environment with a clear UI badge: `"Cross-Chain Solvers operate exclusively on Mainnet"`.
  * Offer genuine 1Click swaps exclusively under an explicit **Mainnet Transaction Mode** with real assets and fee disclosures.

### 2. Tokenized US Equities (Ondo Finance / NEAR Intents: TSLAon, NVDAon, AAPLon)
* **What They Are:** Ondo Finance issues total return tracker digital assets on-chain mirroring real U.S. equities (`NVDAon`, `TSLAon`, `AAPLon`, `SPYon`, `QQQon`). They are integrated into the NEAR ecosystem via **NEAR Intents** and `near.com`.
* **Regulatory Structure & Legal Restrictions:**
  * Offered under **Regulation S of the U.S. Securities Act** (issued by Ondo Global Markets BVI).
  * **Strictly Prohibited:** U.S. persons, U.S. residents, Canadian residents, and sanctioned jurisdictions.
  * **Eligible Access:** Non-U.S. persons in supported global jurisdictions can legally swap into these tokens using crypto assets (USDC, NEAR, BTC) via compliant NEAR Intents solvers.
* **Why the Current App Was Mocked:**
  * Zero testnet liquidity exists for Ondo stock tokens on NEAR Testnet.
  * The current VeilX codebase lacks the IP geofencing and compliance-gated endpoint required to route Regulation S securities.
  * As a result, the existing terminal modified client `localStorage` and simulated trades without broadcasting to any network.
* **Required Dual-Track Resolution:**
  * **Testnet Mode:** The Stock Terminal operates explicitly as an **AI Copilot & Paper Trading Sandbox**. Users can test trading prompts, test AI copilot strategies, and simulate DCA rules with zero financial risk.
  * **Mainnet Mode:** Implement an automated IP/geofence check:
    * *Eligible Non-U.S. Users:* Connect to the compliant NEAR Intents route to execute real swaps into Ondo equity tokens.
    * *U.S. / Ineligible / Unverified Users:* Gracefully fall back to the Paper Trading Sandbox with a clear disclosure explaining Regulation S restrictions, protecting VeilX from legal liability.

### 3. Gasless Escrow Relayer
* **Testnet Availability:** **FULL**. Can be sponsored via `veilx-agent.testnet` using free testnet NEAR.
* **Mainnet Availability:** **FINANCIAL RISK**. Sponsoring every social tip claim on Mainnet requires real NEAR. Without platform fee deduction or a gas treasury, the relayer wallet will quickly drain.
* **Required Resolution:** On Mainnet, require either:
  * A small platform fee deducted from the claimed tip (e.g. $0.05\text{ NEAR}$), OR
  * The recipient pays their own transaction gas directly using their connected wallet.

---

*Matrix compiled for engineering sign-off and environment isolation.*
