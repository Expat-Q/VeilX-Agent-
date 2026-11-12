# 05 — BLOCKCHAIN, SMART CONTRACTS & TRANSACTION EXECUTION AUDIT
**Project:** VeilX Autonomous Omnichain Social Finance & Tokenized Equities Terminal  
**Auditor:** Agent 5 — Blockchain, Smart Contracts & Transaction Execution Specialist  
**Status:** Audit Complete  
**Date:** November 11, 2026  
**Repository Path:** `C:\Users\HomePC\Downloads\VeilX-Agent`

---

## 📌 PLAIN-ENGLISH SUMMARY (READ THIS FIRST)

> **What is this document?**  
> This report examines the actual blockchain smart contracts and wallet technology: the NEAR Rust contract (which holds money in escrow for social tips) and NEAR's Chain Signatures MPC (which lets your NEAR wallet control an Ethereum/Base address without needing bridges).

### In Plain Terms: How Good is the Blockchain Code?
1. **The NEAR Escrow Contract is Extremely Solid:**  
   * The Rust contract in `contracts/veilx-escrow/src/lib.rs` has strong safety protections. It prevents hackers from double-spending or re-entering transactions, properly supports tokens, and includes a 7-day timelock so senders can refund tips if the recipient never claims them.
2. **Native Gas on Base (DEC-001 Decided: Option A):**  
   * When a user withdraws or transfers USDC from their derived Base wallet, Base requires standard native ETH for gas.
   * *Architecture Rule:* Users simply provide or hold native Base ETH to pay for their gas fees, adhering to standard non-custodial EVM wallet behavior. No complex third-party paymaster or smart wallet contract is needed.
3. **The Multi-Party Computation (MPC) Identity Check:**  
   * When VeilX asks NEAR to sign an EVM transaction on behalf of a user, the server must be careful which account asks for the signature. If the main server signs on behalf of the user, the resulting address might look different than if the user signed directly.
   * *How to Fix:* Ensure the exact same derivation path and account ID are used consistently in all signing scripts.

---

## 1. Executive Summary

This audit delivers an exhaustive, ground-truth analysis of the on-chain smart contracts, multi-chain signing architecture, transaction builders, RPC integrations, and settlement engines powering the VeilX platform.

VeilX leverages three core Web3 primitives:
1. **NEAR Protocol Escrow Smart Contract** (`contracts/veilx-escrow/src/lib.rs`): A Rust smart contract (`near-sdk v5.30.0`) managing non-custodial social tips, stealth claims, and cryptographic commitment-based private transfers for native NEAR and NEP-141 tokens.
2. **NEAR Chain Signatures MPC** (`v1.signer-prod.testnet`): Threshold ECDSA signature generation allowing NEAR accounts to control native accounts and sign transactions across Base, Ethereum, and Arbitrum without centralized cross-chain bridges.
3. **NEP-366 Gasless Meta-Transaction Relayer** (`src/app/api/relay/claim/route.ts`): Server-side gas sponsorship enabling Web2 users to claim escrowed tips without pre-existing gas or wallet setup.

### Overall Blockchain Readiness:
- **NEAR Escrow Smart Contract:** **VERIFIED OPERATIONAL & ROBUST.** Reentrancy-safe optimistic locking with callback rollback (`near_resolve_claim`, `ft_resolve_claim`), strict predecessor verification on NEP-141 incoming transfers, 7-day timelocked sender refund mechanism (`refund_tip`), and state-storage pruning.
- **Base / EVM Chain Signatures MPC:** **FUNCTIONAL WITH ARCHITECTURAL CAVEATS.** Mathematical derivation (`SHA3-256` additive tweak over secp256k1), dynamic EIP-1559 gas fee estimation, and EIP-2 low-s canonical signature enforcement are mathematically sound. However, gas payment constraints for zero-ETH ERC-20 accounts and predecessor mismatches in server-side MPC execution require careful routing.
- **Gasless Relayer Claim Engine:** **VERIFIED OPERATIONAL.** Subaccount auto-provisioning, atomic MongoDB mutex with 5-minute timeout TTL, and dual public/stealth claim paths are active.

