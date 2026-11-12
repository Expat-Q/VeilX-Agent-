// src/lib/near-chain-signatures.ts
// Deterministic Multi-Chain Address Derivation via NEAR Protocol Chain Signatures MPC
// Uses official NEAR Testnet MPC Signer: v1.signer-prod.testnet

import crypto from "crypto";
import { ec as EC } from "elliptic";
import { createPublicClient, http, keccak256, serializeTransaction } from "viem";
import { base, baseSepolia } from "viem/chains";
import * as nearAPI from "near-api-js";

const ec = new EC("secp256k1");

// NEAR MPC Signer contract IDs and Root Public Keys
export const NEAR_MPC_CONTRACT_TESTNET = "v1.signer-prod.testnet";
export const NEAR_MPC_ROOT_PUBKEY_TESTNET =
  "4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3";

export const NEAR_MPC_CONTRACT_MAINNET = "v1.signer";
export const NEAR_MPC_ROOT_PUBKEY_MAINNET =
  "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3";

export function getMpcContract(isMainnet: boolean = false): string {
  if (process.env.NEXT_PUBLIC_NEAR_NETWORK === "mainnet" || isMainnet) {
    return NEAR_MPC_CONTRACT_MAINNET;
  }
  return NEAR_MPC_CONTRACT_TESTNET;
}

export function getMpcRootPubKey(isMainnet: boolean = false): string {
  if (process.env.NEXT_PUBLIC_NEAR_NETWORK === "mainnet" || isMainnet) {
    return NEAR_MPC_ROOT_PUBKEY_MAINNET;
  }
  return NEAR_MPC_ROOT_PUBKEY_TESTNET;
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_MAP: Record<string, number> = {};
for (let i = 0; i < BASE58_ALPHABET.length; i++) {
  BASE58_MAP[BASE58_ALPHABET.charAt(i)] = i;
}

/**
 * Fast zero-dependency Base58 decoder for secp256k1 public keys
 */
export function decodeBase58(string: string): Buffer {
  if (string.length === 0) return Buffer.alloc(0);
  let bytes = [0];
  for (let i = 0; i < string.length; i++) {
    const c = string[i];
    if (!(c in BASE58_MAP)) throw new Error(`Invalid Base58 character: ${c}`);
    let carry = BASE58_MAP[c];
    for (let j = 0; j < bytes.length; ++j) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; string[i] === "1" && i < string.length - 1; i++) {
    bytes.push(0);
  }
  return Buffer.from(bytes.reverse());
}

/**
 * Computes the EIP-55 checksum address from a hex string
 */
export function toChecksumAddress(address: string): string {
  const addr = address.toLowerCase().replace(/^0x/, "");
  const hash = keccak256(Buffer.from(addr, "utf-8")).replace(/^0x/, "");
  let ret = "0x";

  for (let i = 0; i < addr.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      ret += addr[i].toUpperCase();
    } else {
      ret += addr[i];
    }
  }
  return ret;
}

/**
 * Deterministically derives an EVM (Ethereum / Base / Arbitrum) address
 * for any NEAR account using NEAR MPC Additive Key Derivation.
 *
 * Formula:
 * epsilon = SHA3-256("near-mpc-recovery v0.1.0 epsilon derivation:" + accountId + "," + path)
 * Derived_PubKey = Root_PubKey + (epsilon * G)
 * EVM_Address = Keccak256(Derived_PubKey[1..65])[-20..]
 */
