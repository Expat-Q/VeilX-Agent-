# VEILX AGENT — ON-CHAIN PRIVACY, SHIELDED TRANSACTIONS & CRYPTOGRAPHIC RESEARCH

**Document Version:** 1.0.0  
**Status:** COMPLETE RESEARCH SPECIFICATION  
**Subject:** Privacy Primitives, Shielded Payments, Zero-Knowledge Proofs & Stealth Architecture on NEAR  
**Date:** November 2026  

---

## 1. NEAR PROTOCOL BASELINE PRIVACY MODEL: WHAT IS VISIBLE?

To design a credible privacy architecture, one must confront the foundational reality of the underlying protocol:

> **NEAR Protocol is an open, globally transparent public ledger.**

### 1.1 Complete Ledger Transparency
On ordinary NEAR Protocol transactions (including native transfers, smart contract calls, and NEP-141 fungible token interactions), the following data is permanently written to the blockchain, verified by validators, and indexed by block explorers (NEARBlocks, NEAR Lake Indexer, FastNEAR):

1. **Sender Account ID**: The exact human-readable account (e.g. `alice.near` or `expatq3.veilx-agent.testnet`).
2. **Receiver / Contract Account ID**: The target contract (e.g. `veilx-agent.testnet`).
3. **Transaction Method Name**: The contract function invoked (e.g. `deposit_near` or `claim_tip`).
4. **Method Arguments**: The exact JSON/Borsh payload passed in the call (e.g. `{"recipient_handle": "bob"}`). Anyone can parse the recipient Twitter handle directly from the explorer!
5. **Transferred Deposit**: The exact amount of native NEAR or NEP-141 tokens attached.
6. **Gas Burned & Tokens Used**: Precise transaction computational cost.
7. **Execution Receipts & Predecessor IDs**: Complete execution graph across cross-contract calls.
8. **Emitted Events**: Standard NEP-297 event logs broadcast to all indexers.
9. **Smart Contract Storage State**: Every key-value pair stored in contract trie storage is publicly readable by anyone running a view call or inspecting the state trie.

### 1.2 Common Misconceptions Disentangled

| Category | What It Actually Does | What It DOES NOT Do |
|---|---|---|
| **Off-Chain Database Encryption** | Protects data in MongoDB at rest. | Does not hide anything submitted to the NEAR blockchain. |
| **Confidential Computing (TEEs)** | Keeps code and prompts private inside server RAM during execution. | Does not hide transactions broadcast from the TEE to the public blockchain. |
| **Relayers / Meta-Transactions (NEP-366)** | Hides the user's gas payment (relayer pays gas). | Does not hide the `sender_id`, recipient, amount, or action payload inside the `DelegateAction`. |
| **Chain Signatures MPC** | Generates valid foreign signatures (e.g. Ethereum) from NEAR. | Does not make the resulting Ethereum or Base transaction private. |
| **Zero-Knowledge Proofs (zk-SNARKs)** | Proves validity of a statement without revealing secret inputs (e.g. nullifiers, note commitments). | Requires specialized smart contract verifiers; computationally intensive. |

---

## 2. EVALUATION OF PRIVACY TECHNOLOGIES FOR NEAR

### 2.1 Technology Assessment Matrix

| Technology | Availability on NEAR Today | Architectural Fit for VeilX | Engineering Complexity | Trade-offs & Limitations |
|---|---|---|---|---|
| **Client-Side Metadata Encryption (AES-GCM / ECIES)** | ✅ **Available Immediately** (Standard Web Crypto API) | **High**: Encrypts invoice notes, memos, and counterparty communications. | **Low** | Only hides off-chain metadata. On-chain transfers remain visible. |
| **Ephemeral Subaccounts / Stealth Claim Accounts** | ✅ **Available Immediately** via NEAR subaccount factory | **High**: Breaks the public link between user's primary social handle and recipient wallet. | **Moderate** | Subaccount creation requires ~0.00125 NEAR storage stake per account. |
| **Dual-Key Stealth Addresses (DKSAP / ERC-5564 equivalent)** | ⚠️ **Possible via Custom Contract** (Secp256k1 / Ed25519 DH) | **High**: Generates single-use destination addresses on NEAR without recipient coordination. | **High** | Recipient must scan blockchain receipts to detect incoming payments; higher mobile battery drain. |
| **ZK Shielded Pools (zk-SNARK Merkle Nullifier Trees)** | ⚠️ **Ecosystem Prototype** (e.g. HideYour.cash / Circom verifiers) | **High for Privacy, Low for Compliance**: Breaks deposit/withdrawal link. | **Very High** | High gas for on-chain Groth16 verification; regulatory scrutiny (mixer classification). |
| **Calimero Network (Private App Shards)** | ⚠️ **Production Ecosystem Partner** (Peer-to-peer WASM contexts) | **High**: Allows private multi-party financial state with periodic ZK settlement to NEAR. | **High** | Requires running Calimero contextual nodes; distinct SDK. |
| **Confidential Smart Contracts (FHE / Private State)** | ❌ **Experimental / Unavailable** on native NEAR L1. | Not ready for production. | **Extreme** | Fully Homomorphic Encryption (FHE) is still computationally impractical for low-latency social terminals. |