---

## 2. Smart Contract Source Inspection: `veilx-escrow`

**Source File:** `contracts/veilx-escrow/src/lib.rs` (462 lines of Rust, `near-sdk v5.30.0`)

### 2.1 State Storage & Initialization
- **State Storage:** Uses `LookupMap<String, TipRecord>` with prefix `b"t"` (lines 43, 53).
- **Initialization Gate:** Enforces `require!(!env::state_exists(), "Already initialized")` in `new(owner_id: AccountId)` (lines 49-55).
- **Storage Protection:** `MIN_DEPOSIT_NEAR = 10_000_000_000_000_000_000_000` (0.01 NEAR) is strictly enforced in `deposit_near_tip` (lines 114-117) and `deposit_private_near_tip` (lines 142-145) to prevent state storage exhaustion attacks.
- **Replay Protection:** `ft_on_transfer`, `deposit_near_tip`, and `deposit_private_near_tip` assert `require!(!self.tips.contains_key(&tip_id), "Tip ID already exists in escrow")` (lines 80, 119, 147). Tip IDs cannot be overwritten or reused.

### 2.2 NEP-141 Token Handling (`ft_on_transfer`)
- Follows the official NEAR NEP-141 token standard (lines 68-107):
  ```rust
  // contracts/veilx-escrow/src/lib.rs:74-82
  let token_id = env::predecessor_account_id();

  let parsed_msg: TransferMsg = near_sdk::serde_json::from_str(&msg)
      .expect("Invalid transfer msg JSON. Expected { tip_id, recipient_handle?, commitment? }");

  require!(
      !self.tips.contains_key(&parsed_msg.tip_id),
      "Tip ID already exists in escrow"
  );
  ```
  The escrow strictly records the token address as `env::predecessor_account_id()`, preventing spoofed token deposits where a malicious caller claims to deposit USDC while transferring worthless tokens.

### 2.3 Reentrancy Protection & Async Callbacks
- Social tip claims in `claim_tip` (lines 171-219) and `claim_private_tip` (lines 223-292) employ strict Check-Effects-Interactions patterns:
  ```rust
  // contracts/veilx-escrow/src/lib.rs:190-203
  // Mark claimed before dispatching external transfer (Reentrancy guard)
  tip.claimed = true;
  let amount = tip.amount;
  let token_id = tip.token_id.clone();

  if token_id == env::current_account_id() {
      Promise::new(recipient_wallet)
          .transfer(NearToken::from_yoctonear(amount.0))
          .then(
              Self::ext(env::current_account_id())
                  .with_static_gas(GAS_FOR_RESOLVE)
                  .near_resolve_claim(tip_id),
          )
  }
  ```
- If the transfer promise fails or reverts on-chain, private callbacks `near_resolve_claim` (lines 296-307) and `ft_resolve_claim` (lines 311-322) safely revert `tip.claimed = false`, ensuring funds are never permanently lost due to a transient execution error.

### 2.4 Timelocked Refund Mechanism
- Unlike initial assumptions, `contracts/veilx-escrow/src/lib.rs` **already implements** an explicit refund mechanism `refund_tip` (lines 325-371):
  ```rust
  // contracts/veilx-escrow/src/lib.rs:325-341
  pub fn refund_tip(&mut self, tip_id: String) -> Promise {
      let tip = self.tips.get_mut(&tip_id).expect("Tip not found");
      require!(!tip.claimed, "Tip already claimed or refunded");
      require!(
          env::predecessor_account_id() == tip.sender || env::predecessor_account_id() == self.owner_id,
          "Unauthorized: Only sender or relayer can refund tip"
      );

      // Security Timelock: Senders cannot refund within the active escrow lockup period (7 days = 604,800s)
      // Relayer can refund anytime in case of emergency or support resolution
      if env::predecessor_account_id() == tip.sender {
          const ESCROW_TIMELOCK_NS: u64 = 7 * 24 * 60 * 60 * 1_000_000_000;
          require!(
              env::block_timestamp() >= tip.created_at + ESCROW_TIMELOCK_NS,
              "Refund locked: Escrow timelock has not expired yet (7-day protection period)"
          );
      }
      tip.claimed = true;
      ...
  ```
  This guarantees that senders cannot rug recipients immediately after creating a tip, while ensuring that abandoned or unclaimed tips can be fully recovered by the sender after 7 days.

