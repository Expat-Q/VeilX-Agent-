// src/lib.rs
// VeilX Non-Custodial Escrow Smart Contract (NEAR Protocol)
use near_sdk::json_types::U128;
use near_sdk::store::LookupMap;
use near_sdk::{
    env, ext_contract, near, require, AccountId, Gas, NearToken, PanicOnDefault,
    Promise, PromiseOrValue,
};

const GAS_FOR_FT_TRANSFER: Gas = Gas::from_tgas(20);
const GAS_FOR_RESOLVE: Gas = Gas::from_tgas(10);
const MIN_DEPOSIT_NEAR: u128 = 10_000_000_000_000_000_000_000; // 0.01 NEAR

pub const DEFAULT_DAILY_LIMIT: u128 = 50_000_000; // 50 USDC (6 decimals)
pub const DEFAULT_WEEKLY_LIMIT: u128 = 200_000_000; // 200 USDC (6 decimals)
pub const DEFAULT_PER_TX_MAX: u128 = 25_000_000; // 25 USDC (6 decimals)
pub const DAILY_RESET_PERIOD_NS: u64 = 86_400_000_000_000; // 24 hours in nanoseconds
pub const WEEKLY_RESET_PERIOD_NS: u64 = 604_800_000_000_000; // 7 days in nanoseconds

