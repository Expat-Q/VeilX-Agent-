// src/lib/near-utils.ts
// Utility functions for NEAR account sanitization, validation, and subaccount management
import * as nearAPI from "near-api-js";

const CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "veilx-agent.testnet";
const TESTNET_RPC = process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://test.rpc.fastnear.com";
const ESCROW_PRIVATE_KEY = process.env.ESCROW_PRIVATE_KEY;

/**
 * Sanitizes a social handle (e.g. "@_web3central" or "expatq3") into a syntactically
 * valid NEAR Protocol subaccount name under `.veilx-agent.testnet`.
 *
 * NEAR Account ID Rules:
 * - Must consist of lowercase alphanumeric characters, dashes (-), and underscores (_).
 * - Must NOT start or end with a separator ('-' or '_').
 * - Length between 2 and 64 characters.
 */
export function sanitizeNearAccountId(handle: string): string {
  if (!handle) return `user_${Date.now().toString(36)}.${CONTRACT_ID}`;
  
  const clean = handle.replace("@", "").trim();
  
  // Strip leading and trailing non-alphanumeric characters (including leading underscores like _web3central)
  let prefix = clean.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "").toLowerCase();
  
  // Replace any internal disallowed characters with an underscore
  prefix = prefix.replace(/[^a-z0-9_-]/gi, "_");
  
  // Guarantee minimum length
  if (prefix.length < 2) {
    prefix = `user_${prefix || "x"}`;
  }
  
  // Truncate if too long (max 64 total including .veilx-agent.testnet)
  const maxPrefixLen = 64 - (CONTRACT_ID.length + 1);
  if (prefix.length > maxPrefixLen) {
    prefix = prefix.substring(0, maxPrefixLen);
  }

  return `${prefix}.${CONTRACT_ID}`;
}

/**
 * Ensures that a NEAR subaccount exists on testnet.
 * If it doesn't exist, the relayer creates it using `createSubAccount` and funds it with initial storage.
 * If it already exists but the user's session key is not registered, it provisions a personal subaccount with the user's key.
 */
export async function ensureNearSubAccountExists(
  accountId: string,
  userPublicKey?: string
): Promise<{ exists: boolean; created: boolean; accountId: string; txHash?: string; error?: string }> {
  try {
    const cleanAccount = accountId.trim().toLowerCase();
    const provider = new nearAPI.JsonRpcProvider({ url: TESTNET_RPC });

    // 1. Check if account already exists
    let accountExists = false;
    try {
      await provider.query({
        request_type: "view_account",
        finality: "final",
        account_id: cleanAccount,
      });
      accountExists = true;
    } catch {
      accountExists = false;
    }

    if (accountExists) {
      // If user has an active session key, ensure it is registered on-chain via relayer admin key
      if (userPublicKey && ESCROW_PRIVATE_KEY) {
        try {
          const userKey = nearAPI.PublicKey.from(userPublicKey);
          const keyList: any = await provider.query({
            request_type: "view_access_key_list",
            finality: "final",
            account_id: cleanAccount,
          });
          const keyExists = keyList.keys?.some((k: any) => k.public_key === userKey.toString());
          if (!keyExists) {
            // Relayer holding admin key authorizes the user's active session key
            const keyPair = nearAPI.KeyPair.fromString(ESCROW_PRIVATE_KEY as any);
            const signer = new nearAPI.KeyPairSigner(keyPair);
            const subAccount = new nearAPI.Account(cleanAccount, provider, signer);
            await subAccount.addFullAccessKey(userKey);
            console.log(`[NEAR Utils] Authorized active session key on ${cleanAccount}:`, userKey.toString());
          }
        } catch (err: any) {
          // Expected on older accounts created without the relayer admin key
          console.log(`[NEAR Utils] Session key check on ${cleanAccount}:`, err.message);
        }
      }
      return { exists: true, created: false, accountId: cleanAccount };
    }

    // 2. Account does not exist on-chain: Create with Dual-Key provisioning!
    if (!ESCROW_PRIVATE_KEY) {
      return { exists: false, created: false, accountId: cleanAccount, error: "ESCROW_PRIVATE_KEY is missing on server" };
    }

    if (!cleanAccount.endsWith(`.${CONTRACT_ID}`)) {
      return { exists: false, created: false, accountId: cleanAccount, error: `Account ${cleanAccount} is not a subaccount of ${CONTRACT_ID}` };
    }

    const keyPair = nearAPI.KeyPair.fromString(ESCROW_PRIVATE_KEY as any);
    const signer = new nearAPI.KeyPairSigner(keyPair);
    const parentAccount = new nearAPI.Account(CONTRACT_ID, provider, signer);

    const userKey = userPublicKey
      ? nearAPI.PublicKey.from(userPublicKey)
      : nearAPI.KeyPair.fromRandom("ed25519").getPublicKey();
    const relayerKey = keyPair.getPublicKey();

    console.log(`[NEAR Utils] Creating dual-key subaccount ${cleanAccount} on-chain with user key & relayer admin key...`);
    const actions = [
      nearAPI.actions.createAccount(),
      nearAPI.actions.transfer(nearAPI.nearToYocto("0.005")),
      nearAPI.actions.addFullAccessKey(userKey),
      nearAPI.actions.addFullAccessKey(relayerKey),
    ];

    const tx = await parentAccount.signAndSendTransaction({
      receiverId: cleanAccount,
      actions,
    });

    const txHash = tx.transaction?.hash || `created_${Date.now()}`;
    return { exists: true, created: true, accountId: cleanAccount, txHash };
  } catch (err: any) {
    console.error("[ensureNearSubAccountExists Error]", err);
    return { exists: false, created: false, accountId, error: err.message };
  }
}
