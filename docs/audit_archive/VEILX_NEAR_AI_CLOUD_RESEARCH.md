# VEILX AGENT — NEAR AI CLOUD RESEARCH & INTEGRATION SPECIFICATION

**Document Version:** 1.0.0  
**Status:** COMPLETE RESEARCH SPECIFICATION  
**Subject:** NEAR AI Cloud (`api.near.ai`), Confidential Compute & TEE Inference  
**Date:** November 2026  

---

## 1. UNDERSTANDING NEAR AI CLOUD

### 1.1 What Is NEAR AI Cloud?
NEAR AI Cloud (`https://cloud.near.ai` / `https://api.near.ai`) is a decentralized, confidential AI inference and agent execution platform developed under the NEAR Protocol ecosystem's User-Owned AI initiative.

Unlike commercial AI providers (OpenAI, Google Gemini, Anthropic) who log user inputs, retain prompt context for model retraining, and operate closed data centers, NEAR AI Cloud runs models inside **hardware-enforced Trusted Execution Environments (TEEs)** utilizing **Intel TDX** (CPU-level enclaves) and **NVIDIA H100 Confidential Computing** (GPU-level enclaves).

### 1.2 Core Capabilities & Architecture

```
+-----------------------------------------------------------------------------------------+
|                                    VEILX CLIENT / BACKEND                               |
|                     (Sends OpenAI-Compatible REST Payloads via HTTPS)                   |
+-----------------------------------------------------------------------------------------+
                                             │
                        Authorization: Bearer sk-near-ai-...
                                             ▼
+-----------------------------------------------------------------------------------------+
|                                 NEAR AI CLOUD ROUTER / GATEWAY                          |
|  - Validates API Key or NEAR Account Signature Challenge                                |
|  - Routes to verified hardware nodes running confidential VMs                           |
+-----------------------------------------------------------------------------------------+
                                             │
                                             ▼
+-----------------------------------------------------------------------------------------+
|                        TRUSTED EXECUTION ENVIRONMENT (TEE) ENCLAVE                      |
|                           [Intel TDX / NVIDIA H100 Hardware]                            |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   |  - Memory is fully encrypted at the hardware level (AES-128 / AES-256)           |   |
|   |  - Neither node operators, cloud providers, nor OS admins can view RAM state   |   |
|   |  - Zero disk logging of prompt data or model activation weights                 |   |
|   |  - Produces cryptographic Remote Attestation Report proving code integrity      |   |
|   +---------------------------------------------------------------------------------+   |
|                                             │                                           |
|                                             ▼                                           |
|                           OPEN-WEIGHT FOUNDATION MODELS RUNNING                         |
|             (Llama 3.3 70B Instruct, Qwen 2.5 72B, DeepSeek V3 / R1, Mistral)           |
+-----------------------------------------------------------------------------------------+
```

### 1.3 Key Technical Specifications
* **API Protocol**: Full drop-in compatibility with the OpenAI REST API format:
  * `POST /v1/chat/completions` (supports streaming SSE, function-calling/tools, and JSON mode).
  * `POST /v1/completions` (raw text generation).
  * `GET /v1/models` (dynamic catalog of active confidential models).
* **Authentication Mechanisms**:
  1. **Programmatic API Keys (`sk-...`)**: Standard bearer token authorization for backend services.
  2. **JWT Access Tokens**: Exchanged from refresh tokens (`rt-...`) via `POST /users/me/access_tokens`.
  3. **On-Chain NEAR Wallet Challenge**: Cryptographic signature verification using a NEAR account keypair, enabling decentralized token-gated or usage-billed access.
* **Confidentiality Guarantees**:
  * **Memory Encryption**: CPU and GPU RAM are hardware-encrypted. Memory dumps by host hypervisors yield only ciphertext.
  * **Zero Retention**: Prompts and completions exist strictly in volatile enclave memory during inference and are wiped immediately upon socket closure.
  * **Verifiable Attestation**: Every inference batch can be paired with an Intel/NVIDIA attestation proof signed by the hardware manufacturer root-of-trust.

---

## 2. VEILX AGENT USE CASES

### 2.1 Private Financial Intent Parsing & Invoicing
* **Problem with Commercial LLMs (Gemini/OpenAI)**: When a user says: *"Invoice @alice for $15,000 corporate security audit on Base"*, commercial providers log this invoice detail, counterparty name, and financial amount into corporate telemetry pipelines.
* **With NEAR AI Cloud**: Prompt execution occurs inside a confidential TEE. The financial relationship, invoice description, and counterparty handles remain strictly confidential between the user and VeilX.

### 2.2 Confidential Multi-Step Tool Execution
VeilX's financial agent performs autonomous tool calls (`create_invoice`, `direct_transfer`, `execute_intent`, `check_balance`). NEAR AI Cloud natively supports JSON tool definitions:
```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "create_invoice",
        "description": "Generate an on-chain paylink for social settlement",
        "parameters": {
          "type": "object",
          "properties": {
            "amount": { "type": "number" },
            "asset": { "type": "string" },
            "memo": { "type": "string" }
          },
          "required": ["amount", "asset"]
        }
      }
    }
  ]
}
```

