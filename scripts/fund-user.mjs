import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import * as nearAPI from "near-api-js";

async function run() {
  const provider = new nearAPI.JsonRpcProvider({ url: "https://rpc.testnet.near.org" });
  const keyPair = nearAPI.KeyPair.fromString(process.env.ESCROW_PRIVATE_KEY);
  const signer = new nearAPI.KeyPairSigner(keyPair);
  const escrowAcc = new nearAPI.Account("veilx-agent.testnet", provider, signer);

  console.log("Transferring 1.0 NEAR to expatq3-2co4je.veilx-agent.testnet...");
  const tx = await escrowAcc.transfer({
    receiverId: "expatq3-2co4je.veilx-agent.testnet",
    amount: nearAPI.nearToYocto("1.0"),
  });
  console.log("SUCCESS! Transfer completed. Tx Hash:", tx?.transaction?.hash || tx);
  process.exit(0);
}
run().catch(console.error);
