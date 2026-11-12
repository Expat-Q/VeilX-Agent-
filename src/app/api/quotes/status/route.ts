import { NextResponse } from "next/server";

const ONECLICK_BASE = "https://1click.chaindefuser.com";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const depositAddress = searchParams.get("depositAddress");

    if (!depositAddress) {
      return NextResponse.json(
        { error: "Missing depositAddress query parameter" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${ONECLICK_BASE}/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `1Click Status API error: ${errText}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      success: true,
      status: data.status, // "PENDING_DEPOSIT" | "DEPOSITED" | "PROCESSING" | "SETTLED" | "REFUNDED"
      updatedAt: data.updatedAt,
      swapDetails: data.swapDetails,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch intent status" },
      { status: 500 }
    );
  }
}
