# VEILX AGENT — SMART CONTRACT SECURITY AUDIT

**Target Contract:** `contracts/veilx-escrow/src/lib.rs` (438 lines Rust, NEAR SDK v5)  
**Contract Name:** `VeilXEscrow`  
**Network Deployment:** `veilx-escrow.testnet`  
**Audit Date:** November 3, 2026  
**Auditor:** Senior Smart Contract Security Auditor & Distributed Systems Engineer  

---

## 1. ARCHITECTURAL OVERVIEW

The `VeilXEscrow` contract manages multi-asset non-custodial escrows on NEAR Protocol. It supports two deposit primitives:
1. **Public Social Escrow:** `deposit_near_tip(tip_id, recipient_handle)`
2. **Private Commitment Escrow:** `deposit_private_near_tip(tip_id, commitment)` where `commitment = SHA256(recipient_handle || salt)`

Claiming is performed either via `claim_tip` (for public escrows) or `claim_private_tip` (for private escrows requiring the cryptographic pre-image). The contract also supports NEP-141 fungible tokens via `ft_on_transfer`.

```
                    ┌───────────────────────────────┐
                    │       VeilXEscrow State       │
                    │   owner_id: AccountId         │
                    │   tips: IterableMap<ID, Tip>  │
                    └───────────────┬───────────────┘
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│       deposit_near_tip()        │           │   deposit_private_near_tip()    │
│  - Stores recipient_handle      │           │  - Stores SHA256 commitment     │
│  - Attached NEAR/NEP-141 token  │           │  - Conceals recipient identity  │
└────────────────┬────────────────┘           └────────────────┬────────────────┘
                 │                                             │
                 ▼                                             ▼
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│          claim_tip()            │           │       claim_private_tip()       │
│  - Relayer access control       │           │  - Relayer access control       │
│  - Suffix prefix check:         │           │  - Pre-image verification:      │
│    wallet.split('.').next()     │           │    sha256(handle || salt) == comm│
│  - Marks tip.claimed = true     │           │  - Wallet prefix match check    │
└─────────────────────────────────┘           └─────────────────────────────────┘
```

---

## 2. DETAILED SECURITY FINDINGS & INVARIANT BREAKS

### [CRITICAL] SEC-SC-01: Ephemeral Stealth Subaccount Incompatibility
- **File & Line:** `contracts/veilx-escrow/src/lib.rs`, Lines 184–188 and Lines 254–258
- **Code:**
  ```rust
  let subaccount_prefix = recipient_wallet.as_str().split('.').next().unwrap_or("");
  require!(
      subaccount_prefix.eq_ignore_ascii_case(&tip.recipient_handle),
      "Recipient wallet does not match tip handle"
  );
  ```
- **Vulnerability:** Phase 4 introduced privacy-preserving ephemeral stealth subaccounts generated as `claim-[6hex].veilx-agent.testnet`. However, the smart contract strictly enforces that the recipient wallet's prefix must equal the stripped Twitter handle (e.g., `alice.veilx-agent.testnet`). Any attempt to claim funds into an ephemeral stealth subaccount triggers a contract panic (`"Recipient wallet does not match verified tip handle"`).
- **Financial Impact:** Recipient funds routed through Phase 4 stealth accounts are permanently unclaimable via standard contract invocation.
- **Remediation:** Update `claim_private_tip` to permit either:
  1. Prefix matching the revealed handle, OR
  2. Proof that `recipient_wallet` is an authorized ephemeral subaccount registered by the contract relayer.

---

### [HIGH] SEC-SC-02: Missing Refund Timeout & Sender Frontrunning Risk
- **File & Line:** `contracts/veilx-escrow/src/lib.rs`, Lines 321–347
- **Code:**
  ```rust
  pub fn refund_tip(&mut self, tip_id: String) -> Promise {
      let tip = self.tips.get_mut(&tip_id).expect("Tip not found");
      require!(!tip.claimed, "Tip already claimed or refunded");
      require!(
          env::predecessor_account_id() == tip.sender || env::predecessor_account_id() == self.owner_id,
          "Unauthorized: Only sender or relayer can refund tip"
      );
      tip.claimed = true;
      ...
  ```
- **Vulnerability:** `refund_tip` enforces no minimum escrow lock duration (`timestamp + EXPIRATION_WINDOW`). A malicious sender can deposit a tip, broadcast the transaction link to a merchant or recipient on Twitter, and immediately frontrun the recipient's claim by issuing a `refund_tip` transaction in the very next block.
- **Financial Impact:** Merchant griefing and social tip theft.
- **Remediation:** Introduce `created_at: u64` in `TipRecord` and enforce:
  ```rust
  require!(
      env::block_timestamp() >= tip.created_at + ESCROW_TIMELOCK_NS,
      "Refund locked: Escrow timelock has not expired"
  );
  ```

