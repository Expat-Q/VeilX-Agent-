// src/components/pay/TokenSelectorModal.tsx
// Relay.link / Uniswap style multi-chain token selector modal
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { X, Search, Check, Star } from "lucide-react";
import { AssetLogo, ChainLogo } from "@/components/common/AssetLogo";

export interface SupportedTokenItem {
  symbol: string;
  name: string;
  chainId: string;
  chainName: string;
  contractAddress?: string;
  decimals?: number;
  isPopular?: boolean;
}

export const SUPPORTED_CHAINS = [
  { id: "all", name: "All Chains" },
  { id: "near", name: "NEAR Protocol" },
  { id: "base", name: "Base" },
  { id: "arbitrum", name: "Arbitrum" },
  { id: "ethereum", name: "Ethereum" },
  { id: "solana", name: "Solana" },
  { id: "bitcoin", name: "Bitcoin" },
  { id: "polygon", name: "Polygon" },
  { id: "optimism", name: "Optimism" },
  { id: "bnb", name: "BNB Chain" },
];

export const TOKEN_CATALOG: SupportedTokenItem[] = [
  // Base
  {
    symbol: "ETH",
    name: "Ethereum",
    chainId: "base",
    chainName: "Base",
    contractAddress: "0x00...0000",
    isPopular: true,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    chainId: "base",
    chainName: "Base",
    contractAddress: "0x8335...2913",
    isPopular: true,
  },
  {
    symbol: "cbBTC",
    name: "Coinbase BTC",
    chainId: "base",
    chainName: "Base",
    contractAddress: "0xcbB7...33bf",
    isPopular: true,
  },

  // NEAR Protocol
  {
    symbol: "NEAR",
    name: "NEAR",
    chainId: "near",
    chainName: "NEAR Protocol",
    contractAddress: "Native 0 Gas",
    isPopular: true,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    chainId: "near",
    chainName: "NEAR Protocol",
    contractAddress: "172086...usdc.near",
    isPopular: true,
  },

  // Arbitrum
  {
    symbol: "ETH",
    name: "Ethereum",
    chainId: "arbitrum",
    chainName: "Arbitrum",
    contractAddress: "0x00...0000",
    isPopular: true,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    chainId: "arbitrum",
    chainName: "Arbitrum",
    contractAddress: "0xaf88...5831",
    isPopular: true,
  },
  {
    symbol: "ARB",
    name: "Arbitrum",
    chainId: "arbitrum",
    chainName: "Arbitrum",
    contractAddress: "0x912c...0000",
  },

  // Ethereum
  {
    symbol: "ETH",
    name: "Ethereum",
    chainId: "ethereum",
    chainName: "Ethereum",
    contractAddress: "0x00...0000",
    isPopular: true,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    chainId: "ethereum",
    chainName: "Ethereum",
    contractAddress: "0xA0b8...eB48",
    isPopular: true,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    chainId: "ethereum",
    chainName: "Ethereum",
    contractAddress: "0xdAC1...1ec7",
    isPopular: true,
  },

  // Solana
  {
    symbol: "SOL",
    name: "Solana",
    chainId: "solana",
    chainName: "Solana",
    contractAddress: "Native Fast",
    isPopular: true,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    chainId: "solana",
    chainName: "Solana",
    contractAddress: "EPjF...DT1v",
    isPopular: true,
  },

  // Bitcoin
  {
    symbol: "BTC",
    name: "Bitcoin",
    chainId: "bitcoin",
    chainName: "Bitcoin",
    contractAddress: "Native UTXO",
    isPopular: true,
  },

  // Polygon
  {
    symbol: "POL",
    name: "Polygon Ecosystem",
    chainId: "polygon",
    chainName: "Polygon",
    contractAddress: "0x00...0000",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    chainId: "polygon",
    chainName: "Polygon",
    contractAddress: "0x3c49...3359",
  },

  // Optimism
  {
    symbol: "ETH",
    name: "Ethereum",
    chainId: "optimism",
    chainName: "Optimism",
    contractAddress: "0x00...0000",
  },
  {
    symbol: "OP",
    name: "Optimism",
    chainId: "optimism",
    chainName: "Optimism",
    contractAddress: "0x4200...0042",
  },

  // BNB Chain
  {
    symbol: "BNB",
    name: "BNB",
    chainId: "bnb",
    chainName: "BNB Chain",
    contractAddress: "Native BSC",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    chainId: "bnb",
    chainName: "BNB Chain",
    contractAddress: "0x55d3...0000",
  },
];

interface TokenSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedChain: string;
  selectedAsset: string;
  onSelect: (token: SupportedTokenItem) => void;
}

