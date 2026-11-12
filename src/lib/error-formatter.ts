// src/lib/error-formatter.ts
// Converts raw blockchain/RPC/JSON-RPC error messages into friendly, human-readable explanations

export function formatHumanFriendlyError(rawError: any): string {
  if (!rawError) return "An unexpected error occurred. Please try again.";

  const message: string =
    typeof rawError === "string"
      ? rawError
      : rawError.message || rawError.shortMessage || JSON.stringify(rawError);

  // 1. NEAR insufficient gas/balance errors: "Not enough balance for account (balance: X, cost: Y)"
  const nearBalMatch = message.match(/Not enough balance for ([^\s]+)\s+\(balance:\s*(\d+),\s*cost:\s*(\d+)\)/i);
  if (nearBalMatch) {
    const [, account, balStr, costStr] = nearBalMatch;
    const balNear = (Number(BigInt(balStr) / BigInt(1e18)) / 1e6).toFixed(4);
    const costNear = (Number(BigInt(costStr) / BigInt(1e18)) / 1e6).toFixed(4);
    return `Insufficient NEAR for network signing: Account ${account} has ~${balNear} NEAR, but ~${costNear} NEAR is required for the threshold computation on NEAR. Please claim free testnet tokens from the dispenser to proceed.`;
  }

  // 2. EVM native gas errors: "insufficient funds for gas * price + value: have X want Y"
  const evmGasMatch = message.match(/insufficient funds for gas \* price \+ value:\s*have\s*(\d+)\s*want\s*(\d+)/i);
  if (evmGasMatch) {
    const [, haveWei, wantWei] = evmGasMatch;
    const haveEth = (Number(haveWei) / 1e18).toFixed(6);
    const wantEth = (Number(wantWei) / 1e18).toFixed(6);
    return `Insufficient native ETH for gas: Your wallet holds ${haveEth} ETH, but ~${wantEth} ETH is required by the network sequencers to execute this transfer. Please fund your wallet with a small amount of testnet ETH.`;
  }

  // 3. Custom pre-flight gas fee error (from prepare-tx)
  if (message.includes("Gas Fee Error: Insufficient native ETH")) {
    return message;
  }

  // 4. Stale block / Access key does not exist
  if (message.includes("does not exist at block height") || message.includes("Access key")) {
    return "Session key not registered on this NEAR account. Tip using your Base Sepolia USDC balance or claim testnet NEAR.";
  }

  // 5. 429 Deprecation or Rate Limit
  if (message.includes("DEPRECATED") || message.includes("-429") || message.includes("Rate limit")) {
    return "Network rate limit reached: Too many requests sent in a short window. Please wait a moment and try again.";
  }

  // 6. Bad Gateway / RPC failure
  if (message.includes("Bad Gateway") || message.includes("502") || message.includes("failed to fetch")) {
    return "Network RPC temporarily unresponsive: The testnet RPC node is experiencing heavy traffic. Retrying shortly...";
  }

  // 7. Spending cap error
  if (message.includes("spending limit")) {
    return message;
  }

  // 8. User cancelled
  if (message.includes("User rejected") || message.includes("cancelled")) {
    return "Transaction cancelled by user.";
  }

  // Fallback: strip technical prefixes like EVM_BROADCAST_REJECTED or MPC_SIGNING_FAILED
  const cleanMsg = message
    .replace(/^Direct transfer failed:\s*/i, "")
    .replace(/^Failed to broadcast tip:\s*/i, "")
    .replace(/^MPC_SIGNING_FAILED:\s*/i, "")
    .replace(/^EVM_BROADCAST_REJECTED:\s*/i, "")
    .replace(/^Base RPC Broadcast Failed:\s*/i, "");

  return cleanMsg;
}
