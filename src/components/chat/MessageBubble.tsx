"use client";

import React, { useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage } from "@/types/chat";
import { StatusRadar } from "./StatusRadar";
import {
  Copy,
  Check,
  Share2,
  ExternalLink,
  Loader2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { TokenIcon } from "@/components/icons/ChainTokenIcon";
import { ChainLogo } from "@/components/common/AssetLogo";
import { estimateGasFee, checkLowGasBalance } from "@/lib/gas-estimator";
import { validateTransferRoute } from "@/lib/address-guardrails";

interface MessageBubbleProps {
  message: ChatMessage;
  userAvatar?: string;
  onConfirmTip?: (messageId: string, tipData: Record<string, any>) => void;
  onCancelTip?: (messageId: string) => void;
  onClaimFaucet?: (messageId: string, targetAccount?: string) => void;
  onConfirmDirectTransfer?: (messageId: string, transferData: Record<string, any>) => void;
  onPayInvoice?: (messageId: string, invoiceData: Record<string, any>) => void;
  onExecuteIntent?: (messageId: string, intentData: Record<string, any>) => void;
  onProceedPendingCommand?: (command: string) => void;
}

// Strip any rogue emojis and fix escaped/malformed markdown that AI or API responses might inject
function cleanContent(text: string): string {
  if (!text) return "";
  return text
    .replace(/𝕏/g, "X") // Normalize mathematical double-struck 𝕏 to standard X to prevent broken surrogate pairs
    .replace(new RegExp("[\\u{1F300}-\\u{1F9FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}]", "gu"), "") // Emoji removal
    .replace(/[✨🚀⚡👋🔒🌐💡💳🔵🤖]/g, "")
    // Remove internal MPC signer plumbing
    .replace(/(?:^|\n)[ \t]*-?\s*\*?\*?MPC Signer Contract\*?\*?:[^\n]+/gi, "")
    // Simplify verbose headings
    .replace(/\*\*Omnichain Portfolio & Session Authority Status\*\*/gi, "**Portfolio Balance**")
    .replace(/\*\*Universal EVM \(NEAR Chain Signatures MPC\)\*\*/gi, "**Base Sepolia**")
    // Normalize verbose session cap phrases to compact (spent/limit) format
    .replace(/Session Cap:\s*\$?[\d.]+\s*remaining today\s*\(spent\s*\$?([\d.]+)\s*of\s*\$?([\d.]+)\s*limit\)/gi, "Session Cap: ($$$1/$$$2)")
    .replace(/Session Spending Cap:\s*\$?[\d.]+\s*remaining today\.?/gi, "")
    // Strip raw spammy external faucet link blocks
    .replace(/Please claim free testnet tokens before executing:[\s\S]*?(?=(?:\n\n|$))/gi, "")
    // Compact raw transaction hash blocks
    .replace(/\*\*Transaction Hash:\*\*\s*\n\s*`?([0-9a-zA-Z]{32,})`?/g, (_m, h) => `Tx: \`${h.slice(0, 8)}...${h.slice(-6)}\``)
    // Shorten long raw 0x hex addresses inside prose to clean compact format (0x1234...5678)
    .replace(/0x[a-fA-F0-9]{38,42}/g, (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`)
    .replace(/\\\*/g, "*") // Fix escaped literal \* to regular *
    // Fix malformed asterisks lists like '*Item*:*' — only match truly malformed
    // patterns where asterisks are NOT used as standard markdown bold (**...**)
    .replace(/(?:^|\n)\s*\*([^*\n:]+)\*\s*:\s*\*(?!\*)/g, (_m, title) => `\n- **${title.trim()}:** `)
    .replace(/:\s*\*(?!\*)/g, ":") // Fix dangling single asterisks after colons (not ** bold)
    .replace(/^[ \t]*•/gm, "-") // Normalize bullet characters
    .trim();
}

function FormattedMessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  const sanitized = cleanContent(content);
  if (!sanitized) return null;

  return (
    <div className={`prose prose-sm max-w-none text-xs sm:text-[13px] leading-relaxed break-words [overflow-wrap:anywhere] ${
      isUser ? "text-[#FAF7F0]" : "text-[#1E1315]"
    }`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 leading-relaxed font-normal">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className={`font-bold ${isUser ? "text-white" : "text-[#1E1315]"}`}>
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className={`italic ${isUser ? "text-[#EFE8D8]" : "text-[#4A3B32]"}`}>{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="my-2 pl-4 list-disc space-y-1 marker:text-[#8C7A6B]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 pl-4 list-decimal space-y-1 marker:text-[#8C7A6B]">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-0.5">{children}</li>
          ),
          code: ({ children, className }) => {
            const isBlock = Boolean(className?.includes("language-")) || String(children).includes("\n");
            if (isBlock) {
              return (
                <pre className="p-2.5 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5] text-[#1E1315] font-mono text-[11px] overflow-x-auto my-2">
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code
                className={`px-1.5 py-0.5 rounded-md font-mono text-[11px] font-semibold break-all inline-block ${
                  isUser
                    ? "bg-[#2C1D20] text-[#FAF7F0] border border-[#443236]"
                    : "bg-[#FAF7F0] text-[#1E1315] border border-[#EBE3D5]"
                }`}
              >
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`font-semibold underline underline-offset-2 transition ${
                isUser ? "text-[#FAF7F0] hover:text-white" : "text-[#1E1315] hover:text-[#6B5A4E]"
              }`}
            >
              {children}
            </a>
          ),
        }}
      >
        {sanitized}
      </ReactMarkdown>
    </div>
  );
}

export function MessageBubble({
  message,
  userAvatar,
  onConfirmTip,
  onCancelTip,
  onClaimFaucet,
  onConfirmDirectTransfer,
  onPayInvoice,
  onExecuteIntent,
  onProceedPendingCommand,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [selectedChain, setSelectedChain] = useState<string>(
    message.actionCard?.data?.chain || "near"
  );

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareOnX = (payUrl: string, amount: number) => {
    const tweet = `Pay this invoice of $${amount.toFixed(2)} on @VeilXapp: ${payUrl}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`, "_blank");
  };

  const defaultUserAvatar = userAvatar || "https://unavatar.io/twitter/expatq3";

  return (
    <div className={`flex gap-2.5 sm:gap-3 my-3 sm:my-3.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Monogram Avatar - Zero AI / Robot cartoon icons */}
      <div
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold shadow-2xs ${
          isUser
            ? "bg-[#1E1315] text-[#FAF7F0] border border-[#2C1D20]"
            : "bg-[#1E1315] text-[#FAF7F0] border border-[#1E1315]"
        }`}
      >
        {isUser ? (
          <Image
            src={defaultUserAvatar}
            alt="User Avatar"
            width={32}
            height={32}
            unoptimized
            className="w-full h-full object-cover"
          />
        ) : (
          <Image
            src="/veil.png"
            alt="Veil Agent"
            width={32}
            height={32}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Bubble & Action Card Content */}
      <div
        className={`min-w-0 flex-1 overflow-hidden flex flex-col ${
          isUser
            ? "max-w-[92%] sm:max-w-[80%] items-end"
            : message.actionCard
            ? "w-full max-w-full sm:max-w-md items-start"
            : "max-w-[92%] sm:max-w-[80%] items-start"
        }`}
      >
        {/* Message Text Bubble */}
        {message.content && (
          <div
            className={`p-3.5 sm:p-4 rounded-2xl text-xs sm:text-[13px] leading-relaxed min-w-0 break-words shadow-2xs ${
              isUser
                ? "bg-[#1E1315] text-[#FAF7F0] rounded-tr-xs"
                : "bg-white border border-[#EBE3D5] text-[#1E1315] rounded-tl-xs"
            }`}
          >
            <FormattedMessageContent content={message.content} isUser={isUser} />
          </div>
        )}

        {/* Un-nested Action Cards: Expands to full mobile width (w-full max-w-full sm:max-w-md) with 14px padding and 44px touch targets */}
        {message.actionCard && (
          <div className="w-full max-w-full sm:max-w-md mt-2 space-y-2">
            {/* Action Card: Confirmation Required */}
            {message.actionCard?.type === "confirm_tip" && (
              <div className="p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#1E1315]">
                  <span className="font-semibold text-xs tracking-tight flex items-center gap-1.5">
                    {message.actionCard.data.isQuarantined ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-amber-900 font-bold">Anomaly Quarantine (Held)</span>
                      </>
                    ) : (
                      <span>Confirm Tip Authorization</span>
                    )}
                  </span>
                  <span className="font-mono text-sm font-bold text-[#1E1315]">
                    {message.actionCard.data.amount} {message.actionCard.data.asset}
                  </span>
                </div>

                {message.actionCard.data.isQuarantined && (
                  <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 leading-tight">
                    ⚠️ This transaction exceeds your <strong>${Number(message.actionCard.data.perTxMax || 15).toFixed(2)}</strong> auto-approval cap. Click Authorize to execute manually.
                  </div>
                )}

                <div className="bg-white p-3 rounded-xl border border-[#EBE3D5] text-xs text-[#1E1315] space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[#7A6A5E] font-medium">Recipient:</span>
                    <span className="font-bold text-[#1E1315]">@{message.actionCard.data.recipientHandle}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#7A6A5E] font-medium">Network:</span>
                    <span className="font-mono text-[11px] text-[#1E1315]">NEAR Protocol (Testnet)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#7A6A5E] font-medium">Authority:</span>
                    <span className="font-mono text-[11px] text-[#7A6A5E]">
                      {message.actionCard.data.isQuarantined ? "Human-in-the-Loop Signoff" : "Delegated Session Key"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1.5 border-t border-[#F5EFE6] text-xs">
                    <span className="text-[#7A6A5E] font-medium">Network Gas:</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Free (Sponsored)</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onConfirmTip?.(message.id, message.actionCard!.data)}
                    disabled={message.actionCard.data.isBroadcasting}
                    className={`flex-1 min-h-[44px] py-2.5 px-3 rounded-xl text-[#FAF7F0] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50 ${
                      message.actionCard.data.isQuarantined
                        ? "bg-amber-800 hover:bg-amber-900"
                        : "bg-[#1E1315] hover:bg-[#2C1D20]"
                    }`}
                  >
                    {message.actionCard.data.isBroadcasting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Broadcasting to NEAR...</span>
                      </>
                    ) : (
                      <span>{message.actionCard.data.isQuarantined ? "Authorize & Execute Spend" : "Confirm & Send Tip"}</span>
                    )}
                  </button>
                  <button
                    onClick={() => onCancelTip?.(message.id)}
                    disabled={message.actionCard.data.isBroadcasting}
                    className="min-h-[44px] py-2.5 px-4 rounded-xl bg-white hover:bg-[#FAF7F0] border border-[#EBE3D5] text-[#1E1315] text-xs font-semibold transition cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Action Card: Direct Transfer Confirmation */}
            {message.actionCard?.type === "confirm_direct" && (
              <div className="p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#1E1315]">
                  <span className="font-semibold tracking-tight flex items-center gap-1.5">
                    {message.actionCard.data.isQuarantined ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-amber-900 font-bold">Anomaly Quarantine (Held)</span>
                      </>
                    ) : (
                      <span>Direct On-Chain Transfer</span>
                    )}
                  </span>
                  <span className="font-mono text-sm font-bold text-[#1E1315]">
                    {message.actionCard.data.amount} {message.actionCard.data.asset}
                  </span>
                </div>

                {message.actionCard.data.isQuarantined && (
                  <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 leading-tight">
                    ⚠️ This transfer exceeds your <strong>${Number(message.actionCard.data.perTxMax || 15).toFixed(2)}</strong> auto-approval cap. Click Authorize to execute manually.
                  </div>
                )}

                <div className="bg-white p-3 rounded-xl border border-[#EBE3D5] text-xs text-[#1E1315] space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[#7A6A5E] font-medium">Destination:</span>
                    <span className="font-mono font-bold text-[#1E1315] truncate max-w-[190px]" title={message.actionCard.data.recipientAddress}>
                      {message.actionCard.data.recipientAddress}
                    </span>
                  </div>

                  {/* Interactive Multi-Chain Source Selector */}
                  <div className="pt-2 pb-1 border-t border-[#F5EFE6] space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#7A6A5E] font-medium">Source Chain:</span>
                      <span className="text-[11px] font-mono font-bold text-[#1E1315] uppercase">{selectedChain}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5] w-full">
                      {[
                        { id: "near", label: "NEAR" },
                        { id: "base", label: "Base" },
                        { id: "arbitrum", label: "Arb" },
                        { id: "ethereum", label: "Eth" },
                      ].map((c) => {
                        const isSelected = selectedChain.toLowerCase() === c.id || (c.id !== "near" && selectedChain.toLowerCase().includes(c.id));
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedChain(c.id);
                              if (message.actionCard?.data) {
                                message.actionCard.data.chain = c.id;
                                message.actionCard.data.chainId =
                                  c.id === "near" ? 0 : c.id === "base" ? 84532 : c.id === "arbitrum" ? 421614 : 11155111;
                              }
                            }}
                            className={`min-h-[36px] py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer w-full text-center ${
                              isSelected
                                ? "bg-[#1E1315] text-[#FAF7F0] shadow-xs border border-[#1E1315]"
                                : "bg-white/80 hover:bg-white text-[#7A6A5E] hover:text-[#1E1315] border border-transparent hover:border-[#EBE3D5]"
                            }`}
                          >
                            <ChainLogo chain={c.id} className="w-3.5 h-3.5 rounded-full shrink-0" />
                            <span className="truncate">{c.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#7A6A5E] font-medium">Routing:</span>
                    <div className="flex items-center gap-1.5">
                      <ChainLogo chain={selectedChain} className="w-3.5 h-3.5 rounded-full shrink-0" />
                      <span className="text-[11px] font-semibold text-[#1E1315]">Direct Settlement ({selectedChain.toUpperCase()})</span>
                    </div>
                  </div>

                  {/* Pre-Flight Gas Fee Badge & Route Safety Guardrails */}
                  {(() => {
                    const isNear = selectedChain.toLowerCase() === "near";
                    const gas = estimateGasFee(selectedChain, !isNear);
                    const balance = message.actionCard.data.senderBalance ?? message.actionCard.data.userBalance ?? message.actionCard.data.balance;
                    const lowGasCheck = balance !== undefined ? checkLowGasBalance(balance, selectedChain, !isNear) : null;
                    const routeCheck = message.actionCard.data.recipientAddress
                      ? validateTransferRoute(selectedChain, message.actionCard.data.recipientAddress, message.actionCard.data.asset)
                      : null;

                    return (
                      <div className="space-y-1.5 pt-1.5 border-t border-[#F5EFE6]">
                        {routeCheck && routeCheck.needsRouteConversion && (
                          <div className="p-2 rounded-lg bg-blue-50/90 border border-blue-200 text-[11px] text-blue-900 leading-tight flex items-start gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                            <span>{routeCheck.warning}</span>
                          </div>
                        )}

                        {lowGasCheck && lowGasCheck.isLow && (
                          <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 leading-tight flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>{lowGasCheck.warning}</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center">
                          <span className="text-[#7A6A5E] font-medium text-xs">Estimated Gas:</span>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#FAF7F0] border border-[#EBE3D5] text-[#1E1315]">
                            <span className={`w-1.5 h-1.5 rounded-full ${gas.isSponsored ? "bg-emerald-500 animate-pulse" : "bg-blue-500"}`} />
                            <span>{gas.badgeLabel}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onConfirmDirectTransfer?.(message.id, { ...message.actionCard!.data, chain: selectedChain })}
                    disabled={message.actionCard.data.isBroadcasting}
                    className={`flex-1 min-h-[44px] py-2.5 px-3 rounded-xl text-[#FAF7F0] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50 ${
                      message.actionCard.data.isQuarantined
                        ? "bg-amber-800 hover:bg-amber-900"
                        : "bg-[#1E1315] hover:bg-[#2C1D20]"
                    }`}
                  >
                    {message.actionCard.data.isBroadcasting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Broadcasting Transfer...</span>
                      </>
                    ) : (
                      <span>{message.actionCard.data.isQuarantined ? "Authorize & Execute Spend" : "Confirm & Send Direct"}</span>
                    )}
                  </button>
                  <button
                    onClick={() => onCancelTip?.(message.id)}
                    disabled={message.actionCard.data.isBroadcasting}
                    className="min-h-[44px] py-2.5 px-4 rounded-xl bg-white hover:bg-[#FAF7F0] border border-[#EBE3D5] text-[#1E1315] text-xs font-semibold transition cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Action Card: Pay Invoice via Agent */}
            {message.actionCard?.type === "pay_invoice" && (
              <div className="p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#1E1315]">
                  <span className="font-semibold tracking-tight">Settle Invoice Request</span>
                  <span className="font-mono text-sm font-bold text-[#1E1315]">
                    ${Number(message.actionCard.data.amountUsd || 0).toFixed(2)} USD
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-[#EBE3D5] text-xs text-[#1E1315] space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[#7A6A5E] font-medium">Invoice:</span>
                    <span className="font-mono text-[#1E1315] font-semibold">{message.actionCard.data.slug}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#7A6A5E] font-medium">Recipient:</span>
                    <span className="font-mono text-[#1E1315] font-semibold truncate max-w-[190px]">{message.actionCard.data.recipientNearAccount}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onPayInvoice?.(message.id, message.actionCard!.data)}
                    disabled={message.actionCard.data.isPaying}
                    className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {message.actionCard.data.isPaying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Settling Invoice...</span>
                      </>
                    ) : (
                      <span>Confirm &amp; Settle Invoice</span>
                    )}
                  </button>
                  <button
                    onClick={() => onCancelTip?.(message.id)}
                    disabled={message.actionCard.data.isPaying}
                    className="min-h-[44px] py-2.5 px-4 rounded-xl bg-white hover:bg-[#FAF7F0] border border-[#EBE3D5] text-[#1E1315] text-xs font-semibold transition cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Action Card: Cross-Chain Intent (Defuse 1Click Route) */}
            {message.actionCard?.type === "cross_chain_intent" && (
              <div className="p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] space-y-3 shadow-2xs">
                {message.actionCard.data.isQuarantined && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs flex items-center gap-2">
                    ⚠️ This intent exceeds your <strong>${Number(message.actionCard.data.perTxMax || 15).toFixed(2)}</strong> auto-approval cap. Click Authorize to execute manually.
                  </div>
                )}
                <div className="flex items-center justify-between text-xs font-bold text-[#1E1315]">
                  <span className="font-semibold text-xs tracking-tight">
                    Cross-Chain Intent Route
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white text-[#1E1315] border border-[#EBE3D5] flex items-center gap-1.5">
                    {message.actionCard.data.isConfidential || message.actionCard.data.shieldStatus ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        <span>🔒 MEV-Shielded</span>
                      </>
                    ) : (
                      <span>1Click Solver Settlement</span>
                    )}
                  </span>
                </div>

                {/* Swap Diagram: Source -> Destination */}
                <div className="bg-white p-3.5 rounded-xl border border-[#EBE3D5] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <TokenIcon
                        symbol={message.actionCard.data.sourceAsset}
                        chain={message.actionCard.data.sourceChain || "NEAR"}
                        size={28}
                      />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[#7A6A5E] uppercase tracking-wider">
                          Source ({message.actionCard.data.sourceChain || "NEAR"})
                        </span>
                        <span className="text-sm font-extrabold text-[#1E1315] font-mono">
                          {message.actionCard.data.sourceAmount} {message.actionCard.data.sourceAsset}
                        </span>
                      </div>
                    </div>

                    <ArrowRight className="w-4 h-4 text-[#7A6A5E] shrink-0" />

                    <div className="flex items-center gap-2.5 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-[#7A6A5E] uppercase tracking-wider">
                          Target ({message.actionCard.data.targetChain})
                        </span>
                        <span className="text-sm font-extrabold text-[#1E1315] font-mono">
                          {message.actionCard.data.targetAmount} {message.actionCard.data.targetAsset}
                        </span>
                      </div>
                      <TokenIcon
                        symbol={message.actionCard.data.targetAsset}
                        chain={message.actionCard.data.targetChain}
                        size={28}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#F2EBDC] flex items-center justify-between text-[11px] text-[#7A6A5E]">
                    <span>Recipient:</span>
                    <strong className="text-[#1E1315] font-mono">
                      {message.actionCard.data.recipientHandle
                        ? `@${message.actionCard.data.recipientHandle}`
                        : message.actionCard.data.recipient}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#8C7A6B]">
                    <span>Estimated Solver Fee:</span>
                    <span className="font-mono">~${Number(message.actionCard.data.estimatedFeeUsd || 0.04).toFixed(2)} USD • Zero Slippage</span>
                  </div>
                </div>

                {/* Action Buttons: Only show when not settled */}
                {!message.actionCard.data.isSettled ? (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onExecuteIntent?.(message.id, message.actionCard!.data)}
                      disabled={message.actionCard.data.isExecuting}
                      className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {message.actionCard.data.isExecuting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Settling via Solvers...</span>
                        </>
                      ) : (
                        <span>{message.actionCard.data.isQuarantined ? "Authorize & Execute Spend" : "Confirm & Execute Intent"}</span>
                      )}
                    </button>
                    <button
                      onClick={() => onCancelTip?.(message.id)}
                      disabled={message.actionCard.data.isExecuting}
                      className="min-h-[44px] py-2.5 px-4 rounded-xl bg-white hover:bg-[#FAF7F0] border border-[#EBE3D5] text-[#1E1315] text-xs font-semibold transition cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-1 px-1 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Settled on {message.actionCard.data.targetChain}</span>
                    </span>
                    {message.actionCard.data.destinationTxHash && (
                      <a
                        href={
                          message.actionCard.data.targetChain === "BASE"
                            ? `https://sepolia.basescan.org/tx/${message.actionCard.data.destinationTxHash}`
                            : `https://testnet.nearblocks.io/txns/${message.actionCard.data.destinationTxHash}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-[#7A6A5E] hover:text-[#1E1315] underline flex items-center gap-0.5"
                      >
                        <span>Explorer</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action Card: Invoice / PayLink */}
            {message.actionCard?.type === "invoice" && (
              <div className="p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5]">
                <div className="flex items-center justify-between text-xs font-bold text-[#1E1315] mb-1">
                  <span className="font-semibold tracking-tight">PayLink Generated</span>
                  <span className="text-[#1E1315] font-mono text-sm">
                    ${message.actionCard.data.amountUsd?.toFixed(2)} USD
                  </span>
                </div>
                <p className="text-xs text-[#7A6A5E] font-medium truncate mb-2.5">
                  {message.actionCard.data.memo || "Invoice payment"}
                </p>

                {/* Link Input & Copy */}
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    readOnly
                    value={message.actionCard.data.payUrl}
                    className="w-full h-11 bg-white text-xs px-3 py-2 rounded-xl border border-[#EBE3D5] text-[#1E1315] font-mono focus:outline-none shadow-2xs"
                  />
                  <button
                    onClick={() => handleCopy(message.actionCard?.data.payUrl)}
                    className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-white hover:bg-[#FAF7F0] border border-[#EBE3D5] text-[#1E1315] transition cursor-pointer shrink-0 flex items-center justify-center"
                    title="Copy link"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() =>
                      handleShareOnX(message.actionCard?.data.payUrl, message.actionCard?.data.amountUsd)
                    }
                    className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share on X</span>
                  </button>
                  <a
                    href={message.actionCard?.data.payUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] py-2.5 px-4 rounded-xl bg-white hover:bg-[#FAF7F0] border border-[#EBE3D5] text-[#1E1315] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
                  >
                    <span>Open PayLink</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* Action Card: Testnet Faucet - Institutional VeilX Neutral Styling (Zero Loud Orange) */}
            {message.actionCard?.type === "faucet" && (
              <div className="p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#1E1315]">
                  <span className="font-semibold tracking-tight">Testnet Token Dispenser</span>
                  <span className="px-2 py-0.5 rounded-full bg-white border border-[#EBE3D5] text-[#1E1315] text-[10px] font-mono font-bold">
                    0.25 NEAR Free
                  </span>
                </div>
                <p className="text-xs text-[#7A6A5E] font-medium leading-relaxed">
                  {message.actionCard.data?.message || "Replenish your testnet account with 0.25 NEAR to cover transactions and gas."}
                </p>

                {message.actionCard.data?.txHash ? (
                  <div className="p-3 rounded-xl bg-white border border-[#EBE3D5] text-[#1E1315] text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>0.25 NEAR Dispensed Successfully</span>
                    </div>
                    <a
                      href={`https://testnet.nearblocks.io/txns/${message.actionCard.data.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono text-[#7A6A5E] hover:text-[#1E1315] underline truncate block"
                    >
                      Tx: {message.actionCard.data.txHash}
                    </a>

                    {/* Reactive Intent Continuation (Workstream 4) */}
                    {message.actionCard.data?.pendingIntent && (
                      <button
                        type="button"
                        onClick={() => onProceedPendingCommand?.(message.actionCard?.data?.pendingIntent?.commandText)}
                        className="w-full mt-2 min-h-[44px] py-2.5 px-3 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Proceed with Intent: {message.actionCard.data.pendingIntent.label || "Resume Transaction"}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onClaimFaucet?.(message.id, message.actionCard?.data?.targetAccount)}
                      disabled={message.actionCard?.data?.isClaiming}
                      className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] text-[#FAF7F0] font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {message.actionCard?.data?.isClaiming ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Dispensing 0.25 NEAR...</span>
                        </>
                      ) : (
                        <span>Claim 0.25 Testnet NEAR</span>
                      )}
                    </button>
                    <a
                      href="https://faucet.testnet.near.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] py-2.5 px-4 rounded-xl bg-white hover:bg-[#FAF7F0] border border-[#EBE3D5] text-[#1E1315] text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer shrink-0"
                    >
                      <span>Official</span>
                      <ExternalLink className="w-3 h-3 text-[#7A6A5E]" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Live Status Radar: only show while actively in progress (processing/pending) or if message has no confirmation text */}
            {message.actionCard?.radar && (!message.content || message.actionCard.radar.some((s) => s.status === "processing" || s.status === "pending")) && (
              <StatusRadar steps={message.actionCard.radar} />
            )}
          </div>
        )}

        <span className="text-[10px] font-mono text-[#8C7A6B] mt-1 block px-1">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}