export function TokenSelectorModal({
  isOpen,
  onClose,
  selectedChain,
  selectedAsset,
  onSelect,
}: TokenSelectorModalProps) {
  const [activeChainFilter, setActiveChainFilter] = useState<string>("all");
  const [chainSearch, setChainSearch] = useState<string>("");
  const [tokenSearch, setTokenSearch] = useState<string>("");

  // Sync initial chain filter when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveChainFilter(selectedChain || "all");
    }
  }, [isOpen, selectedChain]);

  // Filtered chains list
  const filteredChains = useMemo(() => {
    if (!chainSearch.trim()) return SUPPORTED_CHAINS;
    const q = chainSearch.toLowerCase().trim();
    return SUPPORTED_CHAINS.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [chainSearch]);

  // Filtered tokens list
  const filteredTokens = useMemo(() => {
    let list = TOKEN_CATALOG;

    if (activeChainFilter !== "all") {
      list = list.filter((t) => t.chainId === activeChainFilter);
    }

    if (tokenSearch.trim()) {
      const q = tokenSearch.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.chainName.toLowerCase().includes(q) ||
          (t.contractAddress && t.contractAddress.toLowerCase().includes(q))
      );
    }

    return list;
  }, [activeChainFilter, tokenSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-200">
      {/* Backdrop Click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-[620px] bg-white rounded-3xl border border-[#EBE3D5] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[580px] z-10 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EBE3D5]">
          <h3 className="text-base font-bold text-[#1E1315]">Select Token</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#FAF5EC] text-[#8C7A7C] hover:text-[#1E1315] flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2-Column Relay Body */}
        <div className="flex flex-1 min-h-0 divide-x divide-[#EBE3D5]">
          {/* Left Column: Chain Selector */}
          <div className="w-[180px] shrink-0 p-3 flex flex-col min-h-0 bg-[#FCFBF9]">
            {/* Chain Search Input */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-[#8C7A7C] absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search chains"
                value={chainSearch}
                onChange={(e) => setChainSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-2 bg-white rounded-xl text-[11px] font-medium border border-[#EBE3D5] text-[#1E1315] placeholder:text-[#8C7A7C] focus:outline-none focus:border-[#1E1315]"
              />
            </div>

            {/* Chains Scroll List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-1 text-xs">
              {/* Starred / Popular Header */}
              <div className="text-[10px] font-bold text-[#8C7A7C] uppercase tracking-wider px-2 pt-1 flex items-center gap-1">
                <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                <span>Chains</span>
              </div>

              {filteredChains.map((chain) => {
                const isActive = activeChainFilter === chain.id;
                return (
                  <button
                    key={chain.id}
                    type="button"
                    onClick={() => setActiveChainFilter(chain.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition cursor-pointer ${
                      isActive
                        ? "bg-[#1E1315] text-[#FDFBF7] font-bold shadow-xs"
                        : "text-[#1E1315] hover:bg-[#FAF5EC] font-medium"
                    }`}
                  >
                    {chain.id === "all" ? (
                      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0 p-0.5">
                        <div className="grid grid-cols-2 gap-0.5 w-full h-full p-0.5">
                          <span className="bg-white rounded-xs" />
                          <span className="bg-white rounded-xs" />
                          <span className="bg-white rounded-xs" />
                          <span className="bg-white rounded-xs" />
                        </div>
                      </div>
                    ) : (
                      <ChainLogo chain={chain.id} className="w-5 h-5" />
                    )}
                    <span className="text-[11px] truncate flex-1">{chain.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Token List */}
          <div className="flex-1 p-3.5 flex flex-col min-h-0 bg-white">
            {/* Token Search Input */}
            <div className="relative mb-2.5">
              <Search className="w-4 h-4 text-[#8C7A7C] absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search for a token or paste address"
                value={tokenSearch}
                onChange={(e) => setTokenSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-[#FAF7F0] rounded-xl text-xs font-medium border border-[#EBE3D5] text-[#1E1315] placeholder:text-[#8C7A7C] focus:outline-none focus:border-[#1E1315] focus:bg-white transition"
                autoFocus
              />
            </div>

            {/* List Header */}
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-[#8C7A7C] px-2 pb-1.5 border-b border-[#F4EFE6]">
              <span>
                {activeChainFilter === "all"
                  ? "Global 24H Volume"
                  : `${SUPPORTED_CHAINS.find((c) => c.id === activeChainFilter)?.name || ""} Tokens`}
              </span>
              <span>{filteredTokens.length} Tokens</span>
            </div>

            {/* Scrollable Tokens */}
            <div className="flex-1 overflow-y-auto pr-1 py-1 space-y-1">
              {filteredTokens.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#8C7A7C]">
                  No tokens found matching your search.
                </div>
              ) : (
                filteredTokens.map((token) => {
                  const isCurrent =
                    token.chainId === selectedChain && token.symbol === selectedAsset;
                  return (
                    <button
                      key={`${token.chainId}_${token.symbol}`}
                      type="button"
                      onClick={() => {
                        onSelect(token);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-2xl transition cursor-pointer text-left ${
                        isCurrent
                          ? "bg-[#FAF5EC] border border-[#EBE3D5]"
                          : "hover:bg-[#FAF7F0] border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Relay-style Composite Icon: Token Icon with small Chain Badge at bottom-right */}
                        <div className="relative shrink-0 w-9 h-9">
                          <AssetLogo symbol={token.symbol} className="w-9 h-9 rounded-full" />
                          <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5 shadow-xs border border-white">
                            <ChainLogo chain={token.chainId} className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        {/* Token Details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-[#1E1315] leading-none">
                              {token.symbol}
                            </span>
                            <span className="text-[10px] text-[#8C7A7C] font-medium truncate">
                              {token.name}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#8C7A7C] font-mono mt-0.5 truncate">
                            {token.chainName}{" "}
                            {token.contractAddress && (
                              <span className="text-[9px] text-[#A39294]">
                                {token.contractAddress}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Indicator */}
                      {isCurrent && (
                        <div className="w-6 h-6 rounded-full bg-[#1E1315] text-[#FDFBF7] flex items-center justify-center shrink-0 shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
