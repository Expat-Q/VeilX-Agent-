// src/lib/telegram-bot.ts
// VeilX Telegram Copilot Service
// Handles Telegram summoning (/tip, /invoice, /pay, /evm) and natural AI copilot interactions

import { connectToDatabase } from "@/lib/mongodb";
import { PayLink } from "@/models/PayLink";
import { TelegramChat } from "@/models/TelegramChat";
import { processUserMessage } from "@/lib/ai-gateway";
import { deriveEvmAddress } from "@/lib/near-chain-signatures";
import { resolveIntentValue } from "@/lib/near-price";
import { sanitizeNearAccountId } from "@/lib/near-utils";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const BASE_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const DEFAULT_NEAR_ACCOUNT = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "veilx-agent.testnet";

// In-Memory Multi-Turn History Cache Fallback for Telegram Users
const memoryFallback: Map<number, Array<{ role: string; content: string }>> = new Map();

export async function getTelegramHistory(userId: number): Promise<Array<{ role: string; content: string }>> {
  try {
    await connectToDatabase();
    const chat = await TelegramChat.findOne({ chatId: userId }).lean() as any;
    if (chat && chat.history && chat.history.length > 0) {
      return chat.history.map((m: any) => ({ role: m.role, content: m.content }));
    }
  } catch (err) {
    console.warn("[TelegramBot] DB history lookup fallback:", err);
  }
  return memoryFallback.get(userId) || [];
}

