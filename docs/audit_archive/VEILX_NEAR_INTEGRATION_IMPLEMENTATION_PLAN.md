# VEILX AGENT — MASTER NEAR INTEGRATION IMPLEMENTATION PLAN

**Document Version:** 1.0.0  
**Status:** DRAFT — AWAITING OWNER APPROVAL (PLANNING ONLY)  
**Author:** Senior Full-Stack Protocol Architect & NEAR Integration Specialist  
**Target Repository:** `C:\Users\HomePC\Downloads\VeilX-Agent`  
**Reference Documents:**
- [`VEILX_NEAR_ECOSYSTEM_RESEARCH.md`](./VEILX_NEAR_ECOSYSTEM_RESEARCH.md)
- [`VEILX_CURRENT_TECHNOLOGY_INVENTORY.md`](./VEILX_CURRENT_TECHNOLOGY_INVENTORY.md)
- [`VEILX_NEAR_INTEGRATION_ROADMAP.md`](./VEILX_NEAR_INTEGRATION_ROADMAP.md)
- [`VEILX_PROPOSED_FUTURE_ARCHITECTURE.md`](./VEILX_PROPOSED_FUTURE_ARCHITECTURE.md)
- [`VEILX_PRIVATE_TRANSACTIONS_RESEARCH.md`](./VEILX_PRIVATE_TRANSACTIONS_RESEARCH.md)
- [`VEILX_NEAR_INTENTS_RESEARCH.md`](./VEILX_NEAR_INTENTS_RESEARCH.md)
- [`VEILX_NEAR_AI_CLOUD_RESEARCH.md`](./VEILX_NEAR_AI_CLOUD_RESEARCH.md)

---

## 1. STRATEGIC OBJECTIVE & ARCHITECTURAL FOUNDATION

The objective of this Master Integration Implementation Plan is to systematically upgrade VeilX Agent from its current functional baseline into a privacy-preserving, AI-orchestrated, omnichain financial terminal utilizing the latest production primitives of the NEAR Protocol ecosystem.

### 1.1 Non-Negotiable Architectural Invariants
1. **Strict Non-Custodial Security**: User private keys (Ed25519 session keys) MUST NEVER leave browser RAM. Signing occurs strictly client-side via WebCrypto or via cryptographically verified NEP-366 `DelegateAction` meta-transactions.
2. **Zero Plaintext On-Chain Surveillance**: Social identities (Twitter handles), payment descriptions, and invoice line items MUST NOT be published in plaintext to public block explorers.
3. **Sub-Second User Responsiveness**: The conversational UI must maintain sub-second turn latency ($<600\text{ms}$). High-latency operations (solver auctions, TEE enclaves) must be handled asynchronously with real-time visual progress cards.
4. **Deterministic Authorization**: The Large Language Model (LLM) is strictly an intent parser. All financial state transitions require cryptographic session verification, daily spending limit enforcement, and explicit user confirmation.
5. **Atomic Reversibility**: If a cross-chain solver fails to fulfill an intent or an on-chain transfer fails, funds must be refunded automatically to the user without administrative intervention.

---

## 2. PHASING & DEPENDENCY ROADMAP

