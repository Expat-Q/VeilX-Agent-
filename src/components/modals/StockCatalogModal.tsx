"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Search,
  Plus,
  Check,
  TrendingUp,
  Layers,
  Sparkles,
} from "lucide-react";
import { CURATED_STOCK_CATALOG } from "@/lib/ondo-stocks";
import { PortfolioPosition } from "@/lib/market-analyst";
import { AssetLogo } from "@/components/common/AssetLogo";

interface StockCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPositions: PortfolioPosition[];
  onAddStock: (stock: { symbol: string; name: string; price: number }) => Promise<void>;
}

// Fallback catalog stock pricing
const DEFAULT_PRICES: Record<string, number> = {
  NVDAon: 187.19,
  TSLAon: 348.63,
  AAPLon: 244.50,
  MSFTon: 421.20,
  AMZNon: 204.30,
  GOOGLon: 184.80,
  METAon: 588.20,
  HOODon: 34.60,
  INTCon: 24.15,
  NFLXon: 820.40,
  COINon: 298.50,
  "AMD-on": 142.30,
  SPYon: 742.34,
  QQQon: 512.40,
  "ARM-on": 148.90,
  AVGOon: 168.20,
  PLTRon: 61.40,
  XOMon: 118.50,
  GLDon: 242.10,
  SLVon: 28.70,
};

export function StockCatalogModal({
  isOpen,
  onClose,
  existingPositions,
  onAddStock,
}: StockCatalogModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
  const [liveCatalogPrices, setLiveCatalogPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isOpen) return;
    const tickers = CURATED_STOCK_CATALOG.map((s) => s.symbol).join(",");
    fetch(`/api/prices?symbols=${encodeURIComponent(tickers)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.prices) {
          const map: Record<string, number> = {};
          for (const [sym, quote] of Object.entries(d.prices)) {
            const q = quote as any;
            if (q && typeof q.priceUsd === "number") {
              map[sym] = q.priceUsd;
              map[sym.toUpperCase()] = q.priceUsd;
            }
          }
          setLiveCatalogPrices((prev) => ({ ...prev, ...map }));
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const existingSymbols = useMemo(
    () => new Set(existingPositions.map((p) => p.symbol)),
    [existingPositions]
  );

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return CURATED_STOCK_CATALOG.filter((stock) => {
      const cleanName = stock.name.replace(/\s*\(Ondo\)/gi, "");
      return (
        stock.symbol.toLowerCase().includes(q) ||
        cleanName.toLowerCase().includes(q)
      );
    });
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleAdd = async (stock: typeof CURATED_STOCK_CATALOG[0]) => {
    setAddingSymbol(stock.symbol);
    const cleanName = stock.name.replace(/\s*\(Ondo\)/gi, "").trim();
    const price = liveCatalogPrices[stock.symbol] || liveCatalogPrices[stock.symbol.toUpperCase()] || DEFAULT_PRICES[stock.symbol] || 150.0;
    try {
      await onAddStock({
        symbol: stock.symbol,
        name: cleanName,
        price,
      });
    } finally {
      setAddingSymbol(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E1315]/40 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-white border border-[#EBE3D5] rounded-3xl p-6 shadow-xl space-y-5 relative max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F2EBDC] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5] flex items-center justify-center text-[#1E1315]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1E1315]">Explore &amp; Expand Stocks</h3>
              <p className="text-[11px] text-[#7A6A5E]">
                Add any of 28+ tokenized US equities &amp; ETFs to your portfolio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#7A6A5E] hover:text-[#1E1315] hover:bg-[#FAF7F0] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search bar */}
        <div className="relative shrink-0">
          <Search className="w-4 h-4 text-[#7A6A5E] absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search stock by ticker or company name (e.g. AMZN, Apple, QQQ)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-2xl border border-[#EBE3D5] bg-[#FAF7F0] text-xs text-[#1E1315] placeholder:text-[#A8988B] focus:outline-none focus:border-[#1E1315]"
          />
        </div>

        {/* Stock List Scrollable Area */}
        <div className="overflow-y-auto flex-1 divide-y divide-[#F2EBDC] pr-1">
          {filteredCatalog.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#7A6A5E]">
              No matching tokenized stocks found for &quot;{searchQuery}&quot;.
            </div>
          ) : (
            filteredCatalog.map((stock) => {
              const cleanName = stock.name.replace(/\s*\(Ondo\)/gi, "").trim();
              const isHeld = existingSymbols.has(stock.symbol);
              const price = liveCatalogPrices[stock.symbol] || liveCatalogPrices[stock.symbol.toUpperCase()] || DEFAULT_PRICES[stock.symbol] || 150.0;
              const isAdding = addingSymbol === stock.symbol;

              return (
                <div
                  key={stock.symbol}
                  className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-[#FAF7F0]/60 transition-colors rounded-xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <AssetLogo symbol={stock.symbol} className="w-9 h-9 rounded-xl shrink-0" />
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#1E1315] font-mono">
                          {stock.symbol}
                        </span>
                        <span className="text-[10px] text-[#8C7A6B] capitalize font-medium">
                          • {stock.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#7A6A5E] truncate">
                        {cleanName}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 font-mono text-xs">
                    <div className="text-right">
                      <div className="font-bold text-[#1E1315]">${price.toFixed(2)}</div>
                      <div className="text-[10px] text-[#7A6A5E]">Live Quote</div>
                    </div>

                    {isHeld ? (
                      <span className="px-3 py-1.5 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5] text-[#7A6A5E] text-xs font-semibold inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Tracked</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAdd(stock)}
                        disabled={isAdding}
                        className="px-3 py-1.5 rounded-xl bg-[#1E1315] hover:bg-[#2C1D20] disabled:opacity-50 text-[#FAF7F0] text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAdding ? "Tracking..." : "Track Stock"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
