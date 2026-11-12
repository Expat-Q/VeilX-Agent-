# VEILX ESCROW — SMART CONTRACT REMEDIATION & INVARIANTS BLUEPRINT

**Document Version:** 1.0.0  
**Status:** DRAFT — AWAITING USER APPROVAL (PLANNING ONLY)  
**Date:** November 2, 2026  
**Contract Source:** `contracts/veilx-escrow/src/lib.rs`  
**Language:** Rust (NEAR SDK v5.5.0)  
**Target Account:** `veilx-agent.testnet` on NEAR Protocol Testnet

---

## 1. FINANCIAL INVARIANTS SPECIFICATION

The VeilX Escrow smart contract must enforce the following non-negotiable invariants:

| # | Invariant Rule | Current Status | Required Remediation | Verification Evidence |
| :-: | :--- | :---: | :--- | :--- |
| **INV-1** | **No Double Claims**: A tip can be claimed exactly once. | **Enforced** | Preserve `require!(!tip.claimed)` and immediate state mutation before transfer promise dispatch. | Unit test attempting concurrent claims fails on second call. |
| **INV-2** | **Strict Recipient Binding**: A tip can only be claimed to a wallet matching the designated social handle prefix. | **VULNERABLE** | Remove `|| predecessor == self.owner_id` in line 141 so the relayer cannot divert funds to arbitrary accounts. | Contract panics with `"Recipient wallet does not match tip handle"`. |
| **INV-3** | **Atomic Reversion on Native Failure**: If a native NEAR transfer fails, the tip must remain claimable. | **VULNERABLE** | Attach private resolve callback `near_resolve_claim(tip_id)` to reset `claimed = false` on promise failure. | Mock failed transfer; `get_tip` returns `claimed: false`. |
| **INV-4** | **Atomic Reversion on FT Failure**: If a NEP-141 token transfer fails, the tip must remain claimable. | **Enforced** | Preserve `ft_resolve_claim(tip_id)` callback. | Mock failed FT transfer; `get_tip` returns `claimed: false`. |
| **INV-5** | **Storage Staking Self-Sufficiency**: Contract state storage growth must be funded by deposits or reclaimed upon settlement. | **VULNERABLE** | Reject micro-transfers in `ft_on_transfer` ($< 0.10$ USD) and prune claimed tips from storage via `self.tips.remove(&tip_id)` after settlement. | Contract storage balance does not decrease over 1,000 resolved transactions. |
| **INV-6** | **Refund Authority**: Only the original sender or relayer can refund an unclaimed tip. | **Enforced** | Preserve `require!(predecessor == tip.sender || predecessor == self.owner_id)`. | Third-party refund attempt panics with `"Unauthorized"`. |

---

## 2. DETAILED CONTRACT CODE CHANGES

### 2.1 Code Change 1: Enforce Strict Recipient Verification in `claim_tip`
- **Location:** `contracts/veilx-escrow/src/lib.rs`, Lines 138–143
- **Before:**
  ```rust
  let subaccount_prefix = recipient_wallet.as_str().split('.').next().unwrap_or("");
  require!(
      subaccount_prefix.eq_ignore_ascii_case(&tip.recipient_handle)
          || env::predecessor_account_id() == self.owner_id,
      "Recipient wallet does not match tip handle"
  );
  ```
- **After (Remediated):**
  ```rust
  let subaccount_prefix = recipient_wallet.as_str().split('.').next().unwrap_or("");
  require!(
      subaccount_prefix.eq_ignore_ascii_case(&tip.recipient_handle),
      "Recipient wallet does not match tip handle"
  );
  ```
- **Impact:** Cryptographically guarantees on-chain that funds can ONLY be released to the recipient's personal subaccount.

---

### 2.2 Code Change 2: Attach Private Resolve Callback for Native NEAR Transfers
- **Location:** `contracts/veilx-escrow/src/lib.rs`, Lines 151–153
- **Before:**
  ```rust
  if token_id == env::current_account_id() {
      Promise::new(recipient_wallet).transfer(NearToken::from_yoctonear(amount.0))
  }
  ```
- **After (Remediated):**
  ```rust
  if token_id == env::current_account_id() {
      Promise::new(recipient_wallet)
          .transfer(NearToken::from_yoctonear(amount.0))
          .then(
              Self::ext(env::current_account_id())
                  .with_static_gas(GAS_FOR_RESOLVE)
                  .near_resolve_claim(tip_id)
          )
  }
  ```
- **Callback Method Definition:**
  ```rust
  #[private]
  pub fn near_resolve_claim(&mut self, tip_id: String) -> bool {
      match env::promise_result_checked(0, 1024) {
          Ok(_) => true,
          Err(_) => {
              if let Some(tip) = self.tips.get_mut(&tip_id) {
                  tip.claimed = false;
              }
              false
          }
      }
  }
  ```

---

### 2.3 Code Change 3: Storage Pruning on Settlement
- **Location:** `contracts/veilx-escrow/src/lib.rs`
- **Remediation:**
  Add view/cleanup method `prune_claimed_tip(tip_id: String)` callable after 14 days of settlement by the relayer, which calls `self.tips.remove(&tip_id)` to release storage staking back to the contract.

---

## 3. CONTRACT DEVELOPMENT & DEPLOYMENT STAGES

```
Stage 1: Local Code Remediation
└── Apply Code Changes 1, 2, and 3 in contracts/veilx-escrow/src/lib.rs.

Stage 2: Comprehensive Unit & Integration Testing
└── Run cargo test covering all 6 financial invariants and attack vectors.

Stage 3: Bytecode Compilation
└── Compile optimized binary:
    cargo build --target wasm32-unknown-unknown --release

Stage 4: User Approval Gate (Mandatory)
└── Present compiled bytecode hash and git diff to User for formal deployment authorization.

Stage 5: Testnet Upgrade / Deployment
└── Execute near-cli-rs deployment:
    near contract deploy veilx-agent.testnet use-file ./target/wasm32-unknown-unknown/release/veilx_escrow.wasm without-init-call network-config testnet sign-with-keychain

Stage 6: Post-Deployment Smoke Test
└── Deposit 0.05 NEAR -> Claim to valid recipient -> Verify balance & event logs.
```

---

## 4. CONTRACT SECURITY TEST MATRIX

```rust
#[test]
fn test_invariant_recipient_prefix_mismatch_panics() {
    // 1. Initialize escrow with owner
    // 2. Deposit tip for "bob"
    // 3. Relayer attempts to claim to "attacker.veilx-agent.testnet"
    // 4. Assert panic: "Recipient wallet does not match tip handle"
}

#[test]
fn test_invariant_native_near_reverts_on_promise_failure() {
    // 1. Initialize escrow
    // 2. Deposit tip
    // 3. Mock Promise failure on near_resolve_claim
    // 4. Verify tip.claimed is false
}

#[test]
fn test_invariant_duplicate_claim_panics() {
    // 1. Initialize escrow
    // 2. Deposit tip
    // 3. Claim successfully
    // 4. Attempt claim again
    // 5. Assert panic: "Tip already claimed"
}
```
