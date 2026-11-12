// src/components/common/AssetLogo.tsx
// Institutional-Grade Real Token & Blockchain Logos for VeilX
// Features Official CoinMarketCap CDN Assets, Authentic Foundation Vector Marks, and Failover

"use client";

import React, { useState } from "react";

// Official CoinMarketCap CDN ID Mapping
const CMC_TOKEN_IDS: Record<string, number> = {
  BTC: 1,
  BITCOIN: 1,
  ETH: 1027,
  ETHEREUM: 1027,
  SOL: 5426,
  SOLANA: 5426,
  NEAR: 6535,
  USDC: 3408,
  USDT: 825,
  DOGE: 74,
  DOGECOIN: 74,
  ZEC: 1437,
  ZCASH: 1437,
  XRP: 52,
  ADA: 2010,
  SUI: 20947,
  APT: 21794,
  LTC: 2,
  TRX: 1958,
  AVAX: 5805,
  LINK: 1975,
  ARB: 11841,
  OP: 11840,
  BNB: 1839,
  POL: 28324,
  MATIC: 3890,
  BERA: 35058,
  SHIB: 5994,
  PEPE: 24478,
};

// Official TrustWallet Assets Open-Source CDN Mapping
const TRUSTWALLET_CDN_MAP: Record<string, string> = {
  base: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
  arbitrum: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
  arb: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
  ethereum: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  eth: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  sepolia: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  near: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/near/info/logo.png",
  solana: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
  sol: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
  bitcoin: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png",
  btc: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png",
  polygon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
  pol: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
  amoy: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
  optimism: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
  op: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
  binance: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png",
  bnb: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png",
  bsc: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png",
  avalanche: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png",
  avax: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png",
};

const TRUSTWALLET_TOKEN_MAP: Record<string, string> = {
  USDC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
  USDT: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
  ETH: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  NEAR: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/near/info/logo.png",
  SOL: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
  BTC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png",
  CBBTC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf/logo.png",
  ARB: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/assets/0x912CE59144191C1204E64559FE8253a0e49E6548/logo.png",
  OP: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/assets/0x4200000000000000000000000000000000000042/logo.png",
  POL: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
  BNB: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png",
  AERO: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x940181a94A35A4569E4529A3CDfB74e48FD98762/logo.png",
};

/**
 * Official Blockchain Vector Logos (Authentic Foundation Brand Kits & TrustWallet Assets CDN)
 */
