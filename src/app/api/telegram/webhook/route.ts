// src/app/api/telegram/webhook/route.ts
// Receives Telegram Webhook updates and dispatches replies

import { NextRequest, NextResponse } from "next/server";
import { handleTelegramMessage, sendTelegramReply } from "@/lib/telegram-bot";

// De-duplication cache for Telegram update IDs (prevents duplicate processing on retry)
const processedUpdateIds = new Map<number, number>();

function isDuplicateUpdate(updateId?: number): boolean {
  if (!updateId) return false;
  const now = Date.now();
  if (processedUpdateIds.size > 1000) {
    processedUpdateIds.forEach((time, id) => {
      if (now - time > 120_000) processedUpdateIds.delete(id);
    });
  }
  if (processedUpdateIds.has(updateId)) {
    return true;
  }
  processedUpdateIds.set(updateId, now);
  return false;
}

export async function POST(req: NextRequest) {
  try {
    // TASK-TG-01: Verify Telegram Bot API Secret Token header
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secretToken) {
      const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token");
      if (incomingSecret !== secretToken) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized: Invalid Telegram webhook secret token" },
          { status: 401 }
        );
      }
    }

    const update = await req.json();

    // SEC-TG-01: Drop duplicate update_ids resent by Telegram retry mechanism
    if (update.update_id && isDuplicateUpdate(update.update_id)) {
      return NextResponse.json({ ok: true, deduplicated: true });
    }

    // Check if this is a standard Telegram message update
    const message = update.message || update.edited_message || update.channel_post;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const user = message.from || { id: message.chat?.id || 12345, username: "telegram_user" };
    const reply = await handleTelegramMessage(message.text, user);

    // If chat_id matches, attempt to deliver via Telegram Bot API
    if (reply && reply.chatId) {
      await sendTelegramReply(reply);
    }

    return NextResponse.json({
      ok: true,
      delivered: true,
      reply,
    });
  } catch (err: any) {
    console.error("[Telegram Webhook Error]:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Failed to process Telegram update" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: "online",
    service: "VeilX Telegram Copilot Webhook",
    timestamp: new Date().toISOString(),
  });
}