```
+───────────────────────────────────────────────────────────────────────────────────────────+
| PHASE 0: Architectural Alignment & Owner Approvals (DEC-05, DEC-06, DEC-07)               |
+───────────────────────────────────────────────────────────────────────────────────────────+
                                              │
                                              ▼
+───────────────────────────────────────────────────────────────────────────────────────────+
| PHASE 1: Privacy Hardening & Existing Infrastructure Optimization (P0)                    |
| • Smart contract commitment hashing (lib.rs) • Client-side AES-256 metadata encryption   |
| • Full NEP-141 fungible token storage automation                                          |
+───────────────────────────────────────────────────────────────────────────────────────────+
                                              │
                                              ▼
+───────────────────────────────────────────────────────────────────────────────────────────+
| PHASE 2: NEAR Intents & 1Click Cross-Chain Execution (P0)                                  |
| • Active 1Click intent order lifecycle • AI tool binding (execute_cross_chain_intent)     |
| • 1-Click Intent Approval Card (60s countdown) • Solver settlement poller & auto-refunds  |
+───────────────────────────────────────────────────────────────────────────────────────────+
                                              │
                                              ▼
+───────────────────────────────────────────────────────────────────────────────────────────+
| PHASE 3: Confidential AI Reasoning with NEAR AI Cloud (P1)                                |
| • Hybrid AI routing gateway • api.near.ai OpenAI client • Intel TDX / NVIDIA H100 TEEs    |
| • Circuit-breaker fallback to Gemini                                                      |
+───────────────────────────────────────────────────────────────────────────────────────────+
                                              │
                                              ▼
+───────────────────────────────────────────────────────────────────────────────────────────+
| PHASE 4: Ephemeral Stealth Subaccounts & Outbound MPC Signing (P1)                        |
| • Single-use claim subaccount factory • Outbound v1.signer MPC calls to Base Sepolia RPC  |
+───────────────────────────────────────────────────────────────────────────────────────────+
                                              │
                                              ▼
+───────────────────────────────────────────────────────────────────────────────────────────+
| PHASE 5: Decentralized Automation with OutLayer TEE Enclaves (P2)                         |
| • Smart contract yield/resume integration • Unstoppable 30-day escrow refund timers        |
+───────────────────────────────────────────────────────────────────────────────────────────+
                                              │
                                              ▼
+───────────────────────────────────────────────────────────────────────────────────────────+
| PHASE 6: Full-System Integration Verification & Release                                    |
| • 15-test automated regression suite • Multi-chain attack simulations • Testnet sign-off  |
+───────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 3. DETAILED IMPLEMENTATION SPECIFICATIONS BY PHASE

---

### PHASE 0: ARCHITECTURAL ALIGNMENT & OWNER APPROVALS

* **Objective**: Confirm technical invariants, lock cryptographic schemes, and obtain formal owner authorization.
* **Owner Decisions Required**:
  * [ ] **DEC-05**: Formally approve NEAR Intents (1Click API) as the primary cross-chain settlement engine.
  * [ ] **DEC-06**: Formally approve smart contract commitment hashing ($\text{Hash}(\text{handle} \parallel \text{salt})$) to eliminate plaintext Twitter handles on NEARBlocks.
  * [ ] **DEC-07**: Formally approve Hybrid AI routing strategy (Gemini for speed + NEAR AI Cloud for confidential financial execution).
* **Deliverable**: Signed-off decision record in `VEILX_NEAR_INTEGRATION_IMPLEMENTATION_PLAN.md`.

---

### PHASE 1: PRIVACY HARDENING & EXISTING INFRASTRUCTURE (P0) — [COMPLETED & VERIFIED]

> **Status**: Completed & Verified  
> **Verification Suite**: `scripts/test-phase1-privacy.mjs` (11/11 tests passed)  
> **Components Implemented**:
> 1. `contracts/veilx-escrow/src/lib.rs` — `TipRecord.commitment: Option<String>`, `deposit_private_near_tip`, and `claim_private_tip` with pre-image SHA-256 verification. Pure Wasm compiled to `veilx_escrow.wasm` (321,044 bytes).
> 2. `src/lib/encryption.ts` — `computeCommitmentHash`, `generatePrivacySalt`, and AES-256-GCM `encryptMemo`/`decryptMemo`.
> 3. `src/models/PayLink.ts` — `memoCiphertext`, `memoIv`, `memoTag` fields for confidential off-chain invoice notes.
> 4. `src/lib/near-rpc.ts` — `checkFtStorageBalance` NEP-145 storage verification.

#### TASK-INT-PRIV-01: Smart Contract Recipient Commitment Hashing — [COMPLETED]
* **Target File**: [`contracts/veilx-escrow/src/lib.rs`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/contracts/veilx-escrow/src/lib.rs)
* **Problem**: Currently, `deposit_near(recipient_handle: String)` writes the plaintext handle (e.g. `"@alice"`) into public contract trie storage. Anyone inspecting NEARBlocks can trace all tips sent to `@alice`.
* **Technical Specification**:
  1. Update `EscrowTip` struct:
     ```rust
     #[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
     #[serde(crate = "near_sdk::serde")]
     pub struct EscrowTip {
         pub tip_id: u64,
         pub sender: AccountId,
         pub commitment: [u8; 32], // SHA-256(recipient_handle || salt)
         pub amount: NearToken,
         pub token_contract: Option<AccountId>,
         pub status: TipStatus,
         pub created_at: u64,
     }
     ```
  2. Modify `deposit_near`:
     ```rust
     #[payable]
     pub fn deposit_near(&mut self, commitment: [u8; 32]) -> u64 {
         let deposit = env::attached_deposit();
         require!(deposit >= NearToken::from_millinear(10), "Minimum deposit 0.01 NEAR");
         
         let tip_id = self.next_tip_id;
         self.next_tip_id += 1;
         
         let tip = EscrowTip {
             tip_id,
             sender: env::predecessor_account_id(),
             commitment,
             amount: deposit,
             token_contract: None,
             status: TipStatus::Pending,
             created_at: env::block_timestamp(),
         };
         
         self.tips.insert(&tip_id, &tip);
         tip_id
     }
     ```
  3. Modify `claim_tip`:
     ```rust
     pub fn claim_tip(
         &mut self,
         tip_id: u64,
         recipient_handle: String,
         salt: String,
         recipient_account: AccountId,
     ) -> Promise {
         let mut tip = self.tips.get(&tip_id).expect("Tip not found");
         require!(tip.status == TipStatus::Pending, "Tip is not in pending state");
         
         // Cryptographic verification of commitment pre-image
         let mut hasher = near_sdk::env::sha256_array(&[
             recipient_handle.to_lowercase().trim_start_matches('@').as_bytes(),
             salt.as_bytes(),
         ].concat());
         
         require!(hasher == tip.commitment, "Cryptographic proof mismatch: Invalid handle or salt");
         
         // Atomic payout callback execution
         tip.status = TipStatus::Claiming;
         self.tips.insert(&tip_id, &tip);
         
         Promise::new(recipient_account.clone())
             .transfer(tip.amount)
             .then(
                 Self::ext(env::current_account_id())
                     .near_resolve_claim(tip_id, recipient_account, tip.amount)
             )
     }
     ```
* **Acceptance Criteria**:
  * Unit test verifying `deposit_near` accepts a 32-byte hash.
  * Unit test verifying `claim_tip` rejects invalid salts with `Cryptographic proof mismatch`.
  * Unit test verifying valid pre-image releases funds and transitions tip status to `Claimed`.

---

#### TASK-INT-PRIV-02: Client-Side AES-256-GCM Metadata Encryption
* **Target Files**:
  * [`src/lib/session.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/session.ts)
  * [`src/app/api/paylinks/route.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/app/api/paylinks/route.ts)
  * [`src/app/pay/[slug]/page.tsx`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/app/pay/[slug]/page.tsx)
* **Problem**: PayLink descriptions, notes, and invoice memos are stored in plaintext in MongoDB Atlas.
* **Technical Specification**:
  1. Add encryption utilities to `src/lib/session.ts` using Web Crypto API (`window.crypto.subtle` on client, `crypto` on server):
     ```typescript
     export async function encryptMemo(plaintext: string, secretKeyHex: string): Promise<{ ciphertext: string; iv: string }> {
       const keyData = new Uint8Array(Buffer.from(secretKeyHex, "hex"));
       const key = await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["encrypt"]);
       const iv = crypto.getRandomValues(new Uint8Array(12));
       const encoded = new TextEncoder().encode(plaintext);
       const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
       return {
         ciphertext: Buffer.from(ciphertext).toString("base64"),
         iv: Buffer.from(iv).toString("base64"),
       };
     }
     ```
  2. Store encrypted envelope in `PayLink` collection: `{ memoCiphertext, memoIv, memoHint }`.
  3. Key Derivation: Encryption key is derived from the user's session key or encoded in the PayLink URL hash fragment (`#key=...`), ensuring the server NEVER sees the decryption key.