export function ChainLogo({
  chain,
  className = "w-3.5 h-3.5",
}: {
  chain: string;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const c = chain.toLowerCase();

  let cdnUrl: string | undefined;
  for (const [key, url] of Object.entries(TRUSTWALLET_CDN_MAP)) {
    if (c === key || c.includes(key)) {
      cdnUrl = url;
      break;
    }
  }

  if (cdnUrl && !imgError) {
    return (
      <div className={`${className} rounded-full overflow-hidden bg-white flex items-center justify-center shrink-0 border border-white shadow-xs`}>
        <img
          src={cdnUrl}
          alt={chain}
          className="w-full h-full object-contain"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // 1. NEAR Protocol Official N Ribbon
  if (c.includes("near")) {
    return (
      <div className={`${className} rounded-full bg-black flex items-center justify-center p-0.5 shadow-xs border border-white shrink-0`}>
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
          <path
            fill="#00EC97"
            d="M7 4.5h2.2l7.1 10.5V4.5h2.2v15h-2.2L9.2 9v10.5H7V4.5z"
          />
        </svg>
      </div>
    );
  }

  // 2. Base (Coinbase) Official Blue Disc with Crisp White C-disc
  if (c.includes("base")) {
    return (
      <div className={`${className} rounded-full bg-[#0052FF] flex items-center justify-center p-0.5 shadow-xs border border-white shrink-0`}>
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
          <circle cx="12" cy="12" r="11" fill="#0052FF" />
          <path
            fill="#FFFFFF"
            d="M12 4C7.58 4 4 7.58 4 12s3.58 8 8 8c4.08 0 7.45-3.05 7.94-7H13v-2h6.94C19.45 7.05 16.08 4 12 4z"
          />
        </svg>
      </div>
    );
  }

  // 3. Arbitrum One Official Diamond Hex Shield
  if (c.includes("arb") || c.includes("arbitrum")) {
    return (
      <div className={`${className} rounded-full bg-[#28A0F0] flex items-center justify-center p-0.5 shadow-xs border border-white shrink-0`}>
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
          <path
            fill="#FFFFFF"
            d="M12 2.5L3.5 17.5h4.2l2.3-4.1 4.5 8.1 2.3-4.1L12 2.5zm-1.8 11.4L12 10.7l1.8 3.2h-3.6z"
          />
        </svg>
      </div>
    );
  }

  // 4. Solana Official Tri-Gradient Wave
  if (c.includes("sol") || c.includes("solana")) {
    return (
      <div className={`${className} rounded-full bg-black flex items-center justify-center p-0.5 shadow-xs border border-white shrink-0`}>
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
          <path d="M4 6.5h13.5l2.5 2.5H6.5L4 6.5z" fill="url(#sol_g1)" />
          <path d="M20 11.5H6.5L4 14h13.5l2.5-2.5z" fill="url(#sol_g2)" />
          <path d="M4 16.5h13.5l2.5 2.5H6.5L4 16.5z" fill="url(#sol_g3)" />
          <defs>
            <linearGradient id="sol_g1" x1="4" y1="6.5" x2="20" y2="9" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00FFA3" />
              <stop offset="1" stopColor="#DC1FFF" />
            </linearGradient>
            <linearGradient id="sol_g2" x1="4" y1="11.5" x2="20" y2="14" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00FFA3" />
              <stop offset="1" stopColor="#DC1FFF" />
            </linearGradient>
            <linearGradient id="sol_g3" x1="4" y1="16.5" x2="20" y2="19" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00FFA3" />
              <stop offset="1" stopColor="#DC1FFF" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 5. Bitcoin Official Orange Disk
  if (c.includes("btc") || c.includes("bitcoin")) {
    return (
      <div className={`${className} rounded-full bg-[#F7931A] flex items-center justify-center p-0.5 shadow-xs border border-white shrink-0`}>
        <svg viewBox="0 0 64 64" className="w-full h-full" fill="none">
          <circle cx="32" cy="32" r="32" fill="#F7931A" />
          <path
            fill="#FFFFFF"
            d="M44.2 27.2c.6-4.1-2.5-6.3-6.8-7.8l1.4-5.6-3.4-.8-1.4 5.4c-.9-.2-1.8-.4-2.7-.7l1.4-5.5-3.4-.9-1.4 5.6c-.7-.2-1.5-.3-2.2-.5l-4.7-1.2-.9 3.7s2.5.6 2.5.6c1.4.3 1.6 1.3 1.6 2l-1.6 6.5c.1 0 .2.1.4.1l-.4-.1-2.3 9.1c-.2.5-.6 1.2-1.6 1 0 0-2.5-.6-2.5-.6l-1.7 4 4.4 1.1c.8.2 1.6.4 2.4.6l-1.4 5.8 3.4.9 1.4-5.6c.9.3 1.8.5 2.7.7l-1.4 5.6 3.4.9 1.4-5.7c5.9 1.1 10.3.7 12.2-4.6 1.5-4.3-.1-6.8-3.1-8.4 2.2-1.3 3.9-3.2 4.3-6.5zm-7.7 13.9c-1.1 4.4-8.4 2-10.8 1.4l1.9-7.7c2.4.6 9.9 1.8 8.9 6.3zm1.1-13.8c-1 4-7.1 2-9.1 1.5l1.7-7c2 .5 8.4 1.5 7.4 5.5z"
          />
        </svg>
      </div>
    );
  }

  // 6. Polygon / POL Official Purple
  if (c.includes("poly") || c.includes("polygon") || c.includes("pol") || c.includes("amoy")) {
    return (
      <div className={`${className} rounded-full bg-[#7B3FE4] flex items-center justify-center p-0.5 shadow-xs border border-white shrink-0`}>
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
          <path
            fill="#FFFFFF"
            d="M16.5 13.5L12 16.1l-4.5-2.6v-5.2l4.5-2.6 4.5 2.6v5.2zm-4.5-8.5L5.3 8.9v7.2L12 20l6.7-3.9V8.9L12 5z"
          />
        </svg>
      </div>
    );
  }

  // 7. Optimism Official Red Disc with OP
  if (c.includes("op") || c.includes("optimism")) {
    return (
      <div className={`${className} rounded-full bg-[#FF0420] flex items-center justify-center p-0.5 shadow-xs border border-white shrink-0`}>
        <span className="text-[7px] font-black text-white font-mono leading-none tracking-tighter">
          OP
        </span>
      </div>
    );
  }

  // 8. Avalanche Official Red Disc with White Chevron
  if (c.includes("avax") || c.includes("avalanche") || c.includes("fuji")) {
    return (
      <div className={`${className} rounded-full bg-[#E84142] flex items-center justify-center p-0.5 shadow-xs border border-white shrink-0`}>
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
          <path
            fill="#FFFFFF"
            d="M12 3l9 16h-4.2l-4.8-8.6L7.2 19H3l9-16zm.1 11.8l2.2 4.2h-4.4l2.2-4.2z"
          />
        </svg>
      </div>
    );
  }

  // 9. BNB / Binance Chain Official Yellow Disc with Diamond
  if (c.includes("bnb") || c.includes("bsc") || c.includes("binance")) {
    return (
      <div className={`${className} rounded-full bg-[#F3BA2F] flex items-center justify-center p-0.5 shadow-xs border border-white shrink-0`}>
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
          <path
            fill="#1E1315"
            d="M12 3.5l3.2 3.2-3.2 3.2-3.2-3.2L12 3.5zm-5.7 5.7l3.2 3.2-3.2 3.2-3.2-3.2 3.2-3.2zm11.4 0l3.2 3.2-3.2 3.2-3.2-3.2 3.2-3.2zM12 14.5l3.2 3.2-3.2 3.2-3.2-3.2 3.2-3.2z"
          />
        </svg>
      </div>
    );
  }

  // 10. Ethereum Official Diamond
  return (
    <div className={`${className} rounded-full bg-[#627EEA] flex items-center justify-center p-0.5 shadow-xs border border-white shrink-0`}>
      <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
        <path fill="#FFFFFF" d="M12 2L5 13.5 12 18l7-4.5L12 2z" />
        <path fill="#DFE3F7" d="M12 18V2L5 13.5 12 18z" />
      </svg>
    </div>
  );
}

/**
 * Institutional Asset Logo Component
 * Loads official CoinMarketCap CDN images for crypto & authentic corporate vectors for equities
 */
export function AssetLogo({
  symbol,
  className = "w-9 h-9",
}: {
  symbol: string;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const cleanSym = symbol.replace(/-on$/i, "on").replace(/ON$/i, "on").trim();
  const upper = cleanSym.toUpperCase();

  // 1. Check TrustWallet Official CDN First
  const twUrl = TRUSTWALLET_TOKEN_MAP[upper];
  if (twUrl && !imgError) {
    return (
      <div className={`${className} rounded-xl bg-white flex items-center justify-center p-1 shrink-0 border border-[#EBE3D5] shadow-2xs overflow-hidden`}>
        <img
          src={twUrl}
          alt={symbol}
          className="w-full h-full object-contain"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // 2. Check CoinMarketCap Official CDN for Crypto
  const cmcId = CMC_TOKEN_IDS[upper];
  if (cmcId && !imgError) {
    return (
      <div className={`${className} rounded-xl bg-white flex items-center justify-center p-1 shrink-0 border border-[#EBE3D5] shadow-2xs overflow-hidden`}>
        <img
          src={`https://s2.coinmarketcap.com/static/img/coins/64x64/${cmcId}.png`}
          alt={symbol}
          className="w-full h-full object-contain"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // 2. Tokenized US Equities & Core Cryptos (Pure Native Vectors with Zero Network Dependency)
  switch (upper) {
    case "USDC":
    case "USD":
      return (
        <div className={`${className} rounded-xl bg-[#2775CA] flex items-center justify-center p-1.5 shrink-0 shadow-2xs`}>
          <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
            <circle cx="12" cy="12" r="9.5" fill="#2775CA" stroke="#FFFFFF" strokeWidth="1" />
            <path
              d="M12 4.5v15M14.5 8.2c-.6-.4-1.5-.7-2.5-.7-2.2 0-3.5 1.2-3.5 2.8 0 1.8 1.4 2.5 3.5 3 2.1.5 3.5 1.2 3.5 3 0 1.9-1.5 3.2-3.5 3.2-1.3 0-2.4-.4-3.1-.9"
              stroke="#FFFFFF"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
      );

    case "NEAR":
      return (
        <div className={`${className} rounded-xl bg-[#000000] flex items-center justify-center p-1.5 shrink-0 shadow-2xs border border-[#333]`}>
          <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
            <path
              fill="#FFFFFF"
              d="M7.4 4.5h2.8l6.4 9.7V4.5h2.6v15h-2.8l-6.4-9.7v9.7H7.4v-15z"
            />
          </svg>
        </div>
      );

    case "ETH":
    case "ETHEREUM":
      return (
        <div className={`${className} rounded-xl bg-[#627EEA] flex items-center justify-center p-1.5 shrink-0 shadow-2xs`}>
          <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
            <path fill="#FFFFFF" d="M12 2L5 13.5 12 18l7-4.5L12 2z" />
            <path fill="#DFE3F7" d="M12 18V2L5 13.5 12 18z" />
          </svg>
        </div>
      );

    case "BTC":
    case "BITCOIN":
      return (
        <div className={`${className} rounded-xl bg-[#F7931A] flex items-center justify-center p-1.5 shrink-0 shadow-2xs`}>
          <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
            <path
              fill="#FFFFFF"
              d="M16.5 10.3c.3-1.8-.7-2.8-2.3-3.2l.5-1.9-1.2-.3-.5 1.9c-.3-.1-.6-.2-.9-.2l.5-1.9-1.2-.3-.5 1.9c-.3-.1-.5-.1-.8-.2l-1.6-.4-.3 1.3s.9.2.9.2c.5.1.6.4.6.6l-.6 2.5c0 0 .1 0 .2.1-.1 0-.1 0-.2-.1l-.9 3.5c-.1.2-.2.4-.6.3 0 0-.9-.2-.9-.2l-.6 1.4 1.5.4c.3.1.6.1.9.2l-.5 2 1.2.3.5-1.9c.3.1.6.2.9.2l-.5 1.9 1.2.3.5-1.9c2 .4 3.5.2 4.1-1.6.5-1.4 0-2.2-1-2.7.7-.4 1.2-1 1.4-2.1zm-2.5 4.3c-.4 1.5-2.2.7-2.8.5l.5-2c.6.2 2.6.5 2.3 1.5zm.4-4.3c-.3 1.3-1.8.6-2.3.5l.5-1.8c.5.1 2.2.4 1.8 1.3z"
            />
          </svg>
        </div>
      );

    case "SOL":
    case "SOLANA":
      return (
        <div className={`${className} rounded-xl bg-black flex items-center justify-center p-1.5 shrink-0 shadow-2xs border border-[#333]`}>
          <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
            <path
              fill="#14F195"
              d="M4 18.5l2.4-2.4c.4-.4.9-.6 1.5-.6h12.3c.7 0 1.1.8.7 1.3l-2.4 2.4c-.4.4-.9.6-1.5.6H4.7c-.7 0-1.1-.7-.7-1.3z"
            />
            <path
              fill="#9945FF"
              d="M4 5.5l2.4-2.4c.4-.4.9-.6 1.5-.6h12.3c.7 0 1.1.8.7 1.3L18.5 6.2c-.4.4-.9.6-1.5.6H4.7c-.7 0-1.1-.8-.7-1.3z"
            />
            <path
              fill="#00D2FF"
              d="M20 12l-2.4 2.4c-.4.4-.9.6-1.5.6H3.8c-.7 0-1.1-.8-.7-1.3l2.4-2.4c.4-.4.9-.6 1.5-.6h12.3c.7 0 1.1.7.7 1.3z"
            />
          </svg>
        </div>
      );
    case "NVDAON":
    case "NVDA":
      return (
        <div className={`${className} rounded-xl bg-black flex items-center justify-center p-1.5 shrink-0 border border-[#EBE3D5] shadow-2xs`}>
          <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
            <path
              fill="#76B900"
              d="M3.2 8.5C3.8 6.2 5.5 4.3 7.8 3.5c4.7-1.6 9.8-.4 13.3 3.1 1.2 1.2 2 2.6 2.4 4.1-.3-.6-.7-1.2-1.2-1.7-2.8-2.8-7-3.8-10.8-2.5-3.3 1.1-5.7 3.8-6.3 7.2-.6 3.4.7 6.8 3.3 9 2.6 2.2 6.3 2.8 9.5 1.7.9-.3 1.7-.8 2.4-1.4-.4.8-1 1.5-1.7 2.1-3.6 2.8-8.8 2.7-12.4-.4C3.8 22.4 2.5 17.5 3 12.8c.1-1.5.7-2.9 1.5-4.3z"
            />
          </svg>
        </div>
      );

    case "TSLAON":
    case "TSLA":
      return (
        <div className={`${className} rounded-xl bg-[#E82127] flex items-center justify-center p-1.5 shrink-0 shadow-2xs`}>
          <svg viewBox="0 0 342 342" className="w-full h-full" fill="none">
            <path
              fill="#FFFFFF"
              d="M171 78.4c48 0 88.5 18.5 119.5 46.5l25.8-38.3C278.3 49 227.6 28 171 28S63.7 49 25.7 86.6l25.8 38.3c31-28 71.5-46.5 119.5-46.5zm-8.8 63.8v166.4h17.6V142.2c35.6-3.8 64.6-21.7 78.2-46.7-23.7-11.4-55.7-18.7-95.8-18.7s-72.1 7.3-95.8 18.7c13.6 25 42.6 42.9 78.2 46.7z"
            />
          </svg>
        </div>
      );

    case "AAPLON":
    case "AAPL":
      return (
        <div className={`${className} rounded-xl bg-black flex items-center justify-center p-2 shrink-0 border border-[#EBE3D5] shadow-2xs`}>
          <svg viewBox="0 0 170 170" className="w-full h-full" fill="none">
            <path
              fill="#FFFFFF"
              d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.74 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.68-7.84-11.97-14.39-7.61-11.75-13.3-24.89-17.07-39.42-3.77-14.54-5.66-28.02-5.66-40.45 0-14.79 3.77-27.25 11.31-37.38 7.54-10.13 17.1-15.35 28.69-15.66 4.9.13 10.38 1.41 16.43 3.86 6.06 2.45 10.23 3.73 12.52 3.86 2.07 0 6.38-1.35 12.93-4.04 6.54-2.7 12.37-3.95 17.48-3.76 13.06.66 23.37 5.37 30.93 14.15-11.43 6.96-17.02 16.48-16.76 28.56.26 10.13 4.13 18.57 11.61 25.32 7.48 6.75 16.32 10.42 26.52 11.01-2.45 7.61-5.46 15.31-9.03 23.1zM119.22 33.72c0-7.84 2.82-15.22 8.46-22.14 5.64-6.92 12.63-11.16 20.97-12.72.66 1.96 1 3.92 1.03 5.88-.13 7.84-2.95 15.28-8.46 22.32-5.51 7.04-12.54 11.31-21.1 12.82-.4-2.07-.77-4.12-.9-6.16z"
            />
          </svg>
        </div>
      );

    case "MSFTON":
    case "MSFT":
      return (
        <div className={`${className} rounded-xl bg-white flex items-center justify-center p-2 shrink-0 border border-[#EBE3D5] shadow-2xs`}>
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <path fill="#f25022" d="M1 1h10v10H1z" />
            <path fill="#7fba00" d="M13 1h10v10H13z" />
            <path fill="#00a4ef" d="M1 13h10v10H1z" />
            <path fill="#ffb900" d="M13 13h10v10H13z" />
          </svg>
        </div>
      );

    case "AMZNON":
    case "AMZN":
      return (
        <div className={`${className} rounded-xl bg-[#131921] flex items-center justify-center p-1.5 shrink-0 border border-[#EBE3D5] shadow-2xs`}>
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <path
              fill="#FF9900"
              d="M13.9 16.2c-2.3 1.7-5.7 2.6-8.6 2.6-4.1 0-7.8-1.5-10.6-4-.2-.2-.2-.5 0-.7.3-.2.6-.2.8 0 2.6 2.2 6 3.6 9.8 3.6 2.6 0 5.6-.8 7.8-2.3.4-.3.9.1.8.8zm1.8-1.5c-.3-.4-1.9-.2-2.6-.1-.2 0-.3-.2-.2-.3 1.1-.9 2.9-.6 3.2-.2.3.4-.1 2.2-1.2 3.1-.2.1-.3.1-.4 0-.1-.2.7-1.9 1.2-2.5z"
            />
          </svg>
        </div>
      );

    case "GOOGLON":
    case "GOOGL":
      return (
        <div className={`${className} rounded-xl bg-white flex items-center justify-center p-2 shrink-0 border border-[#EBE3D5] shadow-2xs`}>
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.78-2.1-6.73-4.94H1.26v3.13C3.25 21.31 7.34 24 12 24z" />
            <path fill="#FBBC05" d="M5.27 14.26c-.25-.72-.38-1.49-.38-2.26s.13-1.54.38-2.26V6.61H1.26C.46 8.21 0 10.04 0 12s.46 3.79 1.26 5.39l4.01-3.13z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.25 2.69 1.26 6.61l4.01 3.13c.95-2.84 3.61-4.99 6.73-4.99z" />
          </svg>
        </div>
      );

    case "METAON":
    case "META":
      return (
        <div className={`${className} rounded-xl bg-[#0081FB] flex items-center justify-center p-2 shrink-0 shadow-2xs`}>
          <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
            <path
              fill="#FFFFFF"
              d="M16.5 6c-2.3 0-3.9 1.5-4.5 2.6-.6-1.1-2.2-2.6-4.5-2.6C4.2 6 2 8.4 2 12s2.2 6 5.5 6c2.5 0 4.2-1.7 4.5-2.2.3.5 2 2.2 4.5 2.2 3.3 0 5.5-2.4 5.5-6s-2.2-6-5.5-6zm0 9.8c-2.1 0-3.7-2-4.5-3.8.8-1.8 2.4-3.8 4.5-3.8 2 0 3.3 1.5 3.3 3.8s-1.3 3.8-3.3 3.8zm-9 0c-2 0-3.3-1.5-3.3-3.8s1.3-3.8 3.3-3.8c2.1 0 3.7 2 4.5 3.8-.8 1.8-2.4 3.8-4.5 3.8z"
            />
          </svg>
        </div>
      );

    case "SPYON":
    case "SPY":
      return (
        <div className={`${className} rounded-xl bg-[#1A1A2E] flex flex-col items-center justify-center p-1 shrink-0 text-white font-sans border border-[#2D2D4A] shadow-2xs`}>
          <span className="text-[9px] font-black tracking-tight leading-none text-[#00E5FF]">S&amp;P</span>
          <span className="text-[7px] font-bold tracking-widest leading-none text-white/70 mt-0.5">500</span>
        </div>
      );

    case "QQQON":
    case "QQQ":
      return (
        <div className={`${className} rounded-xl bg-[#002B49] flex flex-col items-center justify-center p-1 shrink-0 text-white font-sans border border-[#004B7A] shadow-2xs`}>
          <span className="text-[9px] font-black tracking-tight leading-none text-[#FFB800]">QQQ</span>
          <span className="text-[7px] font-bold tracking-widest leading-none text-white/70 mt-0.5">INVESCO</span>
        </div>
      );

    case "GLDON":
    case "GLD":
      return (
        <div className={`${className} rounded-xl bg-[#D4AF37] flex flex-col items-center justify-center p-1 shrink-0 text-[#1E1315] font-sans border border-[#B8960C] shadow-2xs`}>
          <span className="text-[9px] font-black tracking-tight leading-none">GOLD</span>
          <span className="text-[7px] font-bold tracking-widest leading-none text-black/60 mt-0.5">SPDR</span>
        </div>
      );

    case "SLVON":
    case "SLV":
      return (
        <div className={`${className} rounded-xl bg-[#C0C0C0] flex flex-col items-center justify-center p-1 shrink-0 text-[#1E1315] font-sans border border-[#A0A0A0] shadow-2xs`}>
          <span className="text-[9px] font-black tracking-tight leading-none">SLV</span>
          <span className="text-[7px] font-bold tracking-widest leading-none text-black/60 mt-0.5">SILVER</span>
        </div>
      );

    case "TLTON":
    case "TLT":
      return (
        <div className={`${className} rounded-xl bg-[#0D2B45] flex flex-col items-center justify-center p-1 shrink-0 text-white font-sans border border-[#1D4B75] shadow-2xs`}>
          <span className="text-[9px] font-black tracking-tight leading-none text-[#20BF6B]">20Y+</span>
          <span className="text-[7px] font-bold tracking-widest leading-none text-white/70 mt-0.5">TREAS</span>
        </div>
      );

    case "MAG7XON":
    case "MAG7X":
      return (
        <div className={`${className} rounded-xl bg-gradient-to-br from-indigo-900 to-purple-800 flex flex-col items-center justify-center p-1 shrink-0 text-white font-sans border border-purple-500/40 shadow-2xs`}>
          <span className="text-[9px] font-black tracking-tight leading-none text-purple-200">MAG7</span>
          <span className="text-[7px] font-bold tracking-widest leading-none text-white/70 mt-0.5">INDEX</span>
        </div>
      );

    default:
      return (
        <div className={`${className} rounded-xl bg-[#FAF3E0] border border-[#E8DCC4] flex items-center justify-center font-bold text-xs text-[#1E1315] font-mono shrink-0 shadow-2xs`}>
          {symbol.slice(0, 3)}
        </div>
      );
  }
}

/**
 * Institutional Token Icon with Miniature Chain Badge Overlay
 * Exactly matches production omnichain standards:
 * [Token Icon] + (Mini Chain Badge at top-left corner)
 */
export function TokenWithChainBadge({
  symbol,
  chain,
  className = "w-10 h-10",
}: {
  symbol: string;
  chain?: string;
  className?: string;
}) {
  const symUpper = symbol.toUpperCase().replace(/ON$/, "");
  const chainUpper = (chain || "").toUpperCase();

  // Suppress badge if chain is identical to asset (e.g. NEAR on NEAR, ETH on ETH)
  const isRedundant =
    !chain ||
    (symUpper === "NEAR" && chainUpper.includes("NEAR")) ||
    (symUpper === "ETH" && chainUpper === "ETH") ||
    (symUpper === "BTC" && chainUpper.includes("BTC")) ||
    (symUpper === "SOL" && chainUpper.includes("SOL"));

  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      {/* Primary Token/Stock Brand Logo */}
      <AssetLogo symbol={symbol} className="w-full h-full" />

      {/* Miniature Chain Badge Overlay (Only when asset is on an external/bridged chain) */}
      {!isRedundant && chain && (
        <div className="absolute -top-1 -left-1 ring-2 ring-white rounded-full">
          <ChainLogo chain={chain} className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}