---

## 3. Detailed Blockchain Findings

### [BC-001] [High] Predecessor Account ID Mismatch in Server-Side MPC Signing
- **Finding ID:** BC-001
- **Severity:** HIGH
- **Status:** Verified Existing Flaw
- **Affected Files:**
  - `src/app/api/evm/send-mpc/route.ts` (lines 77-102)
  - `src/lib/near-chain-signatures.ts` (lines 77-118, 198-236)
- **Code Snippet:**
  ```typescript
  // src/app/api/evm/send-mpc/route.ts:77-87
  const userSenderId = senderNearAccountId || userDoc?.nearAccountId || CONTRACT_ID;

  let nearAccount: nearAPI.Account | undefined = undefined;

  // Use server-side ESCROW_PRIVATE_KEY for NEAR MPC gas sponsorship
  if (ESCROW_PRIVATE_KEY && CONTRACT_ID) {
    try {
      const provider = new nearAPI.JsonRpcProvider({ url: TESTNET_RPC });
      const keyPair = nearAPI.KeyPair.fromString(ESCROW_PRIVATE_KEY as any);
      const signer = new nearAPI.KeyPairSigner(keyPair);
      nearAccount = new nearAPI.Account(CONTRACT_ID, provider, signer);
    } catch (keyErr) {
      console.warn("[EVM MPC API] Failed to initialize NEAR account for signer:", keyErr);
    }
  }

  const result = await createAndSignBaseTransaction({
    nearAccount,
    senderNearAccountId: userSenderId,
    recipientAddress: recipientAddress as `0x${string}`,
    ...
  });
  ```
- **Analysis:**
  1. `createAndSignBaseTransaction` derives the expected sender address as `deriveEvmAddress(userSenderId)`.
  2. However, the NEAR function call to `v1.signer-prod.testnet.sign()` is executed using `nearAccount` (`CONTRACT_ID` = `veilx-agent.testnet`).
  3. The NEAR Chain Signatures contract derives the signing key from `env::predecessor_account_id()`. When the server signs via `CONTRACT_ID`, the MPC network generates a signature for `deriveEvmAddress("veilx-agent.testnet")`, **not** `deriveEvmAddress(userSenderId)`.
  4. The broadcast EVM transaction will recover the signer as `veilx-agent.testnet`'s derived EVM address. If the user's funds sit in their personal derived EVM address (`user.veilx-agent.testnet`), the transaction fails with `insufficient ERC-20 balance` or attempts to spend from the escrow's address.
- **Impact:** Server-routed MPC transactions for user accounts cannot spend from the user's derived EVM address unless signed by the user's actual NEAR account or using meta-transactions.
- **Recommended Remediation:**
  Ensure all user MPC transactions are executed using the client-side flow in `src/lib/near-client-signer.ts` (`signAndBroadcastMpcEvmTransfer`), where the user's browser session key directly calls `v1.signer-prod.testnet` as `user.veilx-agent.testnet`. Deprecate server-side key spoofing in `/api/evm/send-mpc` or transition to NEP-366 meta-transactions where the user authorizes the call.

---

### [BC-002] [Informational] Standard EVM Native Gas Requirement on Derived EVM Address Transfers
- **Finding ID:** BC-002
- **Severity:** INFORMATIONAL (Design Requirement)
- **Status:** Architectural Decision Confirmed (Option A)
- **Affected Files:**
  - `src/lib/near-chain-signatures.ts` (lines 398-414)
  - `src/app/api/evm/prepare-tx/route.ts` (lines 186-198)