#[ext_contract(ext_ft_core)]
pub trait ExtFtCore {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) -> Promise;
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct TipRecord {
    pub tip_id: String,
    pub sender: AccountId,
    pub recipient_handle: String, // e.g. "expatq3" or "[private]"
    pub commitment: Option<String>, // Hex-encoded SHA-256(recipient_handle || salt) for private tips
    pub token_id: AccountId,      // NEP-141 contract address or contract account for native NEAR
    pub amount: U128,
    pub claimed: bool,
    pub created_at: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct AccountGuardrails {
    pub daily_limit: U128,
    pub spent_today: U128,
    pub last_daily_reset_ts: u64,
    pub weekly_limit: U128,
    pub spent_this_week: U128,
    pub last_weekly_reset_ts: u64,
    pub per_tx_quarantine_max: U128,
    pub is_frozen: bool,
}

#[near(serializers = [json])]
pub struct TransferMsg {
    pub tip_id: String,
    pub recipient_handle: Option<String>,
    pub commitment: Option<String>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct VeilXEscrow {
    pub owner_id: AccountId,
    pub tips: LookupMap<String, TipRecord>,
    pub guardrails: LookupMap<AccountId, AccountGuardrails>,
}

#[near]
impl VeilXEscrow {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        require!(!env::state_exists(), "Already initialized");
        Self {
            owner_id,
            tips: LookupMap::new(b"t"),
            guardrails: LookupMap::new(b"g"),
        }
    }

    #[private]
    #[init(ignore_state)]
    pub fn migrate() -> Self {
        Self {
            owner_id: env::current_account_id(),
            tips: LookupMap::new(b"t"),
            guardrails: LookupMap::new(b"g"),
        }
    }

    /// Sets custom spending guardrails for the predecessor account.
    pub fn set_guardrails(&mut self, daily_limit: U128, weekly_limit: U128, per_tx_max: U128) {
        let account_id = env::predecessor_account_id();
        let now = env::block_timestamp();
        let mut guardrails = self.guardrails.get(&account_id).cloned().unwrap_or_else(|| AccountGuardrails {
            daily_limit,
            spent_today: U128(0),
            last_daily_reset_ts: now,
            weekly_limit,
            spent_this_week: U128(0),
            last_weekly_reset_ts: now,
            per_tx_quarantine_max: per_tx_max,
            is_frozen: false,
        });

        if now >= guardrails.last_daily_reset_ts.saturating_add(DAILY_RESET_PERIOD_NS) {
            guardrails.spent_today = U128(0);
            guardrails.last_daily_reset_ts = now;
        }

        if now >= guardrails.last_weekly_reset_ts.saturating_add(WEEKLY_RESET_PERIOD_NS) {
            guardrails.spent_this_week = U128(0);
            guardrails.last_weekly_reset_ts = now;
        }

        guardrails.daily_limit = daily_limit;
        guardrails.weekly_limit = weekly_limit;
        guardrails.per_tx_quarantine_max = per_tx_max;
        self.guardrails.insert(account_id, guardrails);
    }

    /// Enables or disables emergency freeze for the predecessor account.
    pub fn emergency_freeze(&mut self, frozen: bool) {
        let account_id = env::predecessor_account_id();
        let now = env::block_timestamp();
        let mut guardrails = self.guardrails.get(&account_id).cloned().unwrap_or_else(|| AccountGuardrails {
            daily_limit: U128(DEFAULT_DAILY_LIMIT),
            spent_today: U128(0),
            last_daily_reset_ts: now,
            weekly_limit: U128(DEFAULT_WEEKLY_LIMIT),
            spent_this_week: U128(0),
            last_weekly_reset_ts: now,
            per_tx_quarantine_max: U128(DEFAULT_PER_TX_MAX),
            is_frozen: false,
        });

        guardrails.is_frozen = frozen;
        self.guardrails.insert(account_id, guardrails);
    }

    /// Verifies spending invariants, updates rolling counters, and persists guardrails.
    pub fn check_and_record_spend(&mut self, account: AccountId, amount: U128) {
        let now = env::block_timestamp();
        let mut guardrails = self.guardrails.get(&account).cloned().unwrap_or_else(|| AccountGuardrails {
            daily_limit: U128(DEFAULT_DAILY_LIMIT),
            spent_today: U128(0),
            last_daily_reset_ts: now,
            weekly_limit: U128(DEFAULT_WEEKLY_LIMIT),
            spent_this_week: U128(0),
            last_weekly_reset_ts: now,
            per_tx_quarantine_max: U128(DEFAULT_PER_TX_MAX),
            is_frozen: false,
        });

        if guardrails.is_frozen {
            env::panic_str("ACCOUNT_FROZEN: Account is frozen by emergency safety control");
        }

        // Rolling 24-hour reset
        if now >= guardrails.last_daily_reset_ts.saturating_add(DAILY_RESET_PERIOD_NS) {
            guardrails.spent_today = U128(0);
            guardrails.last_daily_reset_ts = now;
        }

        // Rolling 7-day reset
        if now >= guardrails.last_weekly_reset_ts.saturating_add(WEEKLY_RESET_PERIOD_NS) {
            guardrails.spent_this_week = U128(0);
            guardrails.last_weekly_reset_ts = now;
        }

        // Check daily limit
        let new_spent_today = guardrails.spent_today.0.checked_add(amount.0).expect("Integer overflow");
        if new_spent_today > guardrails.daily_limit.0 {
            env::panic_str("GUARDRAIL_EXCEEDED: Daily spending limit breached on-chain");
        }

        // Check weekly limit
        let new_spent_week = guardrails.spent_this_week.0.checked_add(amount.0).expect("Integer overflow");
        if new_spent_week > guardrails.weekly_limit.0 {
            env::panic_str("GUARDRAIL_EXCEEDED: Weekly spending limit breached on-chain");
        }

        guardrails.spent_today = U128(new_spent_today);
        guardrails.spent_this_week = U128(new_spent_week);

        self.guardrails.insert(account, guardrails);
    }

    /// View method: retrieves account guardrails
    pub fn get_guardrails(&self, account: AccountId) -> Option<AccountGuardrails> {
        self.guardrails.get(&account).cloned()
    }

    /// Receives NEP-141 tokens from 1Click solvers or direct payers.
    /// Locks the funds to the specific `tip_id` and `recipient_handle` or `commitment`.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        let token_id = env::predecessor_account_id();

        let parsed_msg: TransferMsg = near_sdk::serde_json::from_str(&msg)
            .expect("Invalid transfer msg JSON. Expected { tip_id, recipient_handle?, commitment? }");

        require!(
            !self.tips.contains_key(&parsed_msg.tip_id),
            "Tip ID already exists in escrow"
        );

        // Guardrail spend check for sender account
        self.check_and_record_spend(sender_id.clone(), amount);

        let (recipient_handle, commitment) = if let Some(ref c) = parsed_msg.commitment {
            ("[private]".to_string(), Some(c.to_lowercase()))
        } else if let Some(ref h) = parsed_msg.recipient_handle {
            (h.to_lowercase(), None)
        } else {
            env::panic_str("Either recipient_handle or commitment must be provided");
        };

        let record = TipRecord {
            tip_id: parsed_msg.tip_id.clone(),
            sender: sender_id,
            recipient_handle,
            commitment,
            token_id,
            amount,
            claimed: false,
            created_at: env::block_timestamp(),
        };

        self.tips.insert(parsed_msg.tip_id, record);

        // Return 0 to indicate all tokens are accepted and retained in escrow
        PromiseOrValue::Value(U128(0))
    }

    /// Deposits native NEAR into escrow for a specific X handle with attached value.
    /// Invariant: Requires a minimum deposit of 0.01 NEAR to mitigate storage exhaustion DoS.
    #[payable]
    pub fn deposit_near_tip(&mut self, tip_id: String, recipient_handle: String) {
        let deposit = env::attached_deposit();
        require!(
            deposit.as_yoctonear() >= MIN_DEPOSIT_NEAR,
            "Attached deposit must be at least 0.01 NEAR"
        );
        require!(
            !self.tips.contains_key(&tip_id),
            "Tip ID already exists in escrow"
        );

        let sender = env::predecessor_account_id();
        // Convert yoctoNEAR (24 decimals) to standard 6-decimal micro-USD units (1 NEAR ~ $5 USD)
        // 1 NEAR = 10^24 yoctoNEAR -> divided by 10^18 = 10^6 micro-units * $5 = 5,000,000 micro-USD
        let raw_near_micro = deposit.as_yoctonear() / 1_000_000_000_000_000_000;
        let usd_micro_spend = std::cmp::max(raw_near_micro.saturating_mul(5), 1);
        self.check_and_record_spend(sender.clone(), U128(usd_micro_spend));

        let record = TipRecord {
            tip_id: tip_id.clone(),
            sender,
            recipient_handle: recipient_handle.to_lowercase(),
            commitment: None,
            token_id: env::current_account_id(), // Indicates native NEAR
            amount: U128(deposit.as_yoctonear()),
            claimed: false,
            created_at: env::block_timestamp(),
        };

        self.tips.insert(tip_id, record);
    }

    /// Deposits native NEAR into escrow with a cryptographic commitment hash.
    /// Obfuscates the recipient's Twitter handle on-chain to prevent social graph surveillance.
    #[payable]
    pub fn deposit_private_near_tip(&mut self, tip_id: String, commitment: String) {
        let deposit = env::attached_deposit();
        require!(
            deposit.as_yoctonear() >= MIN_DEPOSIT_NEAR,
            "Attached deposit must be at least 0.01 NEAR"
        );
        require!(
            !self.tips.contains_key(&tip_id),
            "Tip ID already exists in escrow"
        );
        require!(
            commitment.len() == 64,
            "Invalid commitment: Expected 64-character hex-encoded SHA-256 hash"
        );

        let sender = env::predecessor_account_id();
        // Convert yoctoNEAR (24 decimals) to standard 6-decimal micro-USD units (1 NEAR ~ $5 USD)
        // 1 NEAR = 10^24 yoctoNEAR -> divided by 10^18 = 10^6 micro-units * $5 = 5,000,000 micro-USD
        let raw_near_micro = deposit.as_yoctonear() / 1_000_000_000_000_000_000;
        let usd_micro_spend = std::cmp::max(raw_near_micro.saturating_mul(5), 1);
        self.check_and_record_spend(sender.clone(), U128(usd_micro_spend));

        let record = TipRecord {
            tip_id: tip_id.clone(),
            sender,
            recipient_handle: "[private]".to_string(),
            commitment: Some(commitment.to_lowercase()),
            token_id: env::current_account_id(), // Indicates native NEAR
            amount: U128(deposit.as_yoctonear()),
            claimed: false,
            created_at: env::block_timestamp(),
        };

        self.tips.insert(tip_id, record);
    }

    /// Claims a locked tip to the recipient's wallet address.
    /// SECURED: Must be called by the designated contract relayer/owner after verifying X identity.
    pub fn claim_tip(&mut self, tip_id: String, recipient_wallet: AccountId) -> Promise {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Unauthorized: Only authorized VeilX relayer can authorize claims"
        );

        let tip = self.tips.get_mut(&tip_id).expect("Tip not found");
        require!(!tip.claimed, "Tip already claimed");

        // Contract-level recipient validation:
        // Ensures subaccount prefix strictly matches the tip's recipient_handle or is an authorized stealth subaccount
        let subaccount_prefix = recipient_wallet.as_str().split('.').next().unwrap_or("");
        let is_handle_match = subaccount_prefix.eq_ignore_ascii_case(&tip.recipient_handle);
        let is_stealth_match = subaccount_prefix.starts_with("claim-");
        require!(
            is_handle_match || is_stealth_match,
            "Recipient wallet does not match tip handle or authorized stealth subaccount"
        );

        // Mark claimed before dispatching external transfer (Reentrancy guard)
        tip.claimed = true;
        let amount = tip.amount;
        let token_id = tip.token_id.clone();

        // Native NEAR transfer vs NEP-141 FT transfer with callback
        if token_id == env::current_account_id() {
            Promise::new(recipient_wallet)
                .transfer(NearToken::from_yoctonear(amount.0))
                .then(
                    Self::ext(env::current_account_id())
                        .with_static_gas(GAS_FOR_RESOLVE)
                        .near_resolve_claim(tip_id),
                )
        } else {
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
        }
    }

    /// Claims a private commitment-based tip to the recipient's wallet address.
    /// Cryptographically verifies that sha256(recipient_handle || salt) matches the on-chain commitment.
    pub fn claim_private_tip(
        &mut self,
        tip_id: String,
        recipient_handle: String,
        salt: String,
        recipient_wallet: AccountId,
    ) -> Promise {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Unauthorized: Only authorized VeilX relayer can authorize claims"
        );

        let tip = self.tips.get_mut(&tip_id).expect("Tip not found");
        require!(!tip.claimed, "Tip already claimed");

        let stored_commitment = tip
            .commitment
            .as_ref()
            .expect("Tip was not deposited with a private commitment");

        // Verify cryptographic pre-image: sha256(clean_handle || salt) == commitment
        let clean_handle = recipient_handle.to_lowercase();
        let stripped_handle = clean_handle.trim_start_matches('@');
        let preimage = format!("{}{}", stripped_handle, salt.trim());
        let computed_hash = env::sha256(preimage.as_bytes());
        let computed_hex: String = computed_hash.iter().map(|b| format!("{:02x}", b)).collect();

        require!(
            computed_hex.eq_ignore_ascii_case(stored_commitment),
            "Cryptographic proof mismatch: Invalid recipient handle or privacy salt"
        );

        // Verify claimant's wallet matches the revealed recipient handle or is an authorized stealth subaccount
        let subaccount_prefix = recipient_wallet.as_str().split('.').next().unwrap_or("");
        let is_handle_match = subaccount_prefix.eq_ignore_ascii_case(stripped_handle);
        let is_stealth_match = subaccount_prefix.starts_with("claim-");
        require!(
            is_handle_match || is_stealth_match,
            "Recipient wallet does not match verified tip handle or authorized stealth subaccount"
        );

        // Mark claimed before external transfer (Reentrancy guard)
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
        } else {
            ext_ft_core::ext(token_id)
                .with_static_gas(GAS_FOR_FT_TRANSFER)
                .with_attached_deposit(NearToken::from_yoctonear(1))
                .ft_transfer(
                    recipient_wallet,
                    amount,
                    Some(format!("VeilX private tip claim: {}", tip_id)),
                )
                .then(
                    Self::ext(env::current_account_id())
                        .with_static_gas(GAS_FOR_RESOLVE)
                        .ft_resolve_claim(tip_id),
                )
        }
    }

    /// Private callback to handle Native NEAR transfer failures.
    /// If the native transfer failed on-chain, reverts tip.claimed = false so funds are not lost.
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

    /// Private callback to handle NEP-141 transfer failures.
    /// If the token transfer failed on-chain, reverts tip.claimed = false so funds are not lost.
    #[private]
    pub fn ft_resolve_claim(&mut self, tip_id: String) -> bool {
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

    /// Allows the original sender (after 7-day timelock) or relayer to refund an unclaimed tip.
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
        let amount = tip.amount;
        let recipient_wallet = tip.sender.clone();
        let token_id = tip.token_id.clone();

        if token_id == env::current_account_id() {
            Promise::new(recipient_wallet)
                .transfer(NearToken::from_yoctonear(amount.0))
                .then(
                    Self::ext(env::current_account_id())
                        .with_static_gas(GAS_FOR_RESOLVE)
                        .near_resolve_claim(tip_id),
                )
        } else {
            ext_ft_core::ext(token_id)
                .with_static_gas(GAS_FOR_FT_TRANSFER)
                .with_attached_deposit(NearToken::from_yoctonear(1))
                .ft_transfer(
                    recipient_wallet,
                    amount,
                    Some(format!("VeilX tip refund: {}", tip_id)),
                )
                .then(
                    Self::ext(env::current_account_id())
                        .with_static_gas(GAS_FOR_RESOLVE)
                        .ft_resolve_claim(tip_id),
                )
        }
    }

    /// Allows the relayer/owner to prune claimed tips after settlement to reclaim contract storage.
    pub fn prune_claimed_tip(&mut self, tip_id: String) -> bool {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Unauthorized: Only contract owner can prune claimed tips"
        );
        if let Some(tip) = self.tips.get(&tip_id) {
            require!(tip.claimed, "Cannot prune active unclaimed tip");
            self.tips.remove(&tip_id);
            true
        } else {
            false
        }
    }

    /// View method: retrieves tip record details
    pub fn get_tip(&self, tip_id: String) -> Option<TipRecord> {
        self.tips.get(&tip_id).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    #[test]
    fn test_initialization() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let context = VMContextBuilder::new().signer_account_id(owner.clone()).build();
        testing_env!(context);

        let contract = VeilXEscrow::new(owner.clone());
        assert_eq!(contract.owner_id, owner);
    }

    #[test]
    fn test_ft_on_transfer_locks_tip() {
        let owner: AccountId = "escrow.near".parse().unwrap();
        let usdc_token: AccountId = "usdc.near".parse().unwrap();
        let sender: AccountId = "payer.near".parse().unwrap();

        let context = VMContextBuilder::new()
            .current_account_id(owner.clone())
            .predecessor_account_id(usdc_token.clone())
            .block_timestamp(1_000_000_000_000)
            .build();
        testing_env!(context);

        let mut contract = VeilXEscrow::new(owner);
        let msg = r#"{"tip_id": "tip_101", "recipient_handle": "expatq3"}"#;
        
        let result = contract.ft_on_transfer(sender.clone(), U128(5_000_000), msg.to_string());
        match result {
            PromiseOrValue::Value(val) => assert_eq!(val, U128(0)),
            _ => panic!("Expected Value(0)"),
        }

        let tip = contract.get_tip("tip_101".to_string()).expect("Tip should exist");
        assert_eq!(tip.recipient_handle, "expatq3");
        assert_eq!(tip.amount, U128(5_000_000));
        assert_eq!(tip.token_id, usdc_token);
        assert!(!tip.claimed);

        let guardrails = contract.get_guardrails(sender).expect("Guardrails should be set");
        assert_eq!(guardrails.spent_today, U128(5_000_000));
        assert_eq!(guardrails.spent_this_week, U128(5_000_000));
    }

    #[test]
    #[should_panic(expected = "Unauthorized: Only authorized VeilX relayer can authorize claims")]
    fn test_unauthorized_claim_rejected() {
        let owner: AccountId = "relayer.near".parse().unwrap();
        let usdc_token: AccountId = "usdc.near".parse().unwrap();
        let sender: AccountId = "payer.near".parse().unwrap();
        let attacker: AccountId = "attacker.near".parse().unwrap();

        let context = VMContextBuilder::new()
            .current_account_id(owner.clone())
            .predecessor_account_id(usdc_token.clone())
            .block_timestamp(1_000_000_000_000)
            .build();
        testing_env!(context);

        let mut contract = VeilXEscrow::new(owner);
        let msg = r#"{"tip_id": "tip_102", "recipient_handle": "victim"}"#;
        let _ = contract.ft_on_transfer(sender, U128(1_000_000), msg.to_string());

        // Attacker attempts to claim
        let attacker_context = VMContextBuilder::new()
            .current_account_id(contract.owner_id.clone())
            .predecessor_account_id(attacker.clone())
            .build();
        testing_env!(attacker_context);

        let _ = contract.claim_tip("tip_102".to_string(), attacker);
    }

    #[test]
    fn test_daily_cap_and_24h_reset() {
        let owner: AccountId = "escrow.near".parse().unwrap();
        let user: AccountId = "user.near".parse().unwrap();

        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(owner.clone())
            .predecessor_account_id(user.clone())
            .block_timestamp(1_000_000_000_000);
        testing_env!(builder.build());

        let mut contract = VeilXEscrow::new(owner);

        // Set custom limits: daily 50 USDC, weekly 200 USDC, per_tx 25 USDC
        contract.set_guardrails(U128(50_000_000), U128(200_000_000), U128(25_000_000));

        // First spend: 30 USDC
        contract.check_and_record_spend(user.clone(), U128(30_000_000));
        let g = contract.get_guardrails(user.clone()).unwrap();
        assert_eq!(g.spent_today, U128(30_000_000));
        assert_eq!(g.spent_this_week, U128(30_000_000));

        // Second spend: 20 USDC (hits exactly daily limit of 50 USDC)
        contract.check_and_record_spend(user.clone(), U128(20_000_000));
        let g2 = contract.get_guardrails(user.clone()).unwrap();
        assert_eq!(g2.spent_today, U128(50_000_000));
        assert_eq!(g2.spent_this_week, U128(50_000_000));

        // Advance timestamp past 24 hours (86,400s = 86_400_000_000_000 ns)
        builder.block_timestamp(1_000_000_000_000 + DAILY_RESET_PERIOD_NS);
        testing_env!(builder.build());

        // Daily limit resets, spend 25 USDC succeeds
        contract.check_and_record_spend(user.clone(), U128(25_000_000));
        let g3 = contract.get_guardrails(user).unwrap();
        assert_eq!(g3.spent_today, U128(25_000_000));
        assert_eq!(g3.spent_this_week, U128(75_000_000));
    }

    #[test]
    #[should_panic(expected = "GUARDRAIL_EXCEEDED: Daily spending limit breached on-chain")]
    fn test_daily_cap_breach_panics() {
        let owner: AccountId = "escrow.near".parse().unwrap();
        let user: AccountId = "user.near".parse().unwrap();

        let context = VMContextBuilder::new()
            .current_account_id(owner.clone())
            .predecessor_account_id(user.clone())
            .block_timestamp(1_000_000_000_000)
            .build();
        testing_env!(context);

        let mut contract = VeilXEscrow::new(owner);
        contract.set_guardrails(U128(50_000_000), U128(200_000_000), U128(25_000_000));

        contract.check_and_record_spend(user.clone(), U128(30_000_000));
        // Spending another 25_000_000 brings total to 55_000_000 > 50_000_000 -> PANIC
        contract.check_and_record_spend(user, U128(25_000_000));
    }

    #[test]
    fn test_weekly_cap_and_7day_reset() {
        let owner: AccountId = "escrow.near".parse().unwrap();
        let user: AccountId = "user.near".parse().unwrap();

        let mut builder = VMContextBuilder::new();
        let base_ts = 1_000_000_000_000u64;
        builder
            .current_account_id(owner.clone())
            .predecessor_account_id(user.clone())
            .block_timestamp(base_ts);
        testing_env!(builder.build());

        let mut contract = VeilXEscrow::new(owner);
        // Daily: 100 USDC, Weekly: 150 USDC
        contract.set_guardrails(U128(100_000_000), U128(150_000_000), U128(100_000_000));

        // Day 1: spend 90 USDC
        contract.check_and_record_spend(user.clone(), U128(90_000_000));
        let g1 = contract.get_guardrails(user.clone()).unwrap();
        assert_eq!(g1.spent_today, U128(90_000_000));
        assert_eq!(g1.spent_this_week, U128(90_000_000));

        // Advance 24h -> spent_today resets to 0, spent_this_week remains 90 USDC
        builder.block_timestamp(base_ts + DAILY_RESET_PERIOD_NS);
        testing_env!(builder.build());

        // Day 2: spend 50 USDC -> total weekly is 140 USDC (below 150 limit)
        contract.check_and_record_spend(user.clone(), U128(50_000_000));
        let g2 = contract.get_guardrails(user.clone()).unwrap();
        assert_eq!(g2.spent_today, U128(50_000_000));
        assert_eq!(g2.spent_this_week, U128(140_000_000));

        // Advance 7 days from base -> rolling weekly resets
        builder.block_timestamp(base_ts + WEEKLY_RESET_PERIOD_NS + 10);
        testing_env!(builder.build());

        // Spend 80 USDC -> succeeds because weekly reset to 0!
        contract.check_and_record_spend(user.clone(), U128(80_000_000));
        let g3 = contract.get_guardrails(user).unwrap();
        assert_eq!(g3.spent_today, U128(80_000_000));
        assert_eq!(g3.spent_this_week, U128(80_000_000));
    }

    #[test]
    #[should_panic(expected = "GUARDRAIL_EXCEEDED: Weekly spending limit breached on-chain")]
    fn test_weekly_cap_breach_panics() {
        let owner: AccountId = "escrow.near".parse().unwrap();
        let user: AccountId = "user.near".parse().unwrap();

        let mut builder = VMContextBuilder::new();
        let base_ts = 1_000_000_000_000u64;
        builder
            .current_account_id(owner.clone())
            .predecessor_account_id(user.clone())
            .block_timestamp(base_ts);
        testing_env!(builder.build());

        let mut contract = VeilXEscrow::new(owner);
        // Daily: 100 USDC, Weekly: 150 USDC
        contract.set_guardrails(U128(100_000_000), U128(150_000_000), U128(100_000_000));

        // Day 1: spend 90 USDC
        contract.check_and_record_spend(user.clone(), U128(90_000_000));

        // Day 2 (after 24h): spend 50 USDC -> weekly total 140 USDC
        builder.block_timestamp(base_ts + DAILY_RESET_PERIOD_NS);
        testing_env!(builder.build());
        contract.check_and_record_spend(user.clone(), U128(50_000_000));

        // Attempt to spend another 20 USDC -> weekly total would be 160 > 150 -> PANIC
        contract.check_and_record_spend(user, U128(20_000_000));
    }

    #[test]
    #[should_panic(expected = "ACCOUNT_FROZEN: Account is frozen by emergency safety control")]
    fn test_emergency_freeze_blocks_spend() {
        let owner: AccountId = "escrow.near".parse().unwrap();
        let user: AccountId = "user.near".parse().unwrap();

        let context = VMContextBuilder::new()
            .current_account_id(owner.clone())
            .predecessor_account_id(user.clone())
            .block_timestamp(1_000_000_000_000)
            .build();
        testing_env!(context);

        let mut contract = VeilXEscrow::new(owner);
        // User freezes their account
        contract.emergency_freeze(true);

        let g = contract.get_guardrails(user.clone()).unwrap();
        assert!(g.is_frozen);

        // Attempt to spend while frozen -> PANIC
        contract.check_and_record_spend(user, U128(1_000_000));
    }

    #[test]
    fn test_emergency_freeze_and_unfreeze() {
        let owner: AccountId = "escrow.near".parse().unwrap();
        let user: AccountId = "user.near".parse().unwrap();

        let context = VMContextBuilder::new()
            .current_account_id(owner.clone())
            .predecessor_account_id(user.clone())
            .block_timestamp(1_000_000_000_000)
            .build();
        testing_env!(context);

        let mut contract = VeilXEscrow::new(owner);

        // Freeze
        contract.emergency_freeze(true);
        assert!(contract.get_guardrails(user.clone()).unwrap().is_frozen);

        // Unfreeze
        contract.emergency_freeze(false);
        assert!(!contract.get_guardrails(user.clone()).unwrap().is_frozen);

        // Spend succeeds after unfreeze
        contract.check_and_record_spend(user.clone(), U128(10_000_000));
        assert_eq!(contract.get_guardrails(user).unwrap().spent_today, U128(10_000_000));
    }

    #[test]
    fn test_default_guardrails_for_new_account() {
        let owner: AccountId = "escrow.near".parse().unwrap();
        let user: AccountId = "newuser.near".parse().unwrap();

        let context = VMContextBuilder::new()
            .current_account_id(owner.clone())
            .predecessor_account_id(user.clone())
            .block_timestamp(1_000_000_000_000)
            .build();
        testing_env!(context);

        let mut contract = VeilXEscrow::new(owner);
        assert!(contract.get_guardrails(user.clone()).is_none());

        // Spend with defaults
        contract.check_and_record_spend(user.clone(), U128(15_000_000));
        let g = contract.get_guardrails(user).expect("Guardrails should be initialized with defaults");
        assert_eq!(g.daily_limit, U128(DEFAULT_DAILY_LIMIT));
        assert_eq!(g.weekly_limit, U128(DEFAULT_WEEKLY_LIMIT));
        assert_eq!(g.per_tx_quarantine_max, U128(DEFAULT_PER_TX_MAX));
        assert_eq!(g.spent_today, U128(15_000_000));
        assert_eq!(g.spent_this_week, U128(15_000_000));
        assert!(!g.is_frozen);
    }

    #[test]
    fn test_deposit_near_tip_records_guardrail_spend() {
        let owner: AccountId = "escrow.near".parse().unwrap();
        let sender: AccountId = "tipper.near".parse().unwrap();
        let deposit_amount = 20_000_000_000_000_000_000_000u128; // 0.02 NEAR

        let context = VMContextBuilder::new()
            .current_account_id(owner.clone())
            .predecessor_account_id(sender.clone())
            .attached_deposit(NearToken::from_yoctonear(deposit_amount))
            .block_timestamp(1_000_000_000_000)
            .build();
        testing_env!(context);

        let mut contract = VeilXEscrow::new(owner);

        contract.deposit_near_tip("tip_near_1".to_string(), "recipient_handle".to_string());

        // 0.02 NEAR = 20,000 micro-NEAR * 5 = 100,000 micro-USD ($0.10)
        let expected_usd_spend = U128(100_000);
        let g = contract.get_guardrails(sender).expect("Guardrails should be updated");
        assert_eq!(g.spent_today, expected_usd_spend);
        assert_eq!(g.spent_this_week, expected_usd_spend);
    }
}
