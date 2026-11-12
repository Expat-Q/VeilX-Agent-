"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  ArrowUpRight,
  Loader2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Check,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getStoredAgentSession, recordAgentSpend } from "@/lib/near-embedded-wallet";
import { addTransactionRecord } from "@/lib/transactions-store";
import { AssetLogo, TokenWithChainBadge } from "@/components/common/AssetLogo";
import { getClientRpcUrl, signAndBroadcastMpcEvmTransfer } from "@/lib/near-client-signer";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface WithdrawOption {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  chainType: "near" | "evm" | "solana";
  balance: number;
  balanceLabel: string;
}

export function WithdrawModal({ isOpen, onClose }: WithdrawModalProps) {
  const { user, nearBalance, evmBalance, refreshAccountData } = useAuth();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTx, setSuccessTx] = useState<{ txHash: string; explorerUrl: string; asset: string; amount: string; chain: string } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const nearNum = parseFloat(nearBalance) || 0;
  const usdcNum = evmBalance?.usdc ? parseFloat(evmBalance.usdc) : 0.0;
  const ethNum = evmBalance?.eth ? parseFloat(evmBalance.eth) : 0.0;

  const arbUsdcHolding = evmBalance?.holdings?.find((h: any) => h.network === "Arbitrum Sepolia" && h.symbol === "USDC");
  const arbEthHolding = evmBalance?.holdings?.find((h: any) => h.network === "Arbitrum Sepolia" && h.symbol === "ETH");
  const arbUsdcNum = arbUsdcHolding ? parseFloat(arbUsdcHolding.balance) : 0.0;
  const arbEthNum = arbEthHolding ? parseFloat(arbEthHolding.balance) : 0.0;

  // Real on-chain multi-chain withdrawal assets with live verified balances across Base and Arbitrum
  const withdrawOptions: WithdrawOption[] = [
    {
      id: "near_native",
      symbol: "NEAR",
      name: "NEAR Protocol",
      chain: "NEAR Testnet",
      chainType: "near",
      balance: Math.max(0, Number((nearNum - 0.005).toFixed(4))),
      balanceLabel: `${nearNum.toFixed(3)} NEAR`,
    },
    {
      id: "usdc_base",
      symbol: "USDC",
      name: "USD Coin",
      chain: "Base Sepolia (EVM MPC)",
      chainType: "evm",
      balance: usdcNum,
      balanceLabel: `${usdcNum.toFixed(2)} USDC`,
    },
    {
      id: "usdc_arb",
      symbol: "USDC",
      name: "USD Coin",
      chain: "Arbitrum Sepolia (EVM MPC)",
      chainType: "evm",
      balance: arbUsdcNum,
      balanceLabel: `${arbUsdcNum.toFixed(2)} USDC`,
    },
    {
      id: "eth_base",
      symbol: "ETH",
      name: "Ethereum Native",
      chain: "Base Sepolia (EVM MPC)",
      chainType: "evm",
      balance: Math.max(0, Number((ethNum - 0.0005).toFixed(4))),
      balanceLabel: `${ethNum.toFixed(4)} ETH`,
    },
    {
      id: "eth_arb",
      symbol: "ETH",
      name: "Arbitrum Ether",
      chain: "Arbitrum Sepolia (EVM MPC)",
      chainType: "evm",
      balance: Math.max(0, Number((arbEthNum - 0.0005).toFixed(4))),
      balanceLabel: `${arbEthNum.toFixed(4)} ETH`,
    },
  ];

  const [selectedOption, setSelectedOption] = useState<WithdrawOption>(withdrawOptions[0]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  if (!isOpen) return null;

  const handleSetMax = () => {
    setAmount(selectedOption.balance > 0 ? selectedOption.balance.toString() : "0");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessTx(null);

    const numAmount = parseFloat(amount);
    if (!recipient.trim()) {
      setError(`Please enter a destination address for ${selectedOption.chain}`);
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }
    if (numAmount > selectedOption.balance) {
      setError(`Amount exceeds available balance (${selectedOption.balanceLabel})`);
      return;
    }

    if (selectedOption.chainType === "evm" && !recipient.trim().startsWith("0x")) {
      setError("Please provide a valid 0x EVM address");
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedOption.id === "near_native") {
        const session = getStoredAgentSession(user?.xHandle);
        let clientTxHash: string | undefined = undefined;

        // Non-custodial client-side signing (private key never leaves browser)
        if (session?.secretKey && user?.nearAccountId) {
          try {
            const nearAPI = await import("near-api-js");
            const provider = new nearAPI.JsonRpcProvider({ url: getClientRpcUrl() });
            const keyPair = nearAPI.KeyPair.fromString(session.secretKey as any);
            const signer = new nearAPI.KeyPairSigner(keyPair);
            const account = new nearAPI.Account(user.nearAccountId, provider, signer);
            const yocto = nearAPI.nearToYocto(numAmount.toString() as any);
            const outcome: any = await account.transfer({
              receiverId: recipient.trim().toLowerCase(),
              amount: yocto,
            });
            clientTxHash = outcome?.transaction?.hash || outcome?.receipts_outcome?.[0]?.id;
          } catch (signErr: any) {
            console.warn("[WithdrawModal] In-browser signing fallback:", signErr.message);
          }
        }

        const res = await fetch("/api/near/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHash: clientTxHash,
            senderWallet: user?.nearAccountId,
            recipientAccount: recipient.trim(),
            amountNear: numAmount,
            userHandle: user?.xHandle,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "NEAR withdrawal failed");
        }

        setSuccessTx({
          txHash: data.txHash,
          explorerUrl: data.explorerUrl,
          asset: selectedOption.symbol,
          chain: selectedOption.chain,
          amount: numAmount.toString(),
        });
      } else if (selectedOption.chainType === "evm") {
        const session = getStoredAgentSession(user?.xHandle);
        let mpcTxHash = "";
        let explorerUrl = "";

        const chainName = selectedOption.chain.toLowerCase();
        const detectedChain = chainName.includes("arb") ? "arbitrum" : chainName.includes("eth") ? "ethereum" : "base";
        const chainId = detectedChain === "arbitrum" ? 421614 : detectedChain === "ethereum" ? 11155111 : 84532;

        if (session?.secretKey && user?.nearAccountId) {
          // Client-side signing: User's session key signs directly on NEAR MPC (v1.signer-prod.testnet)
          // Master relayer pays ZERO gas; user authorizes and sponsors gas from their personal subaccount
          const mpcResult = await signAndBroadcastMpcEvmTransfer({
            senderAccountId: user.nearAccountId,
            senderSecretKey: session.secretKey,
            recipientAddress: recipient.trim(),
            asset: selectedOption.symbol,
            amount: numAmount.toString(),
            chain: detectedChain,
            chainId,
          });
          mpcTxHash = mpcResult.txHash;
          explorerUrl = (mpcResult as any).explorerUrl || (detectedChain === "arbitrum" ? `https://sepolia.arbiscan.io/tx/${mpcTxHash}` : `https://sepolia.basescan.org/tx/${mpcTxHash}`);
        } else {
          // Fallback to server route if session key is not available
          const res = await fetch("/api/evm/send-mpc", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipientAddress: recipient.trim(),
              asset: selectedOption.symbol,
              amount: numAmount.toString(),
              amountEth: selectedOption.symbol === "ETH" ? numAmount.toString() : undefined,
              chain: detectedChain,
              chainId,
            }),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || "EVM MPC transfer failed");
          }
          mpcTxHash = data.txHash;
          explorerUrl = detectedChain === "arbitrum" ? `https://sepolia.arbiscan.io/tx/${mpcTxHash}` : `https://sepolia.basescan.org/tx/${mpcTxHash}`;
        }

        setSuccessTx({
          txHash: mpcTxHash,
          explorerUrl,
          asset: selectedOption.symbol,
          chain: selectedOption.chain,
          amount: numAmount.toString(),
        });
      } else {
        throw new Error(`Direct withdrawal on ${selectedOption.chain} is not supported on testnet yet.`);
      }

      const withdrawUsd = Number((selectedOption.symbol === "USDC" ? numAmount : selectedOption.symbol === "NEAR" ? numAmount * 4.25 : numAmount * 2650).toFixed(2));
      recordAgentSpend(withdrawUsd, user?.xHandle);

      addTransactionRecord(
        {
          type: "withdrawal",
          title: `Withdraw ${selectedOption.symbol} on ${selectedOption.chain}`,
          counterparty: recipient.trim(),
          amountUsd: withdrawUsd,
          asset: selectedOption.symbol,
          status: "completed",
          statusLabel: "Withdrawn",
          txHash: successTx?.txHash || "completed",
          isInflow: false,
          memo: `Withdrew ${numAmount} ${selectedOption.symbol} on ${selectedOption.chain}`,
        },
        user?.xHandle
      );

      await refreshAccountData();
    } catch (err: any) {
      setError(err.message || "Failed to submit withdrawal");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1315]/40 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white border border-[#EBE3D5] rounded-3xl p-6 shadow-xl space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F2EBDC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5] flex items-center justify-center text-[#1E1315]">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1E1315]">Withdraw Funds</h3>
              <p className="text-[11px] text-[#7A6A5E]">Transfer tokens across any supported chain</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#7A6A5E] hover:text-[#1E1315] hover:bg-[#FAF7F0] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {successTx ? (
          <div className="p-5 rounded-2xl bg-[#FAF7F0] border border-[#EBE3D5] text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-[#1E1315]">Withdrawal Broadcasted</h4>
            <p className="text-xs text-[#7A6A5E]">
              Sent {successTx.amount} {successTx.asset} on <strong className="text-[#1E1315]">{successTx.chain}</strong> to <strong className="font-mono text-[#1E1315] break-all">{recipient}</strong>.
            </p>
            <div className="pt-2">
              <a
                href={successTx.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E1315] underline underline-offset-2 hover:text-[#6B5A4E]"
              >
                <span>View on Block Explorer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Multi-Chain Asset Dropdown with Mini Chain Badge Overlay (Image 1 Style) */}
            <div className="relative" ref={dropdownRef}>
              <label className="text-xs font-semibold text-[#1E1315] block mb-1.5">
                Select Asset &amp; Chain
              </label>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full h-14 px-3.5 rounded-2xl border border-[#EBE3D5] bg-[#FAF7F0] hover:bg-[#EFE8D8] text-left flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <TokenWithChainBadge
                    symbol={selectedOption.symbol}
                    chain={selectedOption.chain}
                    className="w-8 h-8"
                  />
                  <div className="truncate">
                    <div className="font-bold text-xs text-[#1E1315] leading-tight">
                      {selectedOption.symbol}
                    </div>
                    <div className="text-[11px] text-[#7A6A5E] font-mono mt-0.5">
                      {selectedOption.balanceLabel} available
                    </div>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-[#7A6A5E] transition-transform duration-200 shrink-0 ${isDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#EBE3D5] rounded-2xl shadow-xl z-50 p-1.5 space-y-1 max-h-60 overflow-y-auto animate-in fade-in">
                  {withdrawOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedOption(opt);
                        setAmount("");
                        setError(null);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer ${
                        selectedOption.id === opt.id ? "bg-[#FAF7F0] font-semibold" : "hover:bg-[#FAF7F0]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <TokenWithChainBadge
                          symbol={opt.symbol}
                          chain={opt.chain}
                          className="w-7 h-7"
                        />
                        <div className="truncate">
                          <div className="text-xs font-bold text-[#1E1315] leading-tight">
                            {opt.symbol}
                          </div>
                          <div className="text-[10px] font-mono text-[#7A6A5E] mt-0.5">
                            {opt.balanceLabel}
                          </div>
                        </div>
                      </div>
                      {selectedOption.id === opt.id && <Check className="w-4 h-4 text-emerald-700 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Destination Address */}
            <div>
              <label className="text-xs font-semibold text-[#1E1315] block mb-1">
                Destination Address ({selectedOption.chain})
              </label>
              <input
                type="text"
                required
                placeholder={
                  selectedOption.chainType === "near"
                    ? "e.g. recipient.near or mywallet.testnet"
                    : selectedOption.chainType === "evm"
                    ? "e.g. 0x71C...3a9"
                    : "e.g. Solana Base58 address"
                }
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#EBE3D5] bg-white font-mono text-xs text-[#1E1315] placeholder:text-[#A8988B] focus:outline-none focus:border-[#1E1315]"
              />
            </div>

            {/* Amount */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#1E1315]">
                  Amount ({selectedOption.symbol})
                </label>
                <button
                  type="button"
                  onClick={handleSetMax}
                  className="text-[11px] font-mono text-[#1E1315] hover:underline font-semibold cursor-pointer"
                >
                  Max Available ({selectedOption.balanceLabel})
                </button>
              </div>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#EBE3D5] bg-white font-mono text-xs text-[#1E1315] placeholder:text-[#A8988B] focus:outline-none focus:border-[#1E1315]"
              />
            </div>

            {error && (
              <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !recipient || !amount}
              className="w-full h-10 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] disabled:opacity-50 text-[#FAF7F0] text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Signing &amp; Broadcasting...</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Confirm Withdrawal ({selectedOption.symbol})</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
