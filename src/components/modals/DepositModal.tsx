"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useDerivedEvm } from "@/lib/use-derived-evm";
import { getStoredAgentSession } from "@/lib/near-embedded-wallet";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type DepositTab = "evm" | "near";

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { user, refreshAccountData } = useAuth();
  const [activeTab, setActiveTab] = useState<DepositTab>("evm");
  const [copied, setCopied] = useState(false);
  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const accountId = user?.nearAccountId || "veilx-agent.testnet";
  const activeSession = getStoredAgentSession(user?.xHandle);
  const derivedEvm = useDerivedEvm(accountId);

  if (!isOpen) return null;

  const currentAddress =
    activeTab === "evm"
      ? (derivedEvm.checksumAddress || "")
      : accountId;

  const handleCopy = () => {
    if (!currentAddress) return;
    navigator.clipboard.writeText(currentAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaimFaucet = async () => {
    setIsClaimingFaucet(true);
    setFaucetMsg(null);
    try {
      const res = await fetch("/api/near/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAccount: accountId,
          userHandle: user?.xHandle,
          publicKey: activeSession?.publicKey,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        let msg = data.error;
        if (typeof msg === "object" && msg !== null) {
          msg = msg.message || JSON.stringify(msg);
        }
        throw new Error(msg || "Faucet claim failed");
      }
      await refreshAccountData();
      setFaucetMsg({
        type: "success",
        text: "Successfully claimed 0.25 testnet NEAR",
      });
    } catch (err: any) {
      setFaucetMsg({
        type: "error",
        text: err.message || "Failed to dispense testnet tokens",
      });
    } finally {
      setIsClaimingFaucet(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1315]/40 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-sm bg-white border border-[#EBE3D5] rounded-2xl p-5 shadow-xl space-y-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#F2EBDC]">
          <h3 className="text-sm font-semibold text-[#1E1315]">Deposit</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#7A6A5E] hover:text-[#1E1315] hover:bg-[#FAF7F0] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Minimal Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#FAF7F0] border border-[#EBE3D5] rounded-xl">
          <button
            type="button"
            onClick={() => {
              setActiveTab("evm");
              setFaucetMsg(null);
            }}
            className={`py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === "evm"
                ? "bg-[#1E1315] text-[#FAF7F0]"
                : "text-[#7A6A5E] hover:text-[#1E1315]"
            }`}
          >
            EVM
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("near");
              setFaucetMsg(null);
            }}
            className={`py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === "near"
                ? "bg-[#1E1315] text-[#FAF7F0]"
                : "text-[#7A6A5E] hover:text-[#1E1315]"
            }`}
          >
            NEAR
          </button>
        </div>

        {/* QR Code */}
        <div className="p-3 bg-[#FAF7F0] rounded-xl border border-[#EBE3D5] flex items-center justify-center">
          <div className="p-2.5 bg-white rounded-lg border border-[#EBE3D5]">
            {activeTab === "near" ? (
              <QRCodeSVG value={accountId} size={130} level="H" includeMargin={true} />
            ) : derivedEvm.checksumAddress ? (
              <QRCodeSVG value={derivedEvm.checksumAddress} size={130} level="H" includeMargin={true} />
            ) : (
              <div className="w-[130px] h-[130px] flex flex-col items-center justify-center gap-1.5 text-[#7A6A5E]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[10px] font-mono">Deriving Address...</span>
              </div>
            )}
          </div>
        </div>

        {/* Address Display & Copy */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase font-mono tracking-wider text-[#7A6A5E]">
            {activeTab === "evm" ? "Universal EVM Address" : "NEAR Account ID"}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 font-mono text-xs text-[#1E1315] break-all px-2.5 py-1.5 bg-[#FAF7F0] border border-[#EBE3D5] rounded-lg select-all">
              {activeTab === "evm"
                ? (derivedEvm.checksumAddress || "Deriving...")
                : accountId}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              disabled={activeTab === "evm" && !derivedEvm.checksumAddress}
              className="h-8 px-2.5 rounded-lg border border-[#EBE3D5] bg-white hover:bg-[#FAF7F0] disabled:opacity-40 text-[#1E1315] text-xs font-medium flex items-center gap-1 transition cursor-pointer shrink-0"
              title="Copy"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Testnet Token Dispenser (NEAR only) */}
        {activeTab === "near" && (
          <div className="space-y-1.5 pt-1">
            <button
              type="button"
              onClick={handleClaimFaucet}
              disabled={isClaimingFaucet}
              className="w-full h-8 rounded-lg bg-[#1E1315] hover:bg-[#2C1D20] disabled:opacity-50 text-[#FAF7F0] text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {isClaimingFaucet ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispensing...</span>
                </>
              ) : (
                <span>Claim 0.25 Testnet NEAR</span>
              )}
            </button>
            {faucetMsg && (
              <div
                className={`text-[10px] font-mono text-center ${
                  faucetMsg.type === "success" ? "text-emerald-700 font-medium" : "text-rose-700"
                }`}
              >
                {faucetMsg.text}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