export async function appendTelegramHistory(userId: number, role: "user" | "assistant" | "system", content: string) {
  // Update in-memory fallback
  const mem = memoryFallback.get(userId) || [];
  mem.push({ role, content });
  if (mem.length > 12) mem.splice(0, mem.length - 12);
  memoryFallback.set(userId, mem);

  try {
    await connectToDatabase();
    await TelegramChat.findOneAndUpdate(
      { chatId: userId },
      {
        $push: {
          history: {
            $each: [{ role, content, timestamp: new Date() }],
            $slice: -12, // Keep last 12 messages
          },
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn("[TelegramBot] DB history save fallback:", err);
  }
}

export interface TelegramMessageResponse {
  chatId: number | string;
  text: string;
  parseMode?: "HTML" | "Markdown" | "MarkdownV2";
  inlineKeyboard?: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
  actionData?: any;
}

/**
 * Sends a message back to Telegram via the Telegram Bot HTTP API
 */
export async function sendTelegramReply(payload: TelegramMessageResponse): Promise<{ success: boolean; result?: any; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[TelegramBot] TELEGRAM_BOT_TOKEN is not configured in environment.");
    return {
      success: false,
      error: "TELEGRAM_BOT_TOKEN is not configured in environment",
    };
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const body: any = {
      chat_id: payload.chatId,
      text: payload.text,
      parse_mode: payload.parseMode || "HTML",
      disable_web_page_preview: false,
    };

    if (payload.inlineKeyboard && payload.inlineKeyboard.length > 0) {
      body.reply_markup = {
        inline_keyboard: payload.inlineKeyboard,
      };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      console.warn("[Telegram Bot API Error]:", data);
      return { success: false, error: data.description || "Telegram API call failed" };
    }

    return { success: true, result: data.result };
  } catch (err: any) {
    console.error("[Telegram Send Exception]:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Core handler for any Telegram update (Command or Natural Language Chat)
 */
export async function handleTelegramMessage(messageText: string, user: { id: number; username?: string; first_name?: string }): Promise<TelegramMessageResponse> {
  const text = messageText.trim();
  const username = user.username ? `@${user.username}` : user.first_name || `tg_${user.id}`;
  const cleanUsername = user.username ? user.username.replace("@", "") : `tg_${user.id}`;
  // TASK-TG-02: Derive user-specific personal subaccount rather than sharing root contract account
  const nearAccount = sanitizeNearAccountId(cleanUsername);
  const isGroupChat = Number(user.id) < 0;

  // TASK-TG-04: Group Privacy Shield
  if (isGroupChat && (text.startsWith("/balance") || text.startsWith("/wallet"))) {
    return {
      chatId: user.id,
      text: `🔒 <i>Balance and confidential wallet details are hidden in group chats. Please open a direct chat with @VeilXAgentBot to view.</i>`,
      parseMode: "HTML",
    };
  }

  // TASK-TG-02: /link command to bind Telegram identity to VeilX WebApp session
  if (text.startsWith("/link")) {
    const linkToken = Buffer.from(
      JSON.stringify({ tgId: user.id, username: cleanUsername, exp: Date.now() + 15 * 60 * 1000 })
    ).toString("base64url");
    const linkUrl = `${BASE_APP_URL}/dashboard?link_tg=${user.id}&token=${linkToken}`;

    return {
      chatId: user.id,
      text: `🔗 <b>Link Telegram to your VeilX Web Account</b>\n\n` +
        `Click below to link your Telegram identity to your authenticated X handle and sync your personal subaccount:\n\n` +
        `<b>Your NEAR Subaccount:</b> <code>${nearAccount}</code>\n\n` +
        `<i>Link expires in 15 minutes.</i>`,
      parseMode: "HTML",
      inlineKeyboard: [
        [
          { text: "🔗 Connect VeilX WebApp", url: linkUrl },
        ],
      ],
    };
  }

  // 1. /start or /help command
  if (text.startsWith("/start") || text.startsWith("/help")) {
    const derived = deriveEvmAddress(nearAccount);
    const welcome = `🤖 <b>VeilX Omnichain Copilot</b>\n\n` +
      `Welcome ${username}! I turn your chats into an omnichain financial terminal powered by <b>NEAR Protocol</b>.\n\n` +
      `⚡ <b>Commands:</b>\n` +
      `• <code>/invoice &lt;amount&gt; [NEAR|USDC] [memo]</code> — Create an instant PayLink\n` +
      `• <code>/tip @handle &lt;amount&gt; [asset]</code> — Social tip to any user\n` +
      `• <code>/pay &lt;address&gt; &lt;amount&gt;</code> — Pay any NEAR (*.testnet) or EVM (0x...) wallet\n` +
      `• <code>/evm</code> — View your deterministic Base/Ethereum address via NEAR MPC\n\n` +
      `💬 <b>Natural Conversation:</b>\n` +
      `You can also just talk to me naturally:\n` +
      `<i>"create invoice 0.05 NEAR for design audit"</i>\n` +
      `<i>"send 0.1 near to alex.testnet"</i>`;

    return {
      chatId: user.id,
      text: welcome,
      parseMode: "HTML",
      inlineKeyboard: [
        [
          { text: "🚀 Open VeilX WebApp", url: BASE_APP_URL },
          { text: "🧾 Create 0.05 NEAR Invoice", callback_data: "/invoice 0.05 NEAR" },
        ],
      ],
    };
  }

  // 2. /evm or /wallet command
  if (text.startsWith("/evm") || text.startsWith("/wallet") || text.startsWith("/address")) {
    const derived = deriveEvmAddress(nearAccount);
    const msg = `🌐 <b>NEAR Chain Signatures — Omnichain Wallet</b>\n\n` +
      `<b>NEAR Account:</b> <code>${nearAccount}</code>\n` +
      `<b>Derived EVM Address:</b> <code>${derived.checksumAddress}</code>\n` +
      `<b>Derivation Path:</b> <code>${derived.derivationPath}</code>\n` +
      `<b>MPC Signer:</b> <code>${derived.mpcContractId}</code>\n\n` +
      `✨ <i>No separate seed phrase required! Your single NEAR session key controls this address across Base, Arbitrum, Ethereum, and Polygon.</i>`;

    return {
      chatId: user.id,
      text: msg,
      parseMode: "HTML",
      inlineKeyboard: [
        [
          { text: "🔍 View on BaseScan", url: `https://sepolia.basescan.org/address/${derived.checksumAddress}` },
        ],
      ],
      actionData: derived,
    };
  }

  // 3. /invoice command (e.g. "/invoice 0.05 NEAR for design review", "/invoice $20 website")
  if (text.startsWith("/invoice")) {
    const rawArgs = text.replace(/^\/invoice\s*/i, "").trim();
    const invoiceMatch = rawArgs.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?(?:\s+(?:for\s+)?(.+))?$/i);

    let amount = 0.05;
    let asset = "NEAR";
    let memo = "Payment Request";

    if (invoiceMatch) {
      amount = parseFloat(invoiceMatch[1]);
      if (invoiceMatch[2] && ["near", "usdc", "usd"].includes(invoiceMatch[2].toLowerCase())) {
        asset = invoiceMatch[2].toUpperCase();
      }
      if (invoiceMatch[3]) {
        memo = invoiceMatch[3].trim();
      }
    } else if (rawArgs) {
      memo = rawArgs;
    }

    // Resolve live USD valuation
    const val = await resolveIntentValue(amount, asset, asset === "USD" || text.includes("$"));
    const slug = `inv_${Math.random().toString(36).substring(2, 8)}`;
    const payUrl = `${BASE_APP_URL}/pay/${slug}`;
    const derived = deriveEvmAddress(nearAccount);

    // Persist to MongoDB
    try {
      await connectToDatabase();
      await PayLink.create({
        slug,
        creatorHandle: user.username || `tg_${user.id}`,
        recipientNearAccount: nearAccount,
        amountUsd: val.usdEquivalent || 15.0,
        memo,
        supportedChains: ["Base (USDC)", "Solana (SOL)", "NEAR (USDC)"],
        status: "active",
      });
    } catch (e: any) {
      console.warn("[Telegram Bot] DB save warning:", e.message);
    }

    const isNear = asset === "NEAR";
    const displayAmount = isNear ? `${val.amount} NEAR (~$${val.usdEquivalent.toFixed(2)} USD)` : `$${val.amount.toFixed(2)} ${asset}`;

    const replyMsg = `🧾 <b>VeilX PayLink Generated!</b>\n\n` +
      `💰 <b>Amount:</b> ${displayAmount}\n` +
      `📝 <b>Memo:</b> ${memo}\n` +
      `👤 <b>Recipient:</b> <code>${nearAccount}</code>\n` +
      `🔗 <b>Derived Base/EVM:</b> <code>${derived.checksumAddress}</code>\n\n` +
      `Payers can settle this invoice gaslessly using NEAR session keys, or cross-chain via Base USDC!`;

    return {
      chatId: user.id,
      text: replyMsg,
      parseMode: "HTML",
      inlineKeyboard: [
        [
          { text: "💳 Pay Invoice Now (1-Click)", url: payUrl },
        ],
        [
          { text: "🔗 Share PayLink", url: `https://t.me/share/url?url=${encodeURIComponent(payUrl)}&text=${encodeURIComponent(`Payment request: ${displayAmount} for ${memo}`)}` },
        ],
      ],
      actionData: { slug, payUrl, amount: val.amount, asset, memo },
    };
  }

  // 4. /tip command (e.g. "/tip @expatq3 0.1 NEAR")
  if (text.startsWith("/tip")) {
    const rawArgs = text.replace(/^\/tip\s*/i, "").trim();
    const tipMatch = rawArgs.match(/^@?([a-zA-Z0-9_.-]+)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/i);

    if (tipMatch) {
      const recipient = tipMatch[1].replace("@", "");
      const amount = parseFloat(tipMatch[2]);
      const asset = (tipMatch[3] || "NEAR").toUpperCase();
      const val = await resolveIntentValue(amount, asset, text.includes("$"));

      const isDirect = recipient.includes(".") || recipient.startsWith("0x");
      const confirmationUrl = `${BASE_APP_URL}/?action=tip&target=${encodeURIComponent(recipient)}&amount=${val.amount}&asset=${asset}`;

      const replyMsg = `💸 <b>Tip Prepared:</b>\n\n` +
        `👤 <b>To:</b> @${recipient}\n` +
        `💰 <b>Amount:</b> ${val.amount} ${asset} (~$${val.usdEquivalent.toFixed(2)} USD)\n` +
        `🔐 <b>Routing:</b> ${isDirect ? "Direct on-chain wallet transfer" : "Non-custodial NEAR Escrow"}\n\n` +
        `Click below to authorize and sign with your non-custodial session key:`;

      return {
        chatId: user.id,
        text: replyMsg,
        parseMode: "HTML",
        inlineKeyboard: [
          [
            { text: `⚡ Sign & Send ${val.amount} ${asset}`, url: confirmationUrl },
          ],
        ],
        actionData: { recipient, amount: val.amount, asset, isDirect },
      };
    }
  }

  // 5. Natural Language Processing fallback via AI Copilot Intent Engine with Multi-Turn Memory
  try {
    const history = await getTelegramHistory(user.id);
    const aiResult = await processUserMessage(text, history);

    // Record turn in session memory
    await appendTelegramHistory(user.id, "user", text);
    await appendTelegramHistory(user.id, "assistant", aiResult.assistantReply || "");

    if (aiResult.tool === "create_invoice") {
      const slug = `inv_${Math.random().toString(36).substring(2, 8)}`;
      const payUrl = `${BASE_APP_URL}/pay/${slug}`;
      const amount = aiResult.args.amount || 0.05;
      const asset = aiResult.args.asset || "NEAR";
      const memo = aiResult.args.memo || "Payment Request";
      const usdVal = aiResult.args.usdEquivalent || (amount * 4.29);

      try {
        await connectToDatabase();
        await PayLink.create({
          slug,
          creatorHandle: user.username || `tg_${user.id}`,
          recipientNearAccount: nearAccount,
          amountUsd: usdVal,
          memo,
          supportedChains: ["Base (USDC)", "Solana (SOL)", "NEAR (USDC)"],
          status: "active",
        });
      } catch (e: any) {
        console.warn("[Telegram Bot] DB save warning:", e.message);
      }

      return {
        chatId: user.id,
        text: `🧾 <b>PayLink Created:</b>\n${aiResult.assistantReply}\n\n🔗 <b>URL:</b> ${payUrl}`,
        parseMode: "HTML",
        inlineKeyboard: [
          [{ text: `💳 1-Click Pay (${amount} ${asset})`, url: payUrl }],
        ],
        actionData: { slug, payUrl, ...aiResult.args },
      };
    }

    if (aiResult.tool === "direct_transfer" || aiResult.tool === "tip_handle") {
      const target = aiResult.args.recipientAddress || aiResult.args.recipientHandle;
      const amount = aiResult.args.amount;
      const asset = aiResult.args.asset || "NEAR";
      const confirmUrl = `${BASE_APP_URL}/?action=transfer&target=${encodeURIComponent(target)}&amount=${amount}&asset=${asset}`;

      return {
        chatId: user.id,
        text: `⚡ <b>Agent Transfer Prepared:</b>\n${aiResult.assistantReply}`,
        parseMode: "HTML",
        inlineKeyboard: [
          [{ text: `🔐 Confirm & Sign (${amount} ${asset})`, url: confirmUrl }],
        ],
        actionData: aiResult.args,
      };
    }

    if (aiResult.tool === "check_balance") {
      const derived = deriveEvmAddress(nearAccount);
      return {
        chatId: user.id,
        text: `📊 <b>Omnichain Balances for ${nearAccount}:</b>\n\n` +
          `🔵 <b>NEAR Protocol Testnet:</b>\n` +
          `• Account: <code>${nearAccount}</code>\n\n` +
          `🟡 <b>Base Sepolia (EVM via NEAR Chain Signatures MPC):</b>\n` +
          `• 0x Address: <code>${derived.checksumAddress}</code>\n` +
          `• MPC Signer: <code>v1.signer-prod.testnet</code>\n\n` +
          `<i>Use the VeilX WebApp or /evm to view full balances & manage delegated keys.</i>`,
        parseMode: "HTML",
        inlineKeyboard: [
          [
            { text: "🔍 View on BaseScan", url: `https://sepolia.basescan.org/address/${derived.checksumAddress}` },
            { text: "🌐 Open VeilX App", url: BASE_APP_URL },
          ],
        ],
        actionData: { nearAccount, derivedAddress: derived.checksumAddress },
      };
    }

    // General conversational copilot response
    return {
      chatId: user.id,
      text: aiResult.assistantReply || "I am your VeilX financial copilot. How can I help with your payments today?",
      parseMode: "HTML",
    };
  } catch (err: any) {
    return {
      chatId: user.id,
      text: `🤖 <b>VeilX Copilot:</b> I received your message: <i>"${text}"</i>.\nTry typing <code>/invoice 0.05 NEAR</code> or <code>/tip @expatq3 0.1 NEAR</code>!`,
      parseMode: "HTML",
    };
  }
}
