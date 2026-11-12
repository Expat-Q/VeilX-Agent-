# VEILX AGENT — POLICY & RULES FRAMEWORK SPECIFICATION

> **Specification Date:** November 7, 2026  
> **Document:** Complete Policy Specification, Rule Taxonomy, and Enforcement Engine  
> **Target System:** VeilX Autonomous AI Agent (Social APay & Stocks Trading)

---

## 1. Rule Classification Architecture

VeilX divides rules into four strict enforcement tiers:

1. **Platform Mandatory Safeguards (Tier 0 - Immutable):** Hardcoded invariant bounds that neither the user nor the AI can alter or bypass (e.g. self-privilege escalation prevention, destination sanity checks).
2. **User-Configurable Policies (Tier 1 - Sovereign):** User-defined risk boundaries, spending limits, and allowlists adjustable only via master user authentication.
3. **Strategy-Specific Guardrails (Tier 2 - Operational):** Mathematical triggers (e.g. RSI-14 momentum thresholds, DCA intervals, take-profit percentages).
4. **Agent Ephemeral Permissions (Tier 3 - Session):** Scoped session keys with auto-expiring time windows and per-transaction limits.

---

## 2. Comprehensive Policy & Rules Specification Table

| Rule ID | Rule Name | Purpose | Applies To | Default Setting | Configurable? | Enforcement Level | Trigger Point | Required System Behavior | Failure / Rejection Behavior | Approval Req.? | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AUTH-01** | Master Key Non-Custody | Prevent agent from accessing root seed | Both | Active (Always) | **No** | Contract / Keypair | Wallet Connect | Restrict agent key to NEP-366 FunctionCall; refuse FullAccess keys | Block transaction; revoke session | No | **Critical** |
| **AUTH-02** | Ephemeral Session Expiry | Limit exposure of compromised session key | Both | 24 Hours | Yes (1h–7d) | Policy Engine / Cache | Every Request | Verify `Date.now() < session.expiresAt` | Refuse action; trigger "Session Expired" re-login | No | **Critical** |
| **AUTH-03** | Self-Privilege Escalation Barrier | Prevent agent from modifying its own limits | Both | Blocked | **No** | Policy Engine / Smart Contract | Any Policy Write | Reject any policy update signed by agent keypair | Log security violation; alert user | No | **Critical** |
| **FIN-01** | Per-Transaction Spending Cap | Prevent single catastrophic loss | Social APay | $25.00 USD | Yes ($5–$250) | Policy Engine | Pre-Execution | Validate `tx.amountUsd <= policy.maxTxUsd` | Block execution; prompt user for manual co-signature | Yes (if > cap) | **High** |
| **FIN-02** | Rolling 24h Outflow Budget | Limit cumulative daily losses | Social APay | $50.00 USD | Yes ($10–$1,000) | Smart Contract / Ledger | Pre-Execution | Compute `spent24h + newAmount <= policy.dailyCap` | Block execution; display remaining daily budget | Yes | **Critical** |
| **FIN-03** | Idempotency & Duplicate Shield | Prevent replay / double-spend attacks | Social APay | Active | **No** | Policy Engine / Nonce | Inbound Request | Require unique UUID/nonce; cache recent tx hashes for 10m | Drop duplicate request silently | No | **High** |
| **ASSET-01** | Strict Whitelist Enforcement | Prevent trading unverified / scam tokens | Stocks Trading | Curated 28+ Ondo Stocks | Yes (Add/Remove) | Policy Engine / Contract | Pre-Trade | Check `assetAddress in policy.allowedAssets` | Reject order; notify user "Asset not permitted" | No | **Critical** |
| **ASSET-02** | Minimum Stablecoin Buffer | Maintain liquidity floor for withdrawals | Stocks Trading | 15% of Portfolio | Yes (10%–50%) | Policy Engine | Pre-Buy Order | Verify `(cashUsd - orderCost) / totalVal >= minBuffer` | Reject order; require user to inject cash or sell | No | **High** |
| **ASSET-03** | Max Single-Asset Concentration | Prevent over-exposure to single stock | Stocks Trading | 35% of Portfolio | Yes (15%–50%) | Policy Engine | Pre-Buy Order | Check `(posVal + orderCost) / totalVal <= maxConcentration` | Reject order; cap purchase amount | No | **High** |
| **TRADE-01** | Max Single Trade Size | Prevent illiquidity price spikes | Stocks Trading | 15% of Portfolio or $500 | Yes (5%–25%) | Policy Engine | Pre-Trade | Validate `orderVal <= min(totalVal * 0.15, $500)` | Cap trade size or require explicit confirmation | Yes (if > cap) | **High** |
| **TRADE-02** | Order Cooldown Interval | Prevent rapid-fire algorithmic churn | Stocks Trading | 60 Minutes | Yes (15m–240m) | Policy Engine | Pre-Trade | Check `Date.now() - lastTradeTime >= cooldown` | Reject trade; display cooldown countdown | No | **Medium** |
| **TRADE-03** | Max Slippage Tolerance | Protect from MEV sandwiching & thin pools | Stocks Trading | 1.0% Max Slippage | Yes (0.2%–3.0%) | 1Click Solver / Contract | Solver Quote | Validate `quotedSlippage <= policy.maxSlippage` | Abort trade; re-quote or alert user | No | **High** |
| **RISK-01** | Portfolio Stop-Loss Breaker | Prevent cascading drawdown during crashes | Stocks Trading | -10% from High-Water | Yes (-5% to -25%) | Cron / Policy Engine | Market Evaluation | Halt all automated buying if drawdown exceeds limit | Pause autonomous trading; notify user immediately | Yes (to resume)| **Critical** |
| **RISK-02** | Oracle Staleness & Deviation Check | Prevent trading on broken or manipulated feeds| Stocks Trading | 60s freshness; 3% deviation | **No** | Policy Engine | Pre-Order | Compare Defuse quote vs Pyth/Chainlink oracle feed | Abort trade; log "Stale/Divergent Oracle" | No | **Critical** |
| **EMERG-01** | One-Click Global Emergency Pause | Instantly freeze all agent actions | Both | User Triggered | **No** | Smart Contract / Local Session | User Action | Delete local session keys and broadcast contract pause | Agent becomes completely inert immediately | No | **Critical** |
| **EMERG-02** | Key Deletion on Disconnect | Zero lingering authority on logout | Both | Active (Always) | **No** | Client Storage | Auth Logout | Wipe session private keys from IndexedDB/localStorage | Local state cleared completely | No | **Critical** |
| **PRIV-01** | Selective Disclosure Attestation | Protect user net worth from public visibility | Social APay | Active | Yes (Toggle) | Attestation Engine | Receipt Generation | Generate HMAC proof hiding master wallet balance | Issue blinded verification receipt | No | **Medium** |
| **SOC-01** | Prompt Injection Data Barrier | Prevent tweet text from overriding rules | Both | Active (Always) | **No** | AI Gateway / Sanitizer | Prompt Parsing | Strip control characters; isolate external content as raw data | Refuse instruction; treat as plain string | No | **Critical** |
| **SOC-02** | Recipient Impersonation Check | Prevent tipping copycat handles | Social APay | Active | Yes (Strict/Normal) | X API / Subaccount Registry | Inbound Tip | Check recipient account creation date and follower count | Flag warning: "New or Unverified Account" | Yes (if flagged)| **High** |

