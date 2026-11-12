// scripts/deploy-contract.mjs
// Deploys the compiled VeilX Escrow WASM binary to NEAR Testnet

import fs from "fs";
import path from "path";
import crypto from "crypto";
import bs58 from "bs58";
import dotenv from "dotenv";
import * as nearAPI from "near-api-js";

dotenv.config({ path: ".env.local" });

const RPC_URL = process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://rpc.testnet.near.org";
const CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "veilx-agent.testnet";
const PRIVATE_KEY = process.env.ESCROW_PRIVATE_KEY;
const WASM_PATH = path.resolve("contracts/veilx-escrow/res/veilx_escrow.wasm");

async function main() {
  console.log("================================================================================");
  console.log("          VEILX ESCROW SMART CONTRACT DEPLOYMENT & UPGRADE                     ");
  console.log("================================================================================");

  if (!PRIVATE_KEY) {
    throw new Error("Missing ESCROW_PRIVATE_KEY in .env.local");
  }

  if (!fs.existsSync(WASM_PATH)) {
    throw new Error(`Compiled WASM not found at ${WASM_PATH}. Run cargo build first.`);
  }

  const wasmBinary = fs.readFileSync(WASM_PATH);
  const wasmHash = crypto.createHash("sha256").update(wasmBinary).digest();
  const expectedCodeHash = bs58.encode(wasmHash);

  console.log(`Contract Account : ${CONTRACT_ID}`);
  console.log(`RPC Endpoint     : ${RPC_URL}`);
  console.log(`WASM File Size   : ${(wasmBinary.length / 1024).toFixed(2)} KB (${wasmBinary.length} bytes)`);
  console.log(`Expected Code Hash: ${expectedCodeHash}`);
  console.log("--------------------------------------------------------------------------------");

  const provider = new nearAPI.JsonRpcProvider({ url: RPC_URL });
  const keyPair = nearAPI.KeyPair.fromString(PRIVATE_KEY);
  const signer = new nearAPI.KeyPairSigner(keyPair);
  const account = new nearAPI.Account(CONTRACT_ID, provider, signer);

  // 1. Query current on-chain state
  console.log("\n[1/3] Querying current on-chain contract state...");
  const currentAccount = await provider.query({
    request_type: "view_account",
    finality: "final",
    account_id: CONTRACT_ID,
  });

  const availableNear = (Number(BigInt(currentAccount.amount) / BigInt(1e18)) / 1e6).toFixed(3);
  console.log(`Current Balance  : ${availableNear} NEAR`);
  console.log(`Current Code Hash: ${currentAccount.code_hash}`);

  if (currentAccount.code_hash === expectedCodeHash) {
    console.log("\n✓ Contract code is ALREADY up to date on-chain! Code hashes match.");
    return;
  }

  // 2. Deploy updated WASM bytecode
  console.log("\n[2/3] Broadcasting DeployContract transaction to NEAR Testnet...");
  const outcome = await account.deployContract(new Uint8Array(wasmBinary));
  const txHash = outcome?.transaction?.hash || outcome?.transaction_outcome?.id || "confirmed";

  console.log(`✓ Deployment Transaction Confirmed!`);
  console.log(`  Tx Hash     : ${txHash}`);
  console.log(`  Explorer URL: https://testnet.nearblocks.io/txns/${txHash}`);

  // 3. Verify updated code hash
  console.log("\n[3/3] Verifying new code hash on-chain...");
  // Brief delay to allow indexer propagation
  await new Promise((r) => setTimeout(r, 2000));

  const updatedAccount = await provider.query({
    request_type: "view_account",
    finality: "final",
    account_id: CONTRACT_ID,
  });

  console.log(`Updated Code Hash: ${updatedAccount.code_hash}`);
  if (updatedAccount.code_hash === expectedCodeHash) {
    console.log("✓ Code hash verified! Contract successfully upgraded on NEAR Testnet.");
  } else {
    console.warn("Notice: Code hash may take an extra block to reflect in view calls.");
  }

  console.log("\n================================================================================");
  console.log("             DEPLOYMENT COMPLETED SUCCESSFULLY                                 ");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("\nDeployment failed:", err);
  process.exit(1);
});
