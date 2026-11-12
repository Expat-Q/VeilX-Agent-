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
    <div className="my-3 p-3.5 rounded-2xl border border-[#EBE3D5] bg-[#FAF7F0] shadow-2xs">
      <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-[#F2EBDC] text-[11px] font-mono font-bold tracking-wider uppercase text-[#1E1315]">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
        </span>
        <span>{title}</span>
      </div>

      <div className="space-y-2.5">
        {steps.map((step) => {
          return (
            <div key={step.id} className="flex items-start gap-2.5 text-xs">
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
                  {step.label}
                </span>

                {step.txHash && (
                  <div className="text-[11px] text-[#7A6A5E] font-mono mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className="font-semibold text-[#1E1315] bg-[#F2EBDC] px-2 py-0.5 rounded text-[11px] tracking-tight"
                      title={step.txHash}
                    >
                      Tx: {step.txHash.length > 20 ? `${step.txHash.slice(0, 10)}...${step.txHash.slice(-8)}` : step.txHash}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleCopy(step.txHash!)}
                      title="Copy full transaction hash"
                      className="inline-flex items-center gap-1 text-[10px] text-[#5C4D4F] hover:text-[#1E1315] px-2 py-0.5 rounded-md bg-white border border-[#EBE3D5] hover:border-[#D5C7B5] transition cursor-pointer shadow-2xs font-sans font-medium"
                    >
                      {copiedTx === step.txHash ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Hash</span>
                        </>
                      )}
                    </button>

                    <a
                      href={getExplorerUrl(step.txHash, step.chain)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0052FF] hover:underline font-bold inline-flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 rounded-md bg-white border border-[#EBE3D5] hover:border-[#0052FF]/30 transition shadow-2xs"
                    >
                      <span>View on {getExplorerName(step.chain)}</span>
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