---

## 3. Critique and Improvement of Grok-Generated Rules

The initial Grok proposal suggested fixed defaults (e.g. NVDA 35%, TSLA 25%, AAPL 20%, USDC 20%, trade size 15% or $500, cooldown 1–4 hours). 

### Identified Loopholes & Corrective Enhancements:

1. **Loophole: Order Splitting Attack**
   - *Grok Flaw:* A single-trade cap of $500 can be bypassed by an agent placing five consecutive $499 trades in 3 minutes.
   - *VeilX Fix:* Pair the single-trade limit with a **rolling 24-hour volume cap** and an enforced **cooldown interval** (`TRADE-02`).

2. **Loophole: Stop-Loss Slippage Illusion**
   - *Grok Flaw:* Assuming a "-5% Stop Loss" guarantees selling at -5%. In a market gap or illiquid pool, market orders can fill at -20%.
   - *VeilX Fix:* Require a **maximum slippage tolerance** (`TRADE-03`). If price execution deviates beyond acceptable tolerance, order halts and prompts human co-signature.

3. **Loophole: Stale Portfolio Valuation**
   - *Grok Flaw:* Sizing orders as a percentage of total portfolio when price feeds are delayed.
   - *VeilX Fix:* Mandatory oracle freshness check (`RISK-02`) before any proportional position calculation.