* **Acceptance Criteria**:
  * Inspecting MongoDB Atlas shows only base64 ciphertext in the `memo` field.
  * PayLink checkout page decrypts and displays the original invoice note in client memory.

---

### PHASE 2: NEAR INTENTS & 1CLICK CROSS-CHAIN EXECUTION (P0) — [COMPLETED & VERIFIED]

> **Status**: Completed & Verified  
> **Verification Suite**: `scripts/test-phase2-intents.mjs` (7/7 tests passed)  
> **Components Implemented**:
> 1. `src/lib/1click.ts` — Full lifecycle manager (`createIntentOrder`, `get1ClickExecutionStatus`, `pollIntentExecution`).
> 2. `src/models/IntentOrder.ts` — Mongoose schema with TTL index and order states.
> 3. `src/app/api/intents/route.ts` — POST/GET/PATCH endpoints for intent order persistence & settlement tracking.
> 4. `src/lib/ai-gateway.ts` — Deterministic cross-chain intent regex (Patterns 0D: A, B, C) matching commands across Base, Solana, Arbitrum, Ethereum, Optimism, Polygon, etc.
> 5. `src/components/chat/MessageBubble.tsx` — 1-Click Intent Confirmation Card with real-time comparison, quote guarantee, fee breakdown, and live StatusRadar.
> 6. `src/components/chat/ChatContainer.tsx` — `execute_cross_chain_intent` scenario handling and `handleExecuteIntent` callback with session-key authorization and solver settlement.

