// src/app/api/near/faucet/route.ts
// VeilX Testnet Faucet: Dispenses free testnet NEAR for onboarding & testing
import { NextRequest, NextResponse } from "next/server";
import * as nearAPI from "near-api-js";
import { sanitizeNearAccountId } from "@/lib/near-utils";
import { checkRateLimit } from "@/lib/rate-limiter";

const TESTNET_RPC = process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://test.rpc.fastnear.com";
const CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "veilx-agent.testnet";
const ESCROW_PRIVATE_KEY = process.env.ESCROW_PRIVATE_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let targetAccount = (body.targetAccount || body.accountId)?.trim();

    if (!targetAccount) {
      return NextResponse.json(
        { error: "targetAccount or accountId is required (e.g. alice.testnet)" },
        { status: 400 }
      );
    }

    // Normalize legacy `.veilx.testnet` to our real on-chain parent `.veilx-agent.testnet`
    if (targetAccount.toLowerCase().endsWith(".veilx.testnet")) {
      targetAccount = targetAccount.replace(/\.veilx\.testnet$/i, ".veilx-agent.testnet");
    }

    // Sanitize if account starts with '_' or contains invalid separators
    if (targetAccount.startsWith("_") || targetAccount.includes("..")) {
      const cleanPrefix = targetAccount.split(".")[0];
      targetAccount = sanitizeNearAccountId(cleanPrefix);
    }

    // Task T-1.3: Rate Limiting & Treasury Drain Protection
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

    const ipLimit = checkRateLimit(`faucet_ip_${ip}`, { limit: 15, windowMs: 60 * 60 * 1000 });
    if (!ipLimit.allowed) {
      const waitMinutes = Math.ceil(ipLimit.resetMs / 60000);
      return NextResponse.json(
        { error: `Faucet rate limit reached for this IP. Please try again in ${waitMinutes} minute(s).` },
        { status: 429 }
      );
    }

    const accountLimit = checkRateLimit(`faucet_acc_${targetAccount.toLowerCase()}`, {
      limit: 4,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!accountLimit.allowed) {
      const waitHours = Math.ceil(accountLimit.resetMs / 3600000);
      return NextResponse.json(
        {
          error: `Account ${targetAccount} has reached the daily faucet limit. Please try again in ${waitHours} hour(s) or visit faucet.testnet.near.org.`,
        },
        { status: 429 }
      );
    }

    if (!ESCROW_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Server relayer key is not configured" },
        { status: 500 }
      );
    }

    const provider = new nearAPI.JsonRpcProvider({ url: TESTNET_RPC });
    const keyPair = nearAPI.KeyPair.fromString(ESCROW_PRIVATE_KEY as any);
    const signer = new nearAPI.KeyPairSigner(keyPair);
    const account = new nearAPI.Account(CONTRACT_ID, provider, signer);

    const faucetAmount = "0.25"; // 0.25 NEAR per request
    const yocto = nearAPI.nearToYocto(faucetAmount);

    // 1. Check if the target account already exists on NEAR Testnet
    let accountExists = false;
    try {
      await provider.query({
        request_type: "view_account",
        finality: "final",
        account_id: targetAccount,
      });
      accountExists = true;
    } catch {
      accountExists = false;
    }

    let txHash: string;
    let wasCreated = false;

    if (accountExists) {
      console.log(`[Faucet] Dispensing ${faucetAmount} NEAR to existing account ${targetAccount}...`);
      const tx = await account.transfer({
        receiverId: targetAccount,
        amount: yocto,
      });
      txHash = (tx as any).transaction?.hash || `faucet_${Date.now()}`;
    } else {
      // 2. Account does not exist on-chain: automatically create & fund it!
      console.log(`[Faucet] Account ${targetAccount} does not exist. Creating and funding on NEAR Testnet...`);

      if (targetAccount.toLowerCase().endsWith(`.${CONTRACT_ID}`)) {
        // Create subaccount of veilx-agent.testnet
        const prefix = targetAccount.slice(0, -(CONTRACT_ID.length + 1));
        const pubKey = body.publicKey
          ? nearAPI.PublicKey.from(body.publicKey)
          : nearAPI.KeyPair.fromRandom("ed25519").getPublicKey();

        const tx = await account.createSubAccount({
          accountOrPrefix: prefix,
          publicKey: pubKey,
          nearToTransfer: yocto,
        });
        txHash = (tx as any).transaction?.hash || `faucet_create_${Date.now()}`;
        wasCreated = true;
      } else if (targetAccount.toLowerCase().endsWith(".testnet")) {
        // Try creating via official NEAR Testnet helper
        const helperPubKey =
          body.publicKey || nearAPI.KeyPair.fromRandom("ed25519").getPublicKey().toString();
        const helperRes = await fetch("https://helper.testnet.near.org/account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newAccountId: targetAccount,
            newAccountPublicKey: helperPubKey,
          }),
        });

        if (helperRes.ok) {
          const helperData = await helperRes.json();
          txHash = helperData?.transaction?.hash || `helper_${Date.now()}`;
          wasCreated = true;
        } else {
          // If helper fails, fall back to subaccount under our contract
          const cleanPrefix = targetAccount.replace(/\.testnet$/i, "").replace(/[^a-zA-Z0-9_-]/g, "");
          const subAccount = `${cleanPrefix}.${CONTRACT_ID}`;
          console.log(`[Faucet] Helper rejected ${targetAccount}, creating fallback subaccount ${subAccount}...`);
          const pubKey = body.publicKey
            ? nearAPI.PublicKey.from(body.publicKey)
            : nearAPI.KeyPair.fromRandom("ed25519").getPublicKey();

          const tx = await account.createSubAccount({
            accountOrPrefix: cleanPrefix,
            publicKey: pubKey,
            nearToTransfer: yocto,
          });
          txHash = (tx as any).transaction?.hash || `faucet_sub_${Date.now()}`;
          targetAccount = subAccount;
          wasCreated = true;
        }
      } else {
        throw new Error(`Target account "${targetAccount}" does not exist on NEAR testnet.`);
      }
    }

    return NextResponse.json({
      success: true,
      amountNear: faucetAmount,
      targetAccount,
      txHash,
      wasCreated,
      publicKey: body.publicKey || null,
      explorerUrl: `https://testnet.nearblocks.io/txns/${txHash}`,
    });
  } catch (err: any) {
    console.error("[Faucet Error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to dispense testnet tokens. You can also use https://faucet.testnet.near.org" },
      { status: 500 }
    );
  }
}