---

### [HIGH] SEC-SC-03: Lack of Rollback Callback on Failed Native NEAR Refund
- **File & Line:** `contracts/veilx-escrow/src/lib.rs`, Lines 335–346
- **Vulnerability:** In `claim_tip`, a promise callback `near_resolve_claim` is attached to revert `tip.claimed = false` if the recipient wallet fails to receive funds (e.g., deleted account or gas exhaustion). However, in `refund_tip`, `tip.claimed = true` is set, and the transfer is dispatched without a resolution callback:
  ```rust
  if token_id == env::current_account_id() {
      Promise::new(recipient_wallet).transfer(NearToken::from_yoctonear(amount.0))
  }
  ```
  If the sender's account was deleted or cannot accept the refund, the promise fails on-chain, but `tip.claimed` remains `true` permanently.
- **Financial Impact:** Irrecoverable loss of sender funds.
- **Remediation:** Attach a `near_resolve_refund` callback that restores `tip.claimed = false` on promise failure.

---

### [MEDIUM] SEC-SC-04: Storage Griefing via Unbounded `tips` IterableMap
- **File & Line:** `contracts/veilx-escrow/src/lib.rs`, Lines 43, 134, 162
- **Vulnerability:** In `deposit_near_tip` and `deposit_private_near_tip`, any user can attach 1 yoctoNEAR or 0.001 NEAR and register an arbitrary string `tip_id` of up to several kilobytes. The contract does not charge storage staking fees to the depositor; storage cost is deducted directly from the contract account's balance.
- **Financial Impact:** An attacker can spam millions of minimal deposits, exhausting the contract's 10 NEAR storage reserve and causing subsequent legitimate deposits to fail with `HostError(StorageQuotaExceeded)`.
- **Remediation:** Enforce a minimum deposit requirement (e.g., 0.05 NEAR) that includes storage staking deposit, or refund storage upon `prune_claimed_tip`.

---

### [LOW] SEC-SC-05: Centralized Relayer Bottleneck
- **File & Line:** `contracts/veilx-escrow/src/lib.rs`, Lines 172–175
- **Vulnerability:** `claim_tip` and `claim_private_tip` can only be invoked by `self.owner_id`. If the VeilX relayer server is offline, no user can claim their funds, even if they possess the valid cryptographic salt and Twitter OAuth proof.
- **Remediation:** Implement decentralized zero-knowledge verification or client-driven claims with relayer fallback.

---

## 3. INVARIANT & STATE ANALYSIS

| Invariant | Intended Specification | Actual Code State | Status |
| :--- | :--- | :--- | :--- |
| **I-01: Double-Claim Prevention** | A tip ID can only be claimed once. | `require!(!tip.claimed)` checked and set to `true` prior to async dispatch. | **VERIFIED PASS** |
| **I-02: Cryptographic Soundness** | Pre-image `SHA256(handle \|\| salt)` must strictly match stored commitment. | `env::sha256(preimage.as_bytes())` strictly checked against `stored_commitment`. | **VERIFIED PASS** |
| **I-03: Reentrancy Safety** | State modifications must precede async cross-contract promise calls. | Checks-Effects-Interactions pattern followed; state mutated before `Promise::new`. | **VERIFIED PASS** |
| **I-04: Suffix Neutrality** | Recipients should be able to claim to any valid NEAR account they own. | Hardcoded prefix check `wallet.split('.').next() == handle` prevents third-party account claims. | **FAILED (BROKEN)** |
| **I-05: Storage Neutrality** | Contract balance must not bleed from repeated unpruned deposits. | Storage is paid by contract owner; depositors are not debited for storage bytes. | **AT RISK** |

---

## 4. TEST COVERAGE EVALUATION

- Unit tests in `contracts/veilx-escrow/src/lib.rs` (lines 380–437) cover:
  1. `test_deposit_and_claim_near_tip`: Verifies basic public tip flow.
  2. `test_deposit_and_claim_private_tip`: Verifies SHA-256 pre-image matching.
  3. `test_refund_unclaimed_tip`: Verifies sender refund authorization.
- **Missing Tests:**
  - No test for NEP-141 cross-contract transfer callbacks (`GAS_FOR_FT_TRANSFER`).
  - No fuzz testing on malicious/oversized `tip_id` strings.
  - No test simulating failed promises or rollback logic in `near_resolve_claim`.
