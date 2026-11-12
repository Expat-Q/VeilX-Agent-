// src/app/api/near/rpc/route.ts
// Same-Origin Next.js JSON-RPC Proxy for NEAR Protocol
// Eliminates browser CORS preflight restrictions and network drops

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RPC_ENDPOINTS = [
  "https://test.rpc.fastnear.com",
  process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://test.rpc.fastnear.com",
  "https://rpc.testnet.pagoda.co",
].filter((url, idx, arr) => arr.indexOf(url) === idx);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let lastError: any = null;
    for (const rpcUrl of RPC_ENDPOINTS) {
      try {
        // MPC sign calls take 10-25s on NEAR testnet validators. Give adequate timeout for transaction broadcasts.
        const controller = new AbortController();
        const isTxBroadcast = body?.method === "broadcast_tx_commit" || body?.method === "broadcast_tx_async";
        const timeoutMs = isTxBroadcast ? 60000 : 25000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          // If upstream returns a 429 deprecation message inside 200 OK, try next provider
          if (data?.error?.code === -429 || (typeof data?.error?.message === "string" && data.error.message.includes("DEPRECATED"))) {
            continue;
          }
          return NextResponse.json(data, {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          });
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: body?.id ?? "error",
        error: {
          code: -32000,
          message: lastError?.message || "All NEAR RPC endpoints timed out or failed",
        },
      },
      { status: 502 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: "error",
        error: {
          code: -32700,
          message: err?.message || "Invalid JSON-RPC request",
        },
      },
      { status: 400 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
