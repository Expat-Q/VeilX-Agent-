# VEILX AGENT — PROPOSED TARGET SYSTEM ARCHITECTURE & INTEGRATION SPECIFICATION

**Document Version:** 1.0.0  
**Status:** COMPLETE ARCHITECTURAL SPECIFICATION  
**Author:** Senior Full-Stack Protocol Architect & Web3 Security Engineer  
**Date:** November 2026  

---

## 1. COMPREHENSIVE MULTI-LAYER ARCHITECTURE

The proposed target architecture organizes VeilX Agent into seven decoupled, resilient, and non-custodial tiers:

```mermaid
flowchart TD
    subgraph UI ["1. User Interaction Layer"]
        PWA["Next.js Responsive WebApp (Mobile & Desktop)"]
        TGBot["Telegram Copilot Bot & Mini App"]
        ChatUI["Conversational Financial Assistant"]
    end

    subgraph Identity ["2. Identity & Delegated Authorization Layer"]
        XAuth["𝕏 (Twitter) OAuth 2.0 PKCE Verified"]
        NEP366["NEP-366 Session Key Manager (Ed25519)"]
        CapGuard["Atomic Daily Spending Cap Enforcer"]
    end

    subgraph AI ["3. Confidential AI Reasoning Layer"]
        Router["Hybrid AI Intent Classifier Gateway"]
        Gemini["Google Gemini 2.5 Flash (UI Conversational Routing)"]
        NearAI["NEAR AI Cloud (Intel TDX / NVIDIA H100 TEE Enclave)"]
    end

    subgraph Privacy ["4. Cryptographic Privacy Layer"]
        AES["Client-Side AES-256-GCM Metadata Encryption"]
        Commitment["SHA-256 Recipient Commitment Hashes"]
        Stealth["Ephemeral Single-Use Subaccount Generator"]
    end

    subgraph Settlement ["5. Payment & Settlement Layer"]
        Escrow["Hardened VeilX Rust Escrow Contract (NEAR L1)"]
        Intents["NEAR Intents & Defuse Protocol (1Click Solver Matrix)"]
        ChainSig["NEAR Chain Signatures MPC (v1.signer)"]
    end

    subgraph Automation ["6. Decentralized Automation Layer"]
        OutLayer["OutLayer TEE Workers (Intel TDX WASI)"]
        YieldResume["NEAR Native yield_create / yield_resume Promises"]
    end

    subgraph Data ["7. Data & Ledger Infrastructure Layer"]
        NEAR_RPC["NEAR Pagoda / FastNEAR Redundant RPCs"]
        Mongo["MongoDB Atlas Multi-Model Store (Encrypted)"]
        ForeignRPC["Base & Solana Archive Nodes"]
    end

    UI --> Identity
    Identity --> AI
    AI --> Privacy
    Privacy --> Settlement
    Settlement <--> Automation
    Settlement --> Data
```

---

## 2. DETAILED LAYER SPECIFICATIONS & BOUNDARIES

### 2.1 Layer 1: User Interaction Layer
* **Progressive Web App (PWA)**: Built on Next.js 14 App Router, optimized across 9 mobile breakpoints (320px–1440px) with responsive header, omnichain portfolio balance drawer, and real-time execution cards.
* **Telegram Copilot**: Integrates deep-linking (`/link`), multi-turn memory via MongoDB `telegram_chats` (24h TTL), and a group-chat privacy shield suppressing confidential financial details in public channels.

### 2.2 Layer 2: Identity & Delegated Authorization Layer
* **Non-Custodial Guarantee**: Private keys are generated client-side in the user's browser. The server and relayer NEVER hold user master keys.
* **Delegated Authority (NEP-366)**: Users sign off-chain `DelegateAction` payloads authorizing specific `FunctionCall` methods (`deposit_near`, `withdraw`) capped by an atomic daily spending limit (default: $50.00/day).

### 2.3 Layer 3: Confidential AI Reasoning Layer
* **Hybrid Routing Engine**:
  * **Gemini 2.5 Flash**: Delivers instant 300ms latency for greetings, help commands, and conversational chit-chat.
  * **NEAR AI Cloud (`api.near.ai`)**: Evaluates all sensitive financial commands (`create_invoice`, `direct_transfer`, `execute_intent`) inside hardware-isolated Intel TDX/NVIDIA H100 TEE enclaves with zero prompt data retention.