- **Code Snippet:**
  ```typescript
  // src/lib/near-chain-signatures.ts:398-407
  const senderBalance = await publicClient.getBalance({ address: checksumAddress as `0x${string}` });
  const estimatedCost = (gas * maxFeePerGas) + value;
  if (senderBalance < estimatedCost) {
    const requiredEth = (Number(estimatedCost) / 1e18).toFixed(6);
    const currentEth = (Number(senderBalance) / 1e18).toFixed(6);
    throw new Error(
      `Gas Fee Error: Insufficient native ETH on ${chain.name}. Required: ~${requiredEth} ETH to cover gas, but your wallet holds ${currentEth} ETH. Please deposit a small amount of ETH to fund gas.`
    );
  }
  ```
- **Analysis & Decision:**
  - Per architectural confirmation (DEC-001: Option A), VeilX follows native non-custodial EVM standards: users hold or fund their own native Base ETH gas for outbound EVM transactions.
  - The validation in `near-chain-signatures.ts` correctly verifies whether the user has sufficient native ETH prior to initiating the NEAR MPC signing ceremony, preventing users from burning NEAR gas on an MPC signature for a transaction that the EVM sequencer would inevitably reject.
- **Recommended Remediation:**
  - Maintain the clear, descriptive error message informing users of the exact ETH needed.
  - In the UI withdrawal modal, provide a direct one-click link to a Base faucet (in Testnet mode) or an on-ramp/bridge guide (in Mainnet mode).
- **Impact:** Immediate UX blocker; users cannot withdraw tipped tokens without acquiring ETH on Base from an external fiat on-ramp or bridge.
- **Recommended Remediation:**
  1. Implement an automated relayer gas sponsor endpoint that automatically transfers $0.10 worth of Base Sepolia/Mainnet ETH to the derived address when an outbound transfer is prepared.
  2. Alternatively, integrate an ERC-4337 Paymaster (e.g. Pimlico / Biconomy) or EIP-3009 (`transferWithAuthorization`) / EIP-2612 permit flow where gas is paid in USDC.

---

### [BC-003] [Medium] Gas Limit Inadequacy Risk on NEP-141 Claim Callbacks
- **Finding ID:** BC-003
- **Severity:** MEDIUM
- **Status:** Verified Existing Risk
- **Affected File:** `contracts/veilx-escrow/src/lib.rs` (lines 10-11, 205-218)
- **Code Snippet:**
  ```rust
  // contracts/veilx-escrow/src/lib.rs:10-11
  const GAS_FOR_FT_TRANSFER: Gas = Gas::from_tgas(20);
  const GAS_FOR_RESOLVE: Gas = Gas::from_tgas(10);
  ```
  ```rust
  // contracts/veilx-escrow/src/lib.rs:205-218
  ext_ft_core::ext(token_id)
      .with_static_gas(GAS_FOR_FT_TRANSFER)
      .with_attached_deposit(NearToken::from_yoctonear(1))
      .ft_transfer(
          recipient_wallet,
          amount,
          Some(format!("VeilX tip claim: {}", tip_id)),
      )
      .then(
          Self::ext(env::current_account_id())
              .with_static_gas(GAS_FOR_RESOLVE)
              .ft_resolve_claim(tip_id)
      )
  ```
- **Analysis:**
  `ft_transfer` on complex NEP-141 contracts (e.g. storage registration checks, wrapped multi-token contracts) often consumes between 15 and 25 Tgas. If the target NEP-141 token contract requires more than 20 Tgas, the promise will fail with `Exceeded the prepaid gas`. While `ft_resolve_claim` protects against fund loss, the user's claim transaction will revert.
- **Impact:** Failed claims on specific NEP-141 tokens requiring higher gas limits.
- **Recommended Remediation:**
  Increase `GAS_FOR_FT_TRANSFER` to 30 Tgas and `GAS_FOR_RESOLVE` to 15 Tgas (total 45 Tgas attached). Ensure the relayer in `src/app/api/relay/claim/route.ts` attaches at least 80-100 Tgas (currently it attaches 60 Tgas, which is tight).