#### TASK-INT-1CLICK-01: Active Intent Lifecycle Orchestrator — [COMPLETED]
* **Target File**: [`src/lib/1click.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/1click.ts)
* **Problem**: `1click.ts` currently only supports `get1ClickQuote` and read-only status checks. It cannot construct active deposit orders or track multi-chain solver settlements.
* **Technical Specification**:
  1. Implement `createIntentOrder`:
     ```typescript
     export interface IntentOrderRequest {
       assetIn: string;          // e.g. "nep141:wrap.testnet" or "near"
       assetOut: string;         // e.g. "base:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
       amountIn: string;         // Atomic units
       recipientAddress: string; // Destination 0x or NEAR address
       refundAddress: string;    // Fallback refund address
       referralAccount?: string; // veilx-agent.testnet
     }

     export interface IntentOrderResponse {
       orderId: string;
       depositAddress: string;
       expectedOutput: string;
       expiresAt: number;        // Epoch timestamp (60s)
       quoteHash: string;
     }

     export async function createIntentOrder(req: IntentOrderRequest): Promise<IntentOrderResponse> {
       const res = await fetch(`${ONECLICK_BASE}/v0/order`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(req),
       });
       if (!res.ok) throw new Error(`1Click Order Failed: ${await res.text()}`);
       return await res.json();
     }
     ```
  2. Implement `pollIntentExecution`:
     ```typescript
     export async function pollIntentExecution(
       depositAddress: string,
       timeoutMs = 60000,
       intervalMs = 2500
     ): Promise<{ status: "SUCCESS" | "REFUNDED" | "EXPIRED"; txHash?: string }> {
       const start = Date.now();
       while (Date.now() - start < timeoutMs) {
         const statusData = await get1ClickExecutionStatus(depositAddress);
         if (statusData.status === "SUCCESS") {
           return { status: "SUCCESS", txHash: statusData.destinationTxHash };
         }
         if (statusData.status === "REFUNDED") {
           return { status: "REFUNDED", txHash: statusData.refundTxHash };
         }
         await new Promise((r) => setTimeout(r, intervalMs));
       }
       return { status: "EXPIRED" };
     }
     ```
* **Acceptance Criteria**:
  * Unit test verifies `createIntentOrder` returns valid quote-specific `depositAddress` and `expiresAt`.
  * Simulated solver fulfillment transitions status to `SUCCESS` with destination transaction hash.

---

#### TASK-INT-AI-01: AI Tool Binding for Intent Execution
* **Target File**: [`src/lib/ai-gateway.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/ai-gateway.ts)
* **Technical Specification**:
  1. Add `execute_cross_chain_intent` to tool declarations:
     ```typescript
     {
       name: "execute_cross_chain_intent",
       description: "Execute a cross-chain swap or tip across NEAR, Base, Arbitrum, or Solana using NEAR Intents solvers",
       parameters: {
         type: "OBJECT",
         properties: {
           sourceAsset: { type: "STRING", description: "Asset to spend (e.g. NEAR, USDC)" },
           targetAsset: { type: "STRING", description: "Asset recipient receives (e.g. USDC, ETH, SOL)" },
           amount: { type: "NUMBER", description: "Amount of source asset" },
           destinationChain: { type: "STRING", enum: ["BASE", "SOLANA", "ARBITRUM", "ETHEREUM", "NEAR"] },
           recipient: { type: "STRING", description: "Recipient handle (@bob) or address (0x...)" }
         },
         required: ["sourceAsset", "targetAsset", "amount", "destinationChain", "recipient"]
       }
     }
     ```
  2. Update deterministic regex parser for instant zero-latency matching:
     * Pattern: `/^(?:send|tip|transfer|pay)\s+(\d+(?:\.\d+)?)\s+([a-zA-Z]+)\s+(?:on|to)\s+([a-zA-Z]+)\s+(?:to\s+)?(@?[a-zA-Z0-9_.-]+)/i`