### 2.4 Layer 4: Cryptographic Privacy Layer
* **Off-Chain Metadata Encryption**: Invoice descriptions, private notes, and counterparty communications are encrypted client-side using **AES-256-GCM** before reaching the database.
* **On-Chain Commitment Obfuscation**: Escrow smart contract records recipient commitments ($\text{Hash}(\text{handle} \parallel \text{salt})$) instead of raw Twitter usernames.
* **Ephemeral Claim Disbursements**: Payouts route to single-use, unlinked subaccounts or cross-chain destination addresses to sever the public social graph link.

### 2.5 Layer 5: Payment & Settlement Layer
* **Hardened VeilX Escrow**: Rust `near-sdk` 5.30 contract with atomic callbacks (`near_resolve_claim`), relayer override removals, and storage staking DoS protection (`prune_claimed_tip`).
* **NEAR Intents & Defuse (1Click)**: Declarative multi-chain liquidity. Market-making solvers front capital on Base, Arbitrum, Solana, and Ethereum, settled atomically on NEAR.
* **Chain Signatures MPC**: Uses `v1.signer-prod.testnet` to derive foreign addresses and sign cross-chain transactions without bridges.

### 2.6 Layer 6: Decentralized Automation Layer
* **OutLayer TEE Workers**: Decentralized workers running inside Intel TDX hardware enclaves that execute background settlement verification, escrow expiration checks, and automated refunds using NEAR's native asynchronous `yield/resume` promise mechanism.

### 2.7 Layer 7: Data & Ledger Infrastructure Layer
* **Redundant RPCs**: Automated client/server rotation across Pagoda, FastNEAR, and official NEAR testnet nodes.
* **MongoDB Atlas**: High-performance persistence layer with compound indexes on active querying vectors.

---

## 3. SEQUENCE WORKFLOWS

### 3.1 Standard NEAR Social Tip

```mermaid
sequenceDiagram
    autonumber
    actor User as Sender (Alice)
    participant UI as VeilX WebApp
    participant ClientKey as Browser Session Key
    participant Relayer as VeilX Relayer Backend
    participant Escrow as veilx-escrow.testnet
    participant DB as MongoDB Atlas

    User->>UI: Type "/tip @bob 1 NEAR"
    UI->>ClientKey: Construct FunctionCall(deposit_near)
    ClientKey->>ClientKey: Sign NEP-366 DelegateAction
    UI->>Relayer: POST /api/near/send-tip (SignedDelegateAction)
    Relayer->>DB: Atomic $inc Daily Spending ($spent + $4.29 <= $50)
    Relayer->>Escrow: Broadcast SignedDelegateAction (Relayer Pays Gas)
    Escrow->>Escrow: Create EscrowTip (status: Pending)
    Escrow-->>Relayer: Receipt Success (Tx Hash)
    Relayer->>DB: Record Transaction & EscrowTip
    Relayer-->>UI: Tip Confirmed
    UI->>User: Display Success Action Card with NEARBlocks Explorer Link
```

---

### 3.2 Cross-Chain Tip Using NEAR Intents (Defuse / 1Click)

```mermaid
sequenceDiagram
    autonumber
    actor User as Sender (Alice)
    participant Agent as VeilX AI Gateway
    participant OneClick as 1Click Swap API
    participant Solver as Market Maker (Solver)
    participant UserWallet as Alice's Wallet
    participant DestChain as Base Sepolia (EVM)
    actor Bob as Recipient (Bob)

    User->>Agent: "Send 10 USDC to @bob on Base"
    Agent->>OneClick: POST /v0/quote (NEAR In -> Base USDC Out to Bob's 0x)
    OneClick-->>Agent: Returns Quote (2.33 NEAR) + Single-Use Deposit Address
    Agent-->>User: Present 1-Click Intent Approval Card (60s countdown)
    User->>UserWallet: Approve & Transfer 2.33 NEAR to Deposit Address
    UserWallet->>OneClick: Deposit Confirmed on NEAR
    OneClick->>Solver: Broadcast Intent Deposit Verified
    Solver->>DestChain: Transfer 10.00 USDC to Bob's 0x Address
    DestChain-->>Solver: BaseScan Confirmation (Tx Hash)
    Solver->>OneClick: Submit Proof of Delivery
    OneClick-->>Agent: Status: SUCCESS (Base Tx Hash)
    Agent->>User: Display BaseScan Verified Link in Chat
    Bob-->>Bob: Receives 10 USDC directly on Base
```

---

### 3.3 Multi-Chain Invoice Creation & Checkout