---

## 3. THE 5-LEVEL VEILX PRIVACY FRAMEWORK

VeilX's privacy requirements can be categorized into five progressive tiers. Each level represents an escalation in privacy guarantees and architectural complexity:

```
+───────────────────────────────────────────────────────────────────────────+
| LEVEL 5: FULL SHIELDED TRANSACTION PRIVACY                                |
| (zk-SNARK UTXO Pool: Sender, Recipient, and Amount hidden from all)       |
+───────────────────────────────────────────────────────────────────────────+
                                      ▲
+───────────────────────────────────────────────────────────────────────────+
| LEVEL 4: AMOUNT PRIVACY                                                   |
| (Pedersen Commitments / Homomorphic Balances: Amounts hidden on-chain)    |
+───────────────────────────────────────────────────────────────────────────+
                                      ▲
+───────────────────────────────────────────────────────────────────────────+
| LEVEL 3: RECIPIENT & GRAPH PRIVACY (STEALTH CLAIM ACCOUNTS)               |
| (Ephemeral Subaccounts: Disconnects Twitter Social Graph from Wallet ID)  |
+───────────────────────────────────────────────────────────────────────────+
                                      ▲
+───────────────────────────────────────────────────────────────────────────+
| LEVEL 2: PAYMENT METADATA PRIVACY                                         |
| (Hash-Only On-Chain Commitments: Raw handles/memos removed from contract) |
+───────────────────────────────────────────────────────────────────────────+
                                      ▲
+───────────────────────────────────────────────────────────────────────────+
| LEVEL 1: APPLICATION METADATA PRIVACY                                     |
| (Client-Side E2E Encryption: Memos and notes encrypted with user keys)   |
+───────────────────────────────────────────────────────────────────────────+
```

### 3.1 Level 1: Application Metadata Privacy (ACHIEVABLE IMMEDIATELY)
* **Goal**: Hide invoice notes, payment memos, line items, and counterparty chats from database administrators and network snoopers.
* **Mechanism**: Use the user's browser-derived session key to perform **AES-256-GCM** encryption on all memo fields *before* transmission to `POST /api/paylinks` or storage in MongoDB.
* **Key Derivation**: The encryption key is derived via HKDF from the user's NEP-366 session private key. The server stores only ciphertext (`iv`, `tag`, `data`). Only the invoice creator and the recipient (with the shared viewing secret) can decrypt the invoice contents.

### 3.2 Level 2: Payment Metadata Privacy (ACHIEVABLE IMMEDIATELY IN CONTRACT)
* **Current Flaw in `veilx-escrow`**: The contract method is `deposit_near(recipient_handle: String)`. The plaintext string `"@alice"` is permanently stamped on-chain. Anyone querying NEARBlocks can track every tip sent to `@alice`.
* **Remediation**: Replace plaintext handles with a **SHA-256 / Blake2b Commitment Hash**:
  $$\text{Commitment} = \text{Hash}(\text{recipient\_handle} \parallel \text{salt})$$
* The smart contract stores only the 32-byte commitment. During claim, the claimant provides the handle and salt, which the contract verifies against the commitment before releasing funds. On-chain observers see only random hashes.

### 3.3 Level 3: Recipient & Transaction Graph Privacy (ACHIEVABLE VIA FACTORY)
* **Goal**: Prevent blockchain analytics firms from linking a user's real Twitter identity to their long-term NEAR or EVM wallet address.
* **Mechanism: Ephemeral Stealth Subaccounts**:
  1. When `@alice` requests a payout or claims a tip, VeilX's factory generates a single-use deterministic subaccount: `claim-8931a.veilx-agent.testnet`.
  2. The escrow contract settles the tip into `claim-8931a.veilx-agent.testnet`.
  3. From there, funds can be routed into an external exchange, swapped across chains via NEAR Intents, or withdrawn in cash, without ever publishing Alice's primary master account on the escrow ledger.