export function deriveEvmAddress(
  accountId: string,
  derivationPath: string = "ethereum,1",
  rootKeyBase58: string = NEAR_MPC_ROOT_PUBKEY_TESTNET
): {
  evmAddress: string;
  checksumAddress: string;
  derivationPath: string;
  nearAccountId: string;
  mpcContractId: string;
} {
  const cleanAccountId = accountId.trim().toLowerCase();
  // Canonicalize handle-based subaccounts under .veilx-agent.testnet (or legacy .veilx.testnet)
  // so ephemeral subaccount suffixes (e.g. veilxapp-3mnsu3.veilx-agent.testnet)
  // always map to the deterministic canonical account 'veilxapp.veilx-agent.testnet'
  let canonicalAccountId = cleanAccountId;
  if (canonicalAccountId.includes(".veilx-agent.testnet") || canonicalAccountId.includes(".veilx.testnet")) {
    const domain = canonicalAccountId.includes(".veilx-agent.testnet")
      ? ".veilx-agent.testnet"
      : ".veilx.testnet";
    const prefix = canonicalAccountId.slice(0, -domain.length);
    const baseHandle = prefix.split("-")[0];
    if (baseHandle) {
      canonicalAccountId = `${baseHandle}.veilx-agent.testnet`;
    }
  }

  const rootPubKeyBytes = decodeBase58(rootKeyBase58);

  // Uncompressed secp256k1 point has 0x04 prefix + 64 bytes (X, Y)
  const rootPointHex = "04" + rootPubKeyBytes.toString("hex");
  const rootPoint = ec.keyFromPublic(rootPointHex, "hex").getPublic();

  // Domain-separated additive tweak (epsilon) - NEAR MPC protocol strictly uses SHA3-256
  const derivationMessage = `near-mpc-recovery v0.1.0 epsilon derivation:${canonicalAccountId},${derivationPath}`;
  const epsilonHash = crypto.createHash("sha3-256").update(derivationMessage).digest();

  // Additive point multiplication and curve addition
  const epsilonPoint = ec.g.mul(epsilonHash);
  const derivedPoint = rootPoint.add(epsilonPoint);

  // Uncompressed public key without 0x04 prefix (64 bytes = 128 hex chars)
  const uncompressedHex = derivedPoint.encode("hex", false).slice(2);

  // Ethereum address is the last 20 bytes (40 hex chars) of Keccak-256
  const addressHash = keccak256(`0x${uncompressedHex}`);
  const rawEvmAddress = "0x" + addressHash.slice(-40).toLowerCase();
  const checksumAddress = toChecksumAddress(rawEvmAddress);

  return {
    evmAddress: rawEvmAddress,
    checksumAddress,
    derivationPath,
    nearAccountId: cleanAccountId,
    mpcContractId: NEAR_MPC_CONTRACT_TESTNET,
  };
}

export interface MpcSignatureResult {
  r: `0x${string}`;
  s: `0x${string}`;
  v: number;
  yParity: 0 | 1;
}

/**
 * Parses raw MPC execution outcome into standard EVM (r, s, v, yParity) signature.
 * Enforces canonical low-s (EIP-2) to avoid EVM transaction malleability / broadcast rejection.
 */
export function parseMpcSignature(response: any): MpcSignatureResult {
  let sigData = response;
  if (typeof sigData === "string") {
    try {
      sigData = JSON.parse(sigData);
    } catch {}
  }
  if (sigData?.big_r) {
    // already resolved
  } else if (sigData?.status?.SuccessValue) {
    try {
      const decoded = Buffer.from(response.status.SuccessValue, "base64").toString();
      sigData = JSON.parse(decoded);
    } catch {}
  } else if (Array.isArray(response?.receipts_outcome)) {
    for (const ro of response.receipts_outcome) {
      if (ro?.outcome?.status?.SuccessValue) {
        try {
          const decoded = Buffer.from(ro.outcome.status.SuccessValue, "base64").toString();
          const parsed = JSON.parse(decoded);
          if (parsed?.big_r || parsed?.signature?.big_r) {
            sigData = parsed;
            break;
          }
        } catch {}
      }
    }
  }

  if (sigData?.signature?.big_r) {
    sigData = sigData.signature;
  }

  if (!sigData?.big_r?.affine_point || !sigData?.s?.scalar) {
    throw new Error("Invalid MPC signature structure: missing big_r or s");
  }

  // affine_point has 02 or 03 prefix, the remaining 64 hex chars is r
  const rawR = sigData.big_r.affine_point.replace(/^0[234]/, "");
  const rawS = sigData.s.scalar;
  let recoveryId = Number(sigData.recovery_id ?? 0);

  // Enforce canonical low-s (EIP-2)
  const secp256k1N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
  const secp256k1halfN = secp256k1N / BigInt(2);
  let sBig = BigInt(`0x${rawS}`);
  let yParity: 0 | 1 = (recoveryId % 2) as 0 | 1;

  if (sBig > secp256k1halfN) {
    sBig = secp256k1N - sBig;
    yParity = yParity === 0 ? 1 : 0;
    recoveryId = recoveryId === 0 ? 1 : 0;
  }

  const sHex = sBig.toString(16).padStart(64, "0");

  return {
    r: `0x${rawR.padStart(64, "0")}` as `0x${string}`,
    s: `0x${sHex}` as `0x${string}`,
    v: recoveryId,
    yParity,
  };
}

