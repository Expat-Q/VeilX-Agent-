# VEILX AGENT — SECURITY REMEDIATION PROGRAM & THREAT MODEL

**Document Version:** 1.0.0  
**Status:** DRAFT — AWAITING USER APPROVAL (PLANNING ONLY)  
**Date:** November 2, 2026  
**Classification:** Confidential Security Architecture & Vulnerability Mitigation

---

## 1. VULNERABILITY CATALOG & REMEDIATION MATRIX

```
+----------------------------------------------------------------------------------------------------+
|                                    THREAT MODEL & ATTACK VECTORS                                   |
|                                                                                                    |
|  [External Attacker]                                                                               |
|       │                                                                                            |
|       ├──► Attack 1: Inject raw JSON cookie {"xHandle":"admin"} ──► BYPASSES HMAC SIGNATURE       |
|       │    [Mitigation: TASK-SEC-01 - Purge .startsWith("{") bypass]                               |
|       │                                                                                            |
|       ├──► Attack 2: POST /api/user with victim handle ──────────► STEALS ACCOUNT & WALLET         |
|       │    [Mitigation: TASK-SEC-02 - Enforce Twitter OAuth PKCE guard on updates]                 |
|       │                                                                                            |
|       ├──► Attack 3: PATCH /api/paylinks with fake txHash ───────► MARKS INVOICE PAID FOR FREE     |
|       │    [Mitigation: TASK-SEC-03 - Verify on-chain RPC receipt status]                          |
|       │                                                                                            |
|       ├──► Attack 4: Call /api/telegram/webhook directly ────────► SPOOFS TELEGRAM MESSAGES        |
|       │    [Mitigation: TASK-TG-01 - Verify X-Telegram-Bot-Api-Secret-Token header]                |
|       │                                                                                            |
|       ├──► Attack 5: Multi-device concurrent tipping ────────────► EXCEEDS $50 DAILY SPENDING CAP |
|       │    [Mitigation: TASK-BACK-01 - Enforce atomic server-side $inc spentUsd]                   |
|       │                                                                                            |
|       └──► Attack 6: Intercept HTTP traffic on /api/near/send-tip► STEALS Ed25519 PRIVATE KEY      |
|            [Mitigation: TASK-SEC-05 - Refactor to client-side NEP-366 signing]                     |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. IN-DEPTH VULNERABILITY DOSSIERS

### Finding ID: SEC-AUTH-01
- **Severity:** **P0 — Critical**
- **Vulnerability:** Unauthenticated Session Minting via Raw JSON Cookie Bypass.
- **Root Cause:** Legacy test clause in `src/lib/session.ts`: `if (token.startsWith("{")) return JSON.parse(token);`.
- **Realistic Attack Scenario:** Attacker opens browser DevTools, creates cookie `veilx_session={"xHandle":"expatq3","nearAccountId":"expatq3-main.veilx-agent.testnet"}`, and refreshes page. Attacker is now authenticated as `@expatq3` and can call `/api/relay/claim` to drain pending escrow tips.
- **Required Fix:** Delete lines 17–20 of `src/lib/session.ts`. Enforce base64url HMAC-SHA256 signature verification.
- **Affected Files:** `src/lib/session.ts`
- **Verification Test:** `verifySessionToken('{"xHandle":"victim"}')` returns `null`.
- **Residual Risk:** None after signature enforcement.

---

### Finding ID: SEC-USER-01
- **Severity:** **P0 — Critical**
- **Vulnerability:** Unauthenticated User Profile Overwrite & Cookie Generation.
- **Root Cause:** Missing authentication middleware on `POST /api/user`.
- **Realistic Attack Scenario:** Attacker sends `curl -X POST /api/user -d '{"xHandle":"victim","nearAccountId":"attacker.testnet"}'`. Endpoint updates MongoDB and returns a signed HTTP-only cookie for the victim's account.
- **Required Fix:** Verify caller's authenticated session cookie matches `xHandle`, or require a signed cryptographic challenge from the user's private key.
- **Affected Files:** `src/app/api/user/route.ts`
- **Verification Test:** Unauthenticated POST to `/api/user` returns HTTP 401.
- **Residual Risk:** Zero; account binding requires OAuth identity.

---

### Finding ID: SEC-PAY-01
- **Severity:** **P0 — Critical**
- **Vulnerability:** Unverified Invoice Settlement & History Spoofing.
- **Root Cause:** `PATCH /api/paylinks` does not verify `settledTx` on NEAR RPC.
- **Realistic Attack Scenario:** Payer opens `/pay/inv_123` for a $500 invoice, issues a direct `PATCH` request with `settledTx: "fake_hash_999"`. The backend marks the invoice settled and sends a Telegram celebration message to the seller without any on-chain transfer.
- **Required Fix:** Query NEAR RPC with `provider.txStatus(settledTx)`. Confirm transaction succeeded and deposit matches invoice before marking settled.
- **Affected Files:** `src/app/api/paylinks/route.ts`
- **Verification Test:** Patching with fake hash returns 400; real hash returns 200.
- **Residual Risk:** Eventual finality delay; mitigated by checking final block inclusion.

---

### Finding ID: SEC-KEY-01
- **Severity:** **P1 — High**
- **Vulnerability:** Transmission of Raw Private Key Over HTTP.
- **Root Cause:** Frontend sends `senderPrivateKey` in JSON body to `/api/near/send-tip`.
- **Realistic Attack Scenario:** Server logs request body or proxy inspects payload, exposing user's active session key.
- **Required Fix:** Sign transaction binary on client in browser using `@near-js/transactions` and send only pre-signed `SignedTransaction` over network.
- **Affected Files:** `src/app/api/near/send-tip/route.ts`, `src/lib/near-embedded-wallet.ts`.
- **Verification Test:** Network inspector confirms request contains zero private keys.
- **Residual Risk:** Client-side XSS if malicious scripts run; mitigated by Content Security Policy.

---

## 3. SAFE SECRET PROVISIONING & ROTATION PROCEDURES

### Rules:
1. **Never commit secrets to git**: `.env.local` is listed in `.gitignore`.
2. **Never log secrets**: Strip `privateKey`, `secret`, `password`, `token` from `console.log` statements.
3. **KMS / Environment Storage**: In production deployments (Render / Vercel), inject `ESCROW_PRIVATE_KEY` and `SESSION_SECRET` via encrypted environment variable vaults.
4. **Relayer Key Rotation**:
   - To rotate `ESCROW_PRIVATE_KEY`:
     1. Generate new Ed25519 keypair.
     2. Call `add_key` on `veilx-agent.testnet` adding new public key.
     3. Update `ESCROW_PRIVATE_KEY` in deployment environment.
     4. Verify relayer claims succeed.
     5. Delete old access key from contract account.

---

## 4. PUBLIC TESTNET PRE-RELEASE SECURITY CHECKLIST

- [ ] HMAC signature verification strictly enforced on all cookies (`TASK-SEC-01`).
- [ ] Profile updates restricted to Twitter OAuth authenticated sessions (`TASK-SEC-02`).
- [ ] On-chain RPC verification required for invoice settlement (`TASK-SEC-03`).
- [ ] Hardcoded crypto addresses purged from PayLink checkout (`TASK-SEC-04`).
- [ ] Raw private keys eliminated from HTTP request bodies (`TASK-SEC-05`).
- [ ] Spending caps enforced atomically in backend database (`TASK-BACK-01`).
- [ ] Telegram webhook verified via `X-Telegram-Bot-Api-Secret-Token` (`TASK-TG-01`).
- [ ] Contract relayer override removed from recipient validation (`TASK-SC-01`).
- [ ] Native NEAR transfer resolve callback attached in smart contract (`TASK-SC-02`).
- [ ] Rate limits enforced persistently via MongoDB TTL index (`TASK-BACK-03`).