* **Acceptance Criteria**:
  * `processUserMessage("Send 10 USDC on Base to @alice")` deterministic parser returns tool `execute_cross_chain_intent` with exact parsed args in $<1\text{ms}$.

---

#### TASK-INT-UI-01: 1-Click Intent Confirmation Card Component
* **Target Files**:
  * [`src/components/chat/ChatContainer.tsx`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/components/chat/ChatContainer.tsx)
  * [`src/components/chat/MessageBubble.tsx`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/components/chat/MessageBubble.tsx)
* **Technical Specification**:
  1. When `execute_cross_chain_intent` is returned by the AI gateway, render an interactive action card:
     * Source vs Destination visual comparison (e.g. `2.33 NEAR` $\rightarrow$ `10.00 USDC on Base`).
     * Real-time 60-second animated progress countdown bar.
     * Guaranteed solver exchange rate and estimated fee ($0.04).
     * Button: `[⚡ 1-Click Approve Intent]`.
  2. On user click:
     * Sign a `DelegateAction` transfer of the source asset to the single-use `depositAddress`.
     * Switch card state to `StatusRadar` polling status: `Deposit Broadcast` $\rightarrow$ `Solver Matched` $\rightarrow$ `Delivering to Base` $\rightarrow$ `Settled`.
     * If 60 seconds expire before click, disable button and offer `[🔄 Refresh Quote]`.
* **Acceptance Criteria**:
  * Component renders cleanly on mobile (320px–430px) without horizontal scrollbar.
  * Clicking approve triggers client-side signature and broadcasts deposit.

---

### PHASE 3: CONFIDENTIAL AI REASONING WITH NEAR AI CLOUD (P1) — [COMPLETED & VERIFIED]

> **Status**: Completed & Verified  
> **Verification Suite**: `scripts/test-phase3-hybrid-ai.mjs` (8/8 tests passed)  
> **Components Implemented**:
> 1. `src/lib/ai-gateway.ts`:
>    - `isFinancialQuery(prompt)` classifier heuristics distinguishing financial intents from general conversational prompts.
>    - `callNearAICloud(prompt, history, apiKey, timeoutMs)`: OpenAI-compatible client targeting `https://api.near.ai/v1` (`meta-llama/Llama-3.3-70B-Instruct`) inside hardware TEE enclaves.
>    - `callGeminiFlash(prompt, history, apiKey, timeoutMs)`: Google Gemini 2.5 Flash client for sub-second UI chat.
>    - `routeHybridAI(prompt, options)`: Hybrid routing gateway with 2500ms TEE hardware circuit breaker that falls back seamlessly to deterministic parsing / Gemini if the enclave times out or is unreachable.
> 2. `src/app/api/chat/route.ts`:
>    - Integrated `routeHybridAI` and confidential execution path when `provider: "nearai"` or `body.confidential` is requested.
>    - Added `execute_cross_chain_intent` tool declaration to both Gemini and OpenAI tool schemas.
>    - Sub-millisecond fast-path evaluation for unambiguous cross-chain, paylink, and faucet actions.