### 3.4 Level 4 & 5: Amount Privacy & Full Shielded Pools (FUTURE RESEARCH / POC)
* **Amount Privacy**: Requires homomorphic encryption or Pedersen commitments on amounts ($\text{Commitment} = r \cdot G + v \cdot H$). While theoretically possible on NEAR via custom Rust contracts using the `curve25519-dalek` or `arkworks` libraries, verifying range proofs (Bulletproofs) consumes substantial gas.
* **Full Shielded Pool**: To achieve Zcash-level privacy (where sender, receiver, and amount are all shielded), VeilX would deploy a **zk-SNARK Shielded Pool** contract on NEAR (similar to Tornado Cash or HideYour.cash). 
  * Deposits insert a leaf into a fixed-depth Merkle tree (depth 20).
  * Withdrawals provide a Groth16 zk-SNARK proof verifying membership in the tree and revealing a nullifier to prevent double-spending.
  * *Trade-off*: Generating Groth16 proofs in browser JavaScript takes 4–12 seconds on mobile devices and requires downloading an 8MB proving key (`proving_key.bin`).

---

## 4. PROPOSED VEILX PRAGMATIC PRIVACY ARCHITECTURE

To deliver immediate commercial value without compromising transaction speed or mobile UX, VeilX should adopt a **Three-Pillar Pragmatic Privacy Model**:

```
+─────────────────────────────────────────────────────────────────────────────────────────+
|                                    VEILX CLIENT                                         |
|  1. Encrypts memo using AES-256-GCM: E(memo, sharedKey)                                 |
|  2. Computes recipient commitment: Hash(recipientHandle || secretSalt)                  |
+─────────────────────────────────────────────────────────────────────────────────────────+
                                             │
                                             ▼
+─────────────────────────────────────────────────────────────────────────────────────────+
|                            VEILX ESCROW SMART CONTRACT (NEAR)                           |
|  - Stores: { tip_id, commitment: 0x8931..., amount: 5.0 NEAR, status: Pending }         |
|  - Notice: Zero plaintext Twitter handles or invoice memos on-chain!                    |
+─────────────────────────────────────────────────────────────────────────────────────────+
                                             │
                       Claim Request         │
                       (Proves Knowledge of Salt)
                                             ▼
+─────────────────────────────────────────────────────────────────────────────────────────+
|                           EPHEMERAL STEALTH DISBURSEMENT                                |
|  - Escrow releases funds to a fresh, unlinked subaccount: claim-xyz.veilx-agent.testnet|
|  - Or disperses directly via NEAR Intents cross-chain to an unlinked 0x address         |
+─────────────────────────────────────────────────────────────────────────────────────────+
```

### 4.1 Security & Compliance Balance
By keeping the privacy boundaries focused on **Metadata Encryption + Commitment Hashing + Ephemeral Claim Routing**, VeilX achieves:
1. **Zero Public Leakage of Social Handles**: Protects users from targeted extortion and public surveillance.
2. **Regulatory & Audit Compatibility**: Unlike mixer protocols that are subject to regulatory crackdowns, VeilX remains a non-custodial social escrow with optional viewing keys for legitimate compliance disclosures.
3. **Sub-Second Performance**: Zero client-side ZK-proving latency; operates seamlessly on low-powered mobile devices.

---

## 5. STRATEGIC PRIVACY ROADMAP

| Phase | Milestone | Deliverable | Complexity | Target Status |
|---|---|---|---|---|
| **Phase 1** | Immediate | Level 1: Client-side AES-256 metadata encryption for invoices and memos. | Low | **Category A (Ready)** |
| **Phase 2** | Smart Contract Upgrade | Level 2: Commitment hashing (`Hash(handle || salt)`) in `veilx-escrow/src/lib.rs`. | Moderate | **Category A (Ready)** |
| **Phase 3** | Account Factory | Level 3: Ephemeral single-use subaccount claims to unlink social identity. | Moderate | **Category B (Post-Core)** |
| **Phase 4** | Research Prototype | Level 5: Proof-of-Concept integration with HideYour.cash zk-SNARK pool. | High | **Category C (Prototype)** |