---

### [BC-004] [Low] Static Nonce Query Without Pending Mempool Cache
- **Finding ID:** BC-004
- **Severity:** LOW
- **Status:** Verified Existing Flaw
- **Affected Files:**
  - `src/lib/near-chain-signatures.ts` (lines 294-324)
  - `src/app/api/evm/prepare-tx/route.ts` (lines 114-121)
- **Code Snippet:**
  ```typescript
  // src/app/api/evm/prepare-tx/route.ts:114-121
  let nonce = 0;
  try {
    nonce = await publicClient.getTransactionCount({
      address: checksumAddress as `0x${string}`,
      blockTag: "pending",
    });
  } catch {
    nonce = 0;
  }
  ```
- **Analysis:**
  Relying solely on `getTransactionCount(..., "pending")` fails when transactions are dispatched in rapid succession (e.g., within 2-5 seconds). Public RPC nodes often suffer from indexing delay; the pending nonce might not update immediately, causing the subsequent transaction to be prepared with the same nonce and rejected as `nonce too low` or `replacement underpriced`.
- **Impact:** Back-to-back trades or tips from the same session can collide and fail.
- **Recommended Remediation:**
  Maintain a session-scoped in-memory nonce cache: `nonce = Math.max(rpcNonce, sessionLastNonce + 1)`.

---

## 4. Cryptographic Implementation Verification

### 4.1 EIP-2 Low-S Signature Canonicalization
In `src/lib/near-chain-signatures.ts` (lines 173-192), the MPC signature output is normalized:
```typescript
const secp256k1N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
const secp256k1halfN = secp256k1N / BigInt(2);
let sBig = BigInt(`0x${rawS}`);
let yParity: 0 | 1 = (recoveryId % 2) as 0 | 1;

if (sBig > secp256k1halfN) {
  sBig = secp256k1N - sBig;
  yParity = yParity === 0 ? 1 : 0;
  recoveryId = recoveryId === 0 ? 1 : 0;
}
```
**Verification Result:** **PASS.** Prevents transaction malleability; guarantees acceptance across all EVM execution clients (Geth, Besu, Nethermind, Erigon).

### 4.2 Additive Key Derivation
In `src/lib/near-chain-signatures.ts` (lines 77-118), the mathematical formula conforms precisely to the NEAR MPC derivation specification:
$$\epsilon = \text{SHA3-256}(\text{"near-mpc-recovery v0.1.0 epsilon derivation:"} \parallel \text{accountId} \parallel \text{","} \parallel \text{path})$$
$$\text{DerivedKey} = \text{RootPubKey} + \epsilon \cdot G$$
$$\text{EVM Address} = \text{Keccak-256}(\text{DerivedKey}_{1..65})_{-20..}$$
**Verification Result:** **PASS.** Mathematically deterministic and unforgeable.

---

## 5. Summary of Blockchain Action Items

| Priority | ID | Component | Action Item |
| :---: | :---: | :--- | :--- |
| **P0** | **BC-001** | `src/app/api/evm/send-mpc/route.ts` | Enforce client-side session key signing for MPC calls so `predecessor_account_id` matches the user account. |
| **P1** | **BC-002** | `src/lib/near-chain-signatures.ts` | Implement gas relayer or ERC-4337 Paymaster sponsorship for zero-ETH ERC-20 derived accounts. |
| **P2** | **BC-003** | `contracts/veilx-escrow/src/lib.rs` | Increase FT gas allocation (`GAS_FOR_FT_TRANSFER` to 30 Tgas, resolve to 15 Tgas, relayer call to 80 Tgas). |
| **P3** | **BC-004** | `src/app/api/evm/prepare-tx/route.ts` | Implement session-scoped local nonce tracking to prevent rapid transaction collisions. |
