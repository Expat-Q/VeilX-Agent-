// src/app/api/user/budget/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { handle, dailyLimitUsd, weeklyLimitUsd } = body;

    if (!handle) {
      return NextResponse.json({ error: "handle is required" }, { status: 400 });
    }

    const cleanHandle = handle.replace("@", "").trim().toLowerCase();
    await connectToDatabase();

    const updateFields: any = {};
    if (typeof dailyLimitUsd === "number") updateFields.spendingLimitUsd = dailyLimitUsd;
    if (typeof weeklyLimitUsd === "number") updateFields.weeklyLimitUsd = weeklyLimitUsd;

    const user = await User.findOneAndUpdate(
      { xHandle: cleanHandle },
      { $set: updateFields },
      { new: true }
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      spendingLimitUsd: user.spendingLimitUsd,
      weeklyLimitUsd: user.weeklyLimitUsd,
    });
  } catch (err: any) {
    console.error("POST /api/user/budget error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
