import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import * as nearAPI from "near-api-js";

async function run() {
  const provider = new nearAPI.JsonRpcProvider({ url: "https://rpc.testnet.near.org" });
  const keyPair = nearAPI.KeyPair.fromString(process.env.ESCROW_PRIVATE_KEY);
  const signer = new nearAPI.KeyPairSigner(keyPair);
  
  // Try using escrow contract account to add key
  try {
    const parentAcc = new nearAPI.Account("veilx-agent.testnet", provider, signer);
    const pubKey = nearAPI.PublicKey.from("ed25519:2co4JesoUMLAeFHBzhKEMVbSrDz93ocqHPUAxrypX7M3");
    console.log("Attempting to add key to expatq3.veilx-agent.testnet...");
    const subAcc = new nearAPI.Account("expatq3.veilx-agent.testnet", provider, signer);
    await subAcc.addFullAccessKey(pubKey);
    console.log("SUCCESS! Key added to expatq3.veilx-agent.testnet");
  } catch (e) {
    console.log("Add key error:", e.message);
  }
}
run();
