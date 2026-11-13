// src/lib/near-client-signer.ts
// Non-Custodial In-Browser Transaction Signer for NEAR Protocol
// Ensures private keys NEVER leave the user's browser device.

export interface ClientNearTransferParams {
  senderAccountId: string;
  senderSecretKey: string;
  receiverId: string;
  amountNear: number | string;
  asset?: string;
  nodeUrl?: string;
}

export interface ClientNearTransferResult {
  success: boolean;
  txHash: string;
  receiverId: string;
  amountNear: number;
}

export function getClientRpcUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/near/rpc`;
  }
  return process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://test.rpc.fastnear.com";
}

/**
 * Signs and broadcasts a native NEAR or NEP-141 token transfer directly inside the user's browser.
 * The private key is held strictly in local memory and is never transmitted over HTTP.
 */
export async function signAndBroadcastNearTransfer(
  params: ClientNearTransferParams
): Promise<ClientNearTransferResult> {
  const { senderAccountId, senderSecretKey, receiverId, amountNear, asset = "NEAR", nodeUrl } = params;
  const effectiveNodeUrl = nodeUrl || getClientRpcUrl();
  const numAmount = typeof amountNear === "string" ? parseFloat(amountNear) : amountNear;

  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error("Transfer amount must be a positive number");
  }

  const nearAPI = await import("near-api-js");
  const provider = new nearAPI.JsonRpcProvider({ url: effectiveNodeUrl });
  const keyPair = nearAPI.KeyPair.fromString(senderSecretKey as any);
  const signer = new nearAPI.KeyPairSigner(keyPair);
  const account = new nearAPI.Account(senderAccountId, provider, signer);

  let txHash = "";
  if (asset.toUpperCase() === "USDC") {
    const usdcContract = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
    const rawUnits = BigInt(Math.floor(numAmount * 1_000_000)).toString();
    const outcome: any = await (account as any).functionCall({
      contractId: usdcContract,
      methodName: "ft_transfer",
      args: {
        receiver_id: receiverId.trim().toLowerCase(),
        amount: rawUnits,
        memo: "VeilX Direct USDC Transfer",
      },
      gas: BigInt("50000000000000"), // 50 TGas
      deposit: BigInt("1"),           // 1 yoctoNEAR
    });
    txHash =
      outcome?.transaction?.hash ||
      outcome?.receipts_outcome?.[0]?.id ||
      `tx_${Date.now()}`;
  } else {
    const yoctoAmount = nearAPI.nearToYocto(numAmount.toString() as any);
    const outcome: any = await account.transfer({
      receiverId: receiverId.trim().toLowerCase(),
      amount: yoctoAmount,
    });
    txHash =
      outcome?.transaction?.hash ||
      outcome?.receipts_outcome?.[0]?.id ||
      `tx_${Date.now()}`;
  }

  return {
    success: true,
    txHash,
    receiverId,
    amountNear: numAmount,
  };
}

export interface ClientMpcTransferParams {
  senderAccountId: string;
  senderSecretKey: string;
  recipientAddress: string;
  asset: "ETH" | "USDC" | "USDT" | string;
  amount: number | string;
  chain?: string;
  chainId?: number;
  derivationPath?: string;
  nodeUrl?: string;
}

export interface ClientMpcTransferResult {
  success: boolean;
  txHash: string;
  senderEvmAddress: string;
  recipientAddress: string;
  asset: string;
  amount: number | string;
  chainName?: string;
  chainId?: number;
}

/**
 * Non-custodial in-browser MPC EVM transaction signer:
 * 1. Prepares unsigned transaction on server with accurate EIP-1559 fees for requested chain.
 * 2. Signs the NEAR function call to v1.signer-prod.testnet inside the user's browser using their session key.
 *    (This guarantees predecessor_account_id on NEAR matches the user's account).
 * 3. Extracts the MPC signature and broadcasts to Base / Arbitrum / Ethereum Sepolia.
 */
export async function signAndBroadcastMpcEvmTransfer(
  params: ClientMpcTransferParams
): Promise<ClientMpcTransferResult> {
  const { senderAccountId, senderSecretKey, recipientAddress, asset, amount, chain, chainId, derivationPath, nodeUrl } = params;

  // 1. Prepare unsigned EVM transaction on server
  const prepRes = await fetch("/api/evm/prepare-tx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      senderNearAccountId: senderAccountId,
      recipientAddress,
      asset,
      amount,
      chain,
      chainId,
      derivationPath: derivationPath || "ethereum,1",
    }),
  });

  const prepData = await prepRes.json();
  if (!prepRes.ok || !prepData.success) {
    throw new Error(prepData.error || "Failed to prepare EVM transaction");
  }

  const { unsignedTx, txPayloadHash, mpcContractId, senderEvmAddress, chainName, chainId: resolvedChainId } = prepData;

  // 2. Sign NEAR function call to v1.signer-prod.testnet strictly in the browser using the session key
  const nearAPI = await import("near-api-js");
  const effectiveNodeUrl = nodeUrl || getClientRpcUrl();
  const provider = new nearAPI.JsonRpcProvider({ url: effectiveNodeUrl });
  const keyPair = nearAPI.KeyPair.fromString(senderSecretKey as any);
  const signer = new nearAPI.KeyPairSigner(keyPair);
  const account = new nearAPI.Account(senderAccountId, provider, signer);

  let signOutcome: any;
  const signArgs = {
    request: {
      payload: txPayloadHash,
      path: derivationPath || "ethereum,1",
      key_type: "Ecdsa",
      domain_id: 0,
    },
    domain_id: 0,
  };

  if (typeof (account as any).callFunction === "function") {
    signOutcome = await (account as any).callFunction({
      contractId: mpcContractId || "v1.signer-prod.testnet",
      methodName: "sign",
      args: signArgs,
      gas: BigInt("300000000000000"), // 300 Tgas
      deposit: BigInt("1"),           // 1 yoctoNEAR
    });
  } else if (typeof (account as any).callFunctionRaw === "function") {
    signOutcome = await (account as any).callFunctionRaw({
      contractId: mpcContractId || "v1.signer-prod.testnet",
      methodName: "sign",
      args: signArgs,
      gas: BigInt("300000000000000"),
      deposit: BigInt("1"),
    });
  } else if (typeof (account as any).functionCall === "function") {
    signOutcome = await (account as any).functionCall({
      contractId: mpcContractId || "v1.signer-prod.testnet",
      methodName: "sign",
      args: signArgs,
      gas: BigInt("300000000000000"),
      attachedDeposit: BigInt("1"),
    });
  } else {
    throw new Error("NEAR Account method for function call not found in near-api-js");
  }

  // 3. Extract the MPC signature
  const { parseMpcSignature } = await import("@/lib/near-chain-signatures");
  const signature = parseMpcSignature(signOutcome);

  // 4. Broadcast the signed EVM transaction
  const bcastRes = await fetch("/api/evm/broadcast-tx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      unsignedTx,
      signature,
      chainId: resolvedChainId,
    }),
  });

  const bcastData = await bcastRes.json();
  if (!bcastRes.ok || !bcastData.success) {
    throw new Error(bcastData.error || "Failed to broadcast signed EVM transaction");
  }

  return {
    success: true,
    txHash: bcastData.txHash,
    senderEvmAddress,
    recipientAddress,
    asset,
    amount,
    chainName,
    chainId: resolvedChainId,
  };
}