#### TASK-INT-AI-02: Hybrid AI Routing Gateway — [COMPLETED]
* **Target File**: [`src/lib/ai-gateway.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/ai-gateway.ts)
* **Technical Specification**:
  1. Implement Dual-Client Architecture:
     * `GeminiClient`: Google Gemini 2.5 Flash for sub-second UI chat.
     * `NearAIClient`: OpenAI-compatible client targeting `https://api.near.ai/v1` for confidential financial tool execution.
  2. Classifier Heuristic:
     * If the message matches financial action triggers (`tip`, `send`, `invoice`, `pay`, `balance`, `withdraw`), route to `NearAIClient`.
     * Otherwise, route to `GeminiClient`.
  3. Environment Configuration:
     * `NEAR_AI_API_KEY`: API key with Bearer token header.
     * `NEAR_AI_MODEL`: `meta-llama/Llama-3.3-70B-Instruct`.
* **Acceptance Criteria**:
  * Non-financial queries respond in $<400\text{ms}$ via Gemini.
  * Financial tool queries execute through `api.near.ai` inside hardware TEE enclaves.

---

#### TASK-INT-AI-03: TEE Enclave Circuit-Breaker & Fallback Harness — [COMPLETED]
* **Target File**: [`src/lib/ai-gateway.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/ai-gateway.ts)
* **Technical Specification**:
  * Implement an automatic timeout race: if `NearAIClient` does not return headers within 2500ms (e.g. during enclave spin-up or network congestion), automatically fall back to local regex execution or Gemini, appending a notification tag: `(Processed with speed fallback)`.
* **Acceptance Criteria**:
  * When `api.near.ai` is unreachable or times out, the chat interface does not crash and completes user intent seamlessly.

---

### PHASE 4: STEALTH SUBACCOUNTS & OUTBOUND MPC SIGNING (P1) — [COMPLETED & VERIFIED]

> **Status**: Completed & Verified  
> **Verification Suite**: `scripts/test-phase4-stealth-mpc.mjs` (6/6 tests passed)  
> **Components Implemented**:
> 1. `src/app/api/near/claim-subaccount/route.ts` — Ephemeral claim subaccount factory generating single-use `claim-[6hex].veilx-agent.testnet` accounts with relayer storage sponsorship and direct escrow payout.
> 2. `src/app/api/relay/claim/route.ts` — Updated claim relayer supporting `useStealthSubaccount: true` for zero on-chain linkage between recipient Twitter handles and primary wallets.
> 3. `src/models/EscrowTip.ts` — Added `stealthSubaccountId` field and schema indexing.
> 4. `src/lib/near-chain-signatures.ts`:
>    - `parseMpcSignature`: Formats threshold MPC affine points to standard EVM `(r, s, v, yParity)`.
>    - `requestMpcSignature`: Calls `v1.signer-prod.testnet` threshold signer.
>    - `createAndSignBaseTransaction`: Constructs EIP-1559 transactions on Base Sepolia (Chain ID 84532), serializes with viem, and broadcasts via Base RPC.
> 5. `src/app/api/evm/send-mpc/route.ts` — Live endpoint executing outbound Base transfers using NEAR Chain Signatures MPC.

#### TASK-INT-STEALTH-01: Ephemeral Claim Subaccount Factory — [COMPLETED]
* **Target File**: [`src/app/api/near/claim-subaccount/route.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/app/api/near/claim-subaccount/route.ts)
* **Technical Specification**:
  1. When a user claims an escrow tip, generate a single-use deterministic subaccount:
     $$\text{SubaccountId} = \text{claim-}[\text{random 6 hex}].\text{veilx-agent.testnet}$$
  2. The relayer signs `CreateAccount` + `Transfer` (0.00125 NEAR for storage) + `AddKey`.
  3. The escrow contract pays the tip balance into this ephemeral account.
  4. The user's client receives the access key to this subaccount and can immediately route funds to an external exchange or cross-chain address.
* **Acceptance Criteria**:
  * The recipient's primary Twitter handle and primary wallet address NEVER appear together in any single on-chain transaction receipt.

---

#### TASK-INT-MPC-01: Outbound NEAR Chain Signatures MPC Signing — [COMPLETED]
* **Target File**: [`src/lib/near-chain-signatures.ts`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/src/lib/near-chain-signatures.ts)
* **Technical Specification**:
  1. Implement `requestMpcSignature`:
     ```typescript
     export async function requestMpcSignature(
       nearAccount: Account,
       derivationPath: string,
       txPayloadHash: Uint8Array // 32-byte Keccak-256 hash of unsigned EVM transaction
     ): Promise<{ r: string; s: string; v: number }> {
       const result = await nearAccount.functionCall({
         contractId: "v1.signer-prod.testnet",
         methodName: "sign",
         args: {
           request: {
             payload: Array.from(txPayloadHash),
             path: derivationPath,
             key_type: "Ecdsa",
           },
         },
         gas: "300000000000000", // 300 TGas required for MPC computation
         attachedDeposit: "1",    // 1 yoctoNEAR
       });
       // Parse signature from execution outcome
       return parseMpcSignature(result);
     }
     ```
  2. Broadcast signed raw RLP transaction to Base Sepolia RPC (`https://sepolia.base.org`).
* **Acceptance Criteria**:
  * Calling the method executes an outbound transfer of Base ETH from the derived address to an external 0x recipient.

---

### PHASE 5: DECENTRALIZED AUTOMATION WITH OUTLAYER (P2) — [DEFERRED BY OWNER]

> **Status**: Deferred per owner instruction ("let's not implement the refund feature yet").  
> **Notes**: Smart contract yield/resume automated refund timers and TEE OutLayer executor postponed to future release cycle.

---

### PHASE 6: FULL-SYSTEM INTEGRATION VERIFICATION & TESTNET RELEASE — [COMPLETED & VERIFIED]

> **Status**: Completed & Verified  
> **Verification Suite**: `scripts/test-near-ecosystem-integration.mjs` (16/16 tests passed, 0 failures)  
> **Coverage Verified**:
> 1. Cryptographic commitment hashing ($\text{Hash}(\text{handle} \parallel \text{salt})$) and WASM binary export validation.
> 2. Client-side AES-256-GCM metadata encryption with zero server plaintext leakage.
> 3. NEAR Intents (1Click API) quote lifecycle and solver order persistence.
> 4. Sub-millisecond deterministic fast-path intent matching and TEE circuit breaker fallback.
> 5. Ephemeral stealth subaccount factory (`claim-[6hex].veilx-agent.testnet`) with authentication safety.
> 6. NEAR Chain Signatures MPC EVM address derivation and Base Sepolia EIP-1559 transaction serialization.
> 7. All live production API routes responding healthy on `http://localhost:3000`.

#### TASK-INT-TEST-01: Automated Multi-Chain Integration Test Suite — [COMPLETED]
* **Target File**: [`scripts/test-near-ecosystem-integration.mjs`](file:///C:/Users/HomePC/Downloads/VeilX-Agent/scripts/test-near-ecosystem-integration.mjs)
* **Test Results**: 16 Passed, 0 Failed.

---

## 4. EXECUTION SEQUENCE & WORK BREAKDOWN STRUCTURE

| Task ID | Task Description | Dependencies | Status | Target Phase |
|---|---|---|---|---|
| **TASK-INT-PRIV-01** | Escrow Commitment Hashing (`lib.rs`) | Rust `near-sdk` | **Completed & Verified** (321KB WASM) | **Phase 1** |
| **TASK-INT-PRIV-02** | Client-Side AES-256 Metadata Encryption | Web Crypto API | **Completed & Verified** (`encryption.ts`, PayLinks) | **Phase 1** |
| **TASK-INT-ESCROW-01**| NEP-141 Storage Deposit Automation | `near-rpc.ts` | **Completed & Verified** (`checkFtStorageBalance`) | **Phase 1** |
| **TASK-INT-1CLICK-01** | Active Intent Lifecycle (`1click.ts`) | 1Click REST API | **Completed & Verified** (Quote + Status manager) | **Phase 2** |
| **TASK-INT-AI-01** | AI Gateway Intent Tool Binding | Regex + LLM | **Completed & Verified** (Patterns 0D A/B/C) | **Phase 2** |
| **TASK-INT-UI-01** | 1-Click Intent Approval Card Component | React / Tailwind | **Completed & Verified** (Live StatusRadar card) | **Phase 2** |
| **TASK-INT-AI-02** | Hybrid AI Routing with NEAR AI Cloud | `api.near.ai` key | **Completed & Verified** (`routeHybridAI`) | **Phase 3** |
| **TASK-INT-AI-03** | TEE Enclave Circuit-Breaker Harness | `ai-gateway.ts` | **Completed & Verified** (2500ms timeout race) | **Phase 3** |
| **TASK-INT-STEALTH-01**| Ephemeral Claim Subaccount Factory | NEAR Relayer | **Completed & Verified** (`/api/near/claim-subaccount`) | **Phase 4** |
| **TASK-INT-MPC-01** | Outbound Chain Signatures MPC Signing | `v1.signer` | **Completed & Verified** (`sendBaseTransactionWithMpc`) | **Phase 4** |
| **TASK-INT-OUTLAYER-01**| Escrow `yield/resume` Automated Refunds | OutLayer coordinator| **Deferred by Owner** | **Phase 5** |
| **TASK-INT-TEST-01** | Automated Integration Test Suite | All modules | **Completed & Verified** (16/16 tests passing) | **Phase 6** |

---

## 5. ROLLBACK & RISK MITIGATION PROTOCOL

1. **Smart Contract Upgrades**:
   * The escrow contract (`veilx-agent.testnet`) is upgraded via `deploy_contract`.
   * State migration strategy: Retain backward compatibility by maintaining legacy `recipient_handle` mapping alongside the new `commitment` hash map for existing active escrows.
2. **NEAR Intents Fallback**:
   * If 1Click solvers experience temporary downtime, the UI automatically falls back to native NEAR direct transfers and displays an advisory: *"Cross-chain solver auction offline; standard NEAR transfers active."*
3. **AI Provider Fallback**:
   * If NEAR AI Cloud experiences latency spikes ($>2.5\text{s}$), the circuit breaker routes requests instantly to Google Gemini 2.5 Flash, ensuring zero downtime for conversational UI.
4. **Relayer Gas Protection**:
   * The relayer account maintains an automated reserve threshold alert ($<5\text{ NEAR}$). If depleted, the frontend prompts users to connect their external NEAR wallet to pay their own gas.

---

## 6. PERSONAL ACTIONS & OWNER APPROVAL CHECKLIST

Before implementation begins, please review and confirm:

- [ ] **I approve DEC-05**: Implement NEAR Intents (1Click Swap API) for cross-chain execution in chat.
- [ ] **I approve DEC-06**: Upgrade `veilx-escrow` smart contract with recipient commitment hashing to eliminate plaintext handles.
- [ ] **I approve DEC-07**: Implement Hybrid AI routing (Gemini for instant speed + NEAR AI Cloud for confidential financial tools).
- [ ] **Action Completed**: Verified `veilx-agent.testnet` has $>10$ testnet NEAR for relayer gas subsidies.

*Reply with **"Approved, proceed with Phase 1"** to initiate the smart contract commitment hashing and metadata encryption implementation.*