/**
 * Requests a threshold signature from NEAR Chain Signatures MPC contract (v1.signer-prod.testnet).
 */
export async function requestMpcSignature(
  nearAccount: nearAPI.Account,
  derivationPath: string,
  txPayloadHash: Uint8Array,
  mpcContractId: string = NEAR_MPC_CONTRACT_TESTNET
): Promise<MpcSignatureResult> {
  const signArgs = {
    request: {
      payload: Array.from(txPayloadHash),
      path: derivationPath,
      key_type: "Ecdsa",
      domain_id: 0,
    },
    domain_id: 0,
  };

  let result: any;
  if (typeof (nearAccount as any).callFunction === "function") {
    result = await (nearAccount as any).callFunction({
      contractId: mpcContractId,
      methodName: "sign",
      args: signArgs,
      gas: BigInt("300000000000000"), // 300 Tgas
      deposit: BigInt("1"),           // 1 yoctoNEAR
    });
  } else if (typeof (nearAccount as any).functionCall === "function") {
    result = await (nearAccount as any).functionCall({
      contractId: mpcContractId,
      methodName: "sign",
      args: signArgs,
      gas: BigInt("300000000000000"),
      attachedDeposit: BigInt("1"),
    });
  } else {
    throw new Error("NEAR Account method for function call not found in near-api-js");
  }

  return parseMpcSignature(result);
}

// Base USDC Contract Addresses
export const BASE_SEPOLIA_USDC_CONTRACT = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const BASE_MAINNET_USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/**
 * Encodes standard ERC-20 transfer(address to, uint256 amount) calldata
 */
export function encodeErc20TransferData(recipientAddress: string, amountDecimal: number | string, decimals: number = 6): `0x${string}` {
  const cleanTo = recipientAddress.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const numAmount = typeof amountDecimal === "string" ? parseFloat(amountDecimal) : amountDecimal;
  const rawUnits = BigInt(Math.round(numAmount * Math.pow(10, decimals)));
  const hexAmount = rawUnits.toString(16).padStart(64, "0");
  // Method selector: keccak256("transfer(address,uint256)") = a9059cbb
  return `0xa9059cbb${cleanTo}${hexAmount}` as `0x${string}`;
}

/**
 * Signs and broadcasts an outbound EVM transaction to Base (Sepolia or Mainnet) via NEAR Chain Signatures MPC.
 * Supports both native ETH transfers and ERC-20 USDC transfers with accurate EIP-1559 gas fee estimation.
 */
