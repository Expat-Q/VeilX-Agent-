"use client";

import React, { useState } from "react";
import { RadarStep } from "@/types/chat";
import { CheckCircle2, Loader2, Circle, AlertCircle, ExternalLink, Copy, Check } from "lucide-react";

interface StatusRadarProps {
  steps: RadarStep[];
  title?: string;
}

function getExplorerUrl(txHash: string, chain?: string): string {
  const c = (chain || "").toLowerCase();
  if (c.includes("base")) {
    return `https://sepolia.basescan.org/tx/${txHash}`;
  }
  if (c.includes("arb")) {
    return `https://sepolia.arbiscan.io/tx/${txHash}`;
  }
  if (c.includes("eth") || c.includes("sepolia")) {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }
  return `https://testnet.nearblocks.io/txns/${txHash}`;
}

function getExplorerName(chain?: string): string {
  const c = (chain || "").toLowerCase();
  if (c.includes("base")) return "Basescan";
  if (c.includes("arb")) return "Arbiscan";
  if (c.includes("eth") || c.includes("sepolia")) return "Etherscan";
  return "Nearblocks";
}

export function StatusRadar({ steps, title = "Live Execution Radar" }: StatusRadarProps) {
  const [copiedTx, setCopiedTx] = useState<string | null>(null);

  const handleCopy = (txHash: string) => {
    try {
      navigator.clipboard.writeText(txHash);
      setCopiedTx(txHash);
      setTimeout(() => setCopiedTx(null), 2000);
    } catch {}
  };

  return (
    <div className="mt-2.5 p-3 rounded-xl border border-[#EBE3D5] bg-[#FAF7F0] space-y-2">
      <div className="flex items-center gap-1.5 pb-1.5 border-b border-[#F2EBDC] text-[10px] font-mono font-bold tracking-wider uppercase text-[#7A6A5E]">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
        </span>
        <span>{title}</span>
      </div>

      <div className="space-y-2">
        {steps.map((step) => {
          return (
            <div key={step.id} className="flex items-start gap-2 text-xs">
              <div className="mt-0.5 shrink-0">
                {step.status === "completed" && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                )}
                {step.status === "processing" && (
                  <Loader2 className="w-3.5 h-3.5 text-[#1E1315] animate-spin" />
                )}
                {step.status === "pending" && (
                  <Circle className="w-3.5 h-3.5 text-[#B0A396]" />
                )}
                {step.status === "failed" && (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <span
                  className={
                    step.status === "completed"
                      ? "text-[#1E1315] font-semibold"
                      : step.status === "processing"
                      ? "text-[#1E1315] font-semibold"
                      : "text-[#7A6A5E] font-normal"
                  }
                >
                  {step.label
                    .replace(/via NEAR (?:MPC|Session) Key/gi, "Authorized")
                    .replace(/0x[a-fA-F0-9]{38,42}/g, (a) => `${a.slice(0, 6)}...${a.slice(-4)}`)}
                </span>

                {step.txHash && (
                  <div className="text-[11px] text-[#7A6A5E] font-mono mt-0.5 flex items-center gap-2">
                    <span className="font-semibold text-[#1E1315]">
                      Tx: {step.txHash.length > 20 ? `${step.txHash.slice(0, 8)}...${step.txHash.slice(-6)}` : step.txHash}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleCopy(step.txHash!)}
                      title="Copy full transaction hash"
                      className="p-0.5 rounded hover:bg-[#EFE8D8] text-[#5C4D4F] hover:text-[#1E1315] transition cursor-pointer"
                    >
                      {copiedTx === step.txHash ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>

                    <a
                      href={getExplorerUrl(step.txHash, step.chain)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-medium font-sans ml-auto"
                    >
                      <span>{getExplorerName(step.chain)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
