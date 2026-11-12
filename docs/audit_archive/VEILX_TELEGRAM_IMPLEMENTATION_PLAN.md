# VEILX AGENT — TELEGRAM BOT REMEDIATION & USER JOURNEY BLUEPRINT

**Document Version:** 1.0.0  
**Status:** DRAFT — AWAITING USER APPROVAL (PLANNING ONLY)  
**Date:** November 2, 2026  
**Target:** `src/lib/telegram-bot.ts`, `src/app/api/telegram/webhook/route.ts`  
**Bot Protocol:** Telegram Bot API v7.0+ (Webhook Mode)

---

## 1. COMPLETE STEP-BY-STEP USER JOURNEY

```
[STEP 1: DISCOVERY & START]
User searches @VeilXAgentBot on Telegram -> Clicks "Start" -> Bot sends /start.

[STEP 2: GREETING & INTENT OVERVIEW]
Bot responds with brand card:
"🤖 Welcome to VeilX Omnichain Copilot!
Turn your Telegram chat into a non-custodial crypto terminal powered by NEAR Protocol.
Your auto-provisioned subaccount: tg_123456.veilx-agent.testnet"

[STEP 3: SECURE ACCOUNT LINKING (/link)]
User types /link -> Bot generates single-use 10-minute deep link:
"🔗 Click here to link your 𝕏 account: https://veilx.app/auth/telegram?token=eyJhbGci..."
User opens link in browser, signs in with Twitter -> Telegram ID is bound to @handle.

[STEP 4: FINANCIAL OPERATIONS]
• Create Invoice: /invoice 0.05 NEAR Website Audit -> Returns 1-Click Pay link & QR.
• Send Tip: /tip @expatq3 0.1 NEAR -> Returns interactive web authorization card.
• Check Balance: /evm or /balance -> Displays live NEAR & Base Sepolia balances.

[STEP 5: NOTIFICATIONS]
When someone pays an invoice created via Telegram, bot alerts creator:
"🎉 Payment Settled! @payer paid $25.00 for Website Audit. Tx: abc...123"

[STEP 6: DISCONNECTION (/unlink)]
User types /unlink -> Confirms -> Account mapping is revoked; reverts to guest subaccount.
```

---

## 2. CANONICAL COMMAND INVENTORY & SYNTAX

| Command | Exact Syntax | Required Arguments | Authorization | Backend Handler | Expected Response | Failure Message |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| `/start` | `/start [payload]` | Optional deep-link payload | Public | `handleTelegramMessage` | Rich intro card + inline buttons | Invalid token message |
| `/help` | `/help` | None | Public | `handleTelegramMessage` | Command syntax guide & examples | None |
| `/link` | `/link` | None | Public | `/api/auth/telegram/link` | Single-use 10-min WebApp URL | Rate limit notice |
| `/unlink` | `/unlink` | None | Linked User | `TelegramUser.deleteOne` | Confirmed unlinking message | "Not linked" |
| `/evm` | `/evm` | None | Public | `deriveEvmAddress` | Derived 0x address + BaseScan link | Derivation error |
| `/balance`| `/balance` | None | Public | `/api/evm/balance` | Omnichain NEAR + Base breakdown | RPC fetch failure |
| `/invoice`| `/invoice <amt> [asset] [memo]`| `<amount>` | Public | `PayLink.create` | PayLink URL + 1-Click Pay button | "Invalid amount" |
| `/tip` | `/tip @<handle> <amt> [asset]` | `@handle`, `<amount>` | Public | `resolveIntentValue` | Sign & send web authorization link | "Missing handle" |
| `/history`| `/history` | None | Linked User | `Transaction.find` | Last 5 transaction summaries | "No transactions" |

---

## 3. TELEGRAM SECURITY & WEBHOOK PROTECTION SPECIFICATION

### 3.1 Webhook Secret Verification (`TASK-TG-01`)
- Telegram sends header `X-Telegram-Bot-Api-Secret-Token`.
- In `src/app/api/telegram/webhook/route.ts`:
  ```ts
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  ```

### 3.2 Duplicate Update Deduplication
- Cache incoming `update_id`s in a sliding window set for 10 minutes.
- If an update with an identical `update_id` arrives, return HTTP 200 immediately (`{ ok: true, duplicate: true }`) without re-executing database writes.

### 3.3 Public Group Chat Information Shielding (`TASK-TG-04`)
- Check `message.chat.type === "private"`.
- If invoked in a group with commands `/balance`, `/evm`, `/pay`, respond:
  *"🔒 For your financial privacy, sensitive balances can only be viewed in a direct message with @VeilXAgentBot."*