export async function createAndSignBaseTransaction(params: {
  nearAccount?: nearAPI.Account;
  senderNearAccountId: string;
  recipientAddress: `0x${string}`;
  asset?: "ETH" | "USDC";
  amount?: string | number;
  amountEth?: string;
  derivationPath?: string;
  nonce?: number;
  rpcUrl?: string;
  chainId?: number;
}): Promise<{
  success: boolean;
  txHash: string;
  rawTransaction: string;
  senderEvmAddress: string;
  destination: string;
  asset: string;
  mpcSigned: boolean;
}> {
  const derivationPath = params.derivationPath || "ethereum,1";
  const { checksumAddress } = deriveEvmAddress(params.senderNearAccountId, derivationPath);
  const asset = (params.asset || "USDC").toUpperCase() as "ETH" | "USDC";

  // Base Sepolia (84532) vs Base Mainnet (8453)
  const chainId = params.chainId ?? (params.rpcUrl?.includes("mainnet") ? 8453 : 84532);
  const chain = chainId === 8453 ? base : baseSepolia;
  const defaultRpc = chainId === 8453 ? "https://mainnet.base.org" : "https://sepolia.base.org";
  const rpcUrl = params.rpcUrl || defaultRpc;

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  // Resolve dynamic nonce from Base RPC
  let nonce = params.nonce;
  if (typeof nonce !== "number") {
    try {
      nonce = await publicClient.getTransactionCount({
        address: checksumAddress as `0x${string}`,
        blockTag: "pending",
      });
    } catch (e) {
      console.warn("[Chain Signatures] Could not fetch nonce via publicClient, fallback:", e);
      try {
        const nonceRes = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getTransactionCount",
            params: [checksumAddress, "pending"],
          }),
        });
        if (nonceRes.ok) {
          const nonceData = await nonceRes.json();
          if (nonceData.result) {
            nonce = parseInt(nonceData.result, 16);
          }
        }
      } catch {}
    }
  }
  if (typeof nonce !== "number") nonce = 0;

  // EIP-1559 dynamic fee calculation for Base
  // 1. Fetch latest block's baseFeePerGas
  let baseFeePerGas = BigInt(5000000); // 0.005 gwei fallback
  try {
    const latestBlock = await publicClient.getBlock({ blockTag: "latest" });
    if (latestBlock?.baseFeePerGas) {
      baseFeePerGas = latestBlock.baseFeePerGas;
    }
  } catch (e) {
    console.warn("[Chain Signatures] Could not fetch latest block baseFeePerGas, fallback:", e);
  }

  // 2. Call publicClient.estimateMaxPriorityFeePerGas() with fallback to BigInt(1000000) (0.001 gwei)
  let estimatePriorityFee = BigInt(1000000);
  try {
    const estimated = await publicClient.estimateMaxPriorityFeePerGas();
    if (estimated) {
      estimatePriorityFee = estimated;
    }
  } catch (e) {
    console.warn("[Chain Signatures] estimateMaxPriorityFeePerGas failed, fallback to 0.001 gwei:", e);
  }

  // 3. Enforce: maxPriorityFeePerGas = estimatePriorityFee > (baseFeePerGas / 2n) ? (baseFeePerGas / 2n) + 1n : estimatePriorityFee;
  let maxPriorityFeePerGas =
    estimatePriorityFee > baseFeePerGas / BigInt(2)
      ? baseFeePerGas / BigInt(2) + BigInt(1)
      : estimatePriorityFee;

  // 4. Enforce: maxFeePerGas = (baseFeePerGas * 15n / 10n) + maxPriorityFeePerGas;
  let maxFeePerGas = ((baseFeePerGas * BigInt(15)) / BigInt(10)) + maxPriorityFeePerGas;

  // 5. Always ensure maxFeePerGas >= maxPriorityFeePerGas
  if (maxFeePerGas < maxPriorityFeePerGas) {
    maxFeePerGas = maxPriorityFeePerGas;
  }

  let toAddress: `0x${string}`;
  let value: bigint;
  let data: `0x${string}`;
  let gas: bigint;

  if (asset === "USDC") {
    // Calling USDC contract transfer(recipient, amount)
    toAddress = (chainId === 8453 ? BASE_MAINNET_USDC_CONTRACT : BASE_SEPOLIA_USDC_CONTRACT) as `0x${string}`;
    value = BigInt(0);
    const amountVal = params.amount ?? params.amountEth ?? "5.0";
    data = encodeErc20TransferData(params.recipientAddress, amountVal, 6);
    gas = BigInt(65000);
    try {
      const estimatedGas = await publicClient.estimateGas({
        account: checksumAddress as `0x${string}`,
        to: toAddress,
        data,
        value: BigInt(0),
      });
      if (estimatedGas) {
        gas = (estimatedGas * BigInt(12)) / BigInt(10); // 20% safety margin
        if (gas < BigInt(65000)) gas = BigInt(65000);
      }
    } catch {
      gas = BigInt(65000);
    }
  } else {
    // Native ETH transfer
    toAddress = params.recipientAddress;
    const ethStr = params.amountEth ?? params.amount ?? "0.001";
    value = BigInt(Math.round(parseFloat(ethStr.toString()) * 1e18));
    data = "0x" as `0x${string}`;
    gas = BigInt(21000);
  }

  // Pre-flight balance check: Ensure sender has enough native gas (ETH) on Base
  try {
    const senderBalance = await publicClient.getBalance({ address: checksumAddress as `0x${string}` });
    const estimatedCost = (gas * maxFeePerGas) + value;
    if (senderBalance < estimatedCost) {
      const requiredEth = (Number(estimatedCost) / 1e18).toFixed(6);
      const currentEth = (Number(senderBalance) / 1e18).toFixed(6);
      throw new Error(
        `Gas Fee Error: Insufficient native ETH on ${chain.name}. Required: ~${requiredEth} ETH to cover gas, but your wallet holds ${currentEth} ETH. Please deposit a small amount of ETH to fund gas.`
      );
    }
  } catch (gasCheckErr: any) {
    if (gasCheckErr.message?.includes("Gas Fee Error")) {
      throw gasCheckErr;
    }
    // Network query blip during gas check; proceed with MPC signing
  }

  const unsignedTx = {
    to: toAddress,
    value,
    data,
    chainId,
    nonce,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    type: "eip1559" as const,
  };

  // Hash unsigned transaction payload using Keccak-256
  const unsignedRaw = serializeTransaction(unsignedTx);
  const txHashBytes = Buffer.from(keccak256(unsignedRaw).slice(2), "hex");

  let signature: MpcSignatureResult;
  let mpcSigned = false;

  if (params.nearAccount) {
    try {
      signature = await requestMpcSignature(params.nearAccount, derivationPath, txHashBytes);
      mpcSigned = true;
    } catch (e: any) {
      console.error("[Chain Signatures] On-chain MPC signing failed:", e.message);
      throw new Error(`MPC_SIGNING_FAILED: Failed to sign transaction on NEAR MPC network: ${e.message}`);
    }
  } else {
    throw new Error("MPC_SIGNING_FAILED: Active NEAR Account with function-call permissions required for MPC signing");
  }

  // Serialize signed transaction with MPC signature
  const signedRawTx = serializeTransaction(unsignedTx, {
    r: signature.r,
    s: signature.s,
    yParity: signature.yParity,
  });

  let broadcastTxHash = keccak256(signedRawTx);

  // Broadcast to Base RPC
  try {
    broadcastTxHash = await publicClient.sendRawTransaction({
      serializedTransaction: signedRawTx,
    });
  } catch (publicClientErr: any) {
    try {
      const rpcRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "eth_sendRawTransaction",
          params: [signedRawTx],
        }),
      });

      if (!rpcRes.ok) {
        const httpErr = await rpcRes.text();
        throw new Error(`EVM_RPC_HTTP_ERROR (${rpcRes.status}): ${httpErr}`);
      }

      const rpcJson = await rpcRes.json();
      if (rpcJson.error) {
        const errMsg = rpcJson.error.message || JSON.stringify(rpcJson.error);
        console.error("[Chain Signatures] Base RPC broadcast rejected:", errMsg);
        throw new Error(`EVM_BROADCAST_REJECTED: ${errMsg}`);
      }

      if (rpcJson.result) {
        broadcastTxHash = rpcJson.result;
      }
    } catch (rpcErr: any) {
      console.error("[Chain Signatures] Base RPC broadcast failed:", rpcErr.message || rpcErr);
      throw new Error(`Base RPC Broadcast Failed: ${rpcErr.message || rpcErr}`);
    }
  }

  return {
    success: true,
    txHash: broadcastTxHash,
    rawTransaction: signedRawTx,
    senderEvmAddress: checksumAddress,
    destination: params.recipientAddress,
    asset,
    mpcSigned,
  };
}