### 2.3 Financial Health Summaries & Audit Analysis
VeilX Agent can ingest past transaction history and summarize spending, pending escrows, and claim deadlines without risk of financial profile leakage to third-party ad networks.

---

## 3. COMPARISON: GOOGLE GEMINI 2.5 FLASH VS. NEAR AI CLOUD

| Criterion | Google Gemini 2.5 Flash (Current) | NEAR AI Cloud (Evaluated) | Advantage / Evaluation |
|---|---|---|---|
| **Data Privacy & Confidentiality** | ❌ None. Data subject to Google Terms of Service & enterprise logging. | ✅ **Hardware Enclave Guaranteed** (Intel TDX / NVIDIA Confidential Computing). Zero retention. | **NEAR AI Cloud (Decisive)** |
| **Inference Latency** | ⚡ **Ultra-Fast (200ms–600ms)** for conversational turns. | ⏱ **Moderate (600ms–1800ms)** depending on model size (e.g. Llama 3.3 70B). | **Gemini (Current)** |
| **Model Intelligence / Reasoning** | Highly capable general model with native multi-modal support. | State-of-the-art open models (Llama 3.3 70B, Qwen 2.5 72B, DeepSeek R1). | **Tied / Comparable** |
| **Tool Calling Reliability** | High fidelity with strict schema compliance. | Standard OpenAI function-calling format with strong JSON adherence. | **Tied** |
| **Ecosystem & Web3 Native** | Web2 corporate cloud. No native NEAR integration. | Native NEAR ecosystem project; accepts NEAR billing & wallet authentication. | **NEAR AI Cloud** |
| **Operational Reliability / SLA** | 99.9% uptime backed by Google Cloud infrastructure. | Growing decentralized infrastructure; occasional cold starts on new enclave spins. | **Gemini (Current)** |
| **Vendor Independence** | Proprietary lock-in. Vulnerable to API key revocation or policy bans. | Open-weight models running on decentralized compute nodes. | **NEAR AI Cloud** |

---

## 4. INTEGRATION ARCHITECTURE: THE HYBRID ROUTER

Replacing Google Gemini entirely would degrade the sub-second UI responsiveness that makes the VeilX chat interface feel instantaneous. Therefore, the optimal architecture is a **Hybrid Intelligent Routing Gateway**:

```
                                  [Incoming User Message]
                                             │
                                             ▼
                       +-------------------------------------------+
                       |        VeilX Intent Classifier Gateway     |
                       +-------------------------------------------+
                                             │
                        Is this a sensitive financial instruction?
                       (Invoices, transfers, balance audits, tips)
                                             │
                      ┌──────────────────────┴──────────────────────┐
                      ▼ YES                                         ▼ NO
        +-------------------------------+             +-------------------------------+
        |        NEAR AI CLOUD          |             |       GOOGLE GEMINI FLASH     |
        |  - Hardware TEE Enclave       |             |  - Sub-second UI conversations|
        |  - Zero Data Retention        |             |  - General app FAQ & greetings|
        |  - Tool Calling Execution     |             |  - Help documentation routing |
        +-------------------------------+             +-------------------------------+
                      │                                             │
                      └──────────────────────┬──────────────────────┘
                                             ▼
                                [Unified Chat Response UI]
```

### 4.1 Implementation Code Pattern (`src/lib/ai-gateway.ts`)

Because NEAR AI Cloud uses the OpenAI-compatible standard, integrating it requires zero heavy SDKs:
```typescript
// Proposed Dual-Gateway in src/lib/ai-gateway.ts
const NEAR_AI_BASE = "https://api.near.ai/v1";
const NEAR_AI_KEY = process.env.NEAR_AI_API_KEY;

export async function processSensitiveFinancialMessage(prompt: string, history: any[]) {
  if (!NEAR_AI_KEY) {
    // Graceful fallback to Gemini if key is not configured
    return processWithGemini(prompt, history);
  }

  const response = await fetch(`${NEAR_AI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${NEAR_AI_KEY}`
    },
    body: JSON.stringify({
      model: "meta-llama/Llama-3.3-70B-Instruct",
      messages: [
        { role: "system", content: "You are VeilX Confidential Financial Copilot..." },
        ...history,
        { role: "user", content: prompt }
      ],
      tools: REGISTERED_VEILX_TOOLS,
      temperature: 0.2
    })
  });

  return await response.json();
}
```

---

## 5. STRATEGIC RECOMMENDATION

### Verdict: CATEGORY B (Integrate in Phase 3 after Core Launch)
NEAR AI Cloud is a major technological differentiator for VeilX. 

### Recommended Strategy:
1. **Do not discard Gemini today**: Gemini's sub-second latency is critical for conversational feel during live demos and testnet evaluation.
2. **Implement as a Privacy-Tier Feature**: Introduce NEAR AI Cloud as an opt-in or automatic *"Confidential AI Mode"* for transaction execution, positioning VeilX as the first social terminal with hardware-attested, private financial reasoning.