```mermaid
sequenceDiagram
    autonumber
    actor Creator as Invoice Creator (Bob)
    participant UI as VeilX App
    participant DB as MongoDB Atlas
    actor Payer as Payer (Charlie)
    participant PayPage as /pay/[slug]
    participant Escrow as NEAR Escrow / 1Click
    participant RPC as NEAR RPC

    Creator->>UI: "Create invoice 50 USD for design review"
    UI->>DB: Create PayLink (slug, amountUsd: 50, status: active)
    UI-->>Creator: Returns PayLink URL (https://veilx.app/pay/inv_9831)
    Creator->>Payer: Sends PayLink URL
    Payer->>PayPage: Opens /pay/inv_9831
    PayPage->>Payer: Presents Payment Options (Native NEAR or Any Chain via Intents)
    Payer->>Escrow: Submits Payment (Native NEAR or Cross-Chain 1Click)
    Escrow-->>PayPage: Transaction Receipt Generated
    PayPage->>RPC: PATCH /api/paylinks (Verify Receipt on-chain)
    RPC-->>PayPage: FINAL Execution Status Confirmed
    PayPage->>DB: Update PayLink (status: settled, txHash)
    PayPage-->>Payer: Display Green Settlement Receipt
```

---

### 3.4 Proposed Cryptographic Private Payment (Level 2 + 3)

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Sender (Alice)
    participant Client as Alice's Browser
    participant Escrow as veilx-escrow.testnet
    actor Bob as Recipient (Bob)
    participant Factory as Ephemeral Subaccount Factory

    Alice->>Client: "Send 5 NEAR private tip to @bob"
    Client->>Client: Generate Secret Salt & Compute Commitment = Hash("@bob" || Salt)
    Client->>Client: Encrypt Salt using Bob's Public Key / Shared Secret
    Client->>Escrow: deposit_private_near(commitment, 5 NEAR)
    Note over Escrow: On-chain ledger records only Commitment Hash.<br/>Zero plaintext Twitter handles visible!
    Alice->>Bob: Transmits Encrypted Salt (via DM or Encrypted PayLink)
    Bob->>Factory: Request Ephemeral Claim Subaccount
    Factory-->>Bob: Provisioned claim-8931a.veilx-agent.testnet
    Bob->>Escrow: claim_private_tip(tip_id, handle: "@bob", salt, claim_account)
    Escrow->>Escrow: Verify Hash("@bob" || salt) == stored_commitment
    Escrow->>Factory: Transfer 5 NEAR to claim-8931a.veilx-agent.testnet
    Note over Bob: Funds received in fresh, unlinked account.<br/>Social graph completely severed from on-chain history!
```

---

### 3.5 Decentralized Automated Workflow with OutLayer

```mermaid
sequenceDiagram
    autonumber
    participant Escrow as VeilX Escrow Contract
    participant OutLayer as OutLayer Coordinator
    participant TEE as Intel TDX Enclave Worker
    actor Sender as Original Depositor

    Note over Escrow: Tip is Unclaimed for 30 Days
    Escrow->>Escrow: env::promise_yield_create("on_timeout_verified", tip_id)
    Escrow->>OutLayer: Yield Promise Created (Request Enclave Verification)
    OutLayer->>TEE: Execute WASI Binary inside Intel TDX
    TEE->>TEE: Verify Blockchain Timestamp > tip.created_at + 30 Days
    TEE->>TEE: Generate Intel Hardware Attestation Proof
    TEE->>Escrow: env::promise_yield_resume(yield_token, proof, is_expired: true)
    Escrow->>Escrow: Verify Hardware Attestation
    Escrow->>Sender: Auto-Refund Escrowed Funds to Original Depositor
    Note over Escrow: 100% Autonomous. Zero Centralized Backend Required!
```

---

## 4. FAILURE MODES & RECOVERY ARCHITECTURE

| Subsystem | Potential Failure Mode | System Impact | Automated Recovery Path |
|---|---|---|---|
| **1Click Intent Solvers** | Solver fails to fulfill within 60s expiration window. | Destination funds not delivered; source deposit locked. | 1Click contract automatically triggers reverse transfer to user's `refundAddress`. StatusRadar displays refund status. |
| **NEAR AI Cloud Gateway** | TEE enclave cold start or network latency spike (>2s). | Financial tool parsing delayed. | Automatic circuit-breaker fallbacks to local deterministic regex engine or Google Gemini with user warning. |
| **NEP-366 Gas Relayer** | Relayer account runs out of gas or server process drops. | Users unable to submit gasless transactions. | Client-side fallback prompts user: *"Relayer subsidy unavailable. Would you like to sign directly using your NEAR wallet?"* |
| **NEAR RPC Outage** | Pagoda testnet node experiences rate limits or preflight failure. | Browser queries fail with CORS/preflight errors. | Server-side proxy ([`/api/near/account`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/app/api/near/account/route.ts)) automatically cascades across secondary FastNEAR and primary NEAR testnet endpoints. |
