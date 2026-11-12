import React from "react";

interface IconProps {
  className?: string;
  size?: number;
}

/**
 * Ethereum (ETH) Logo
 */
export function EthIcon({ className = "w-6 h-6", size }: IconProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path
        d="M16.498 4v8.87l7.497 3.35L16.498 4z"
        fill="#fff"
        fillOpacity="0.6"
      />
      <path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#fff" />
      <path
        d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z"
        fill="#fff"
        fillOpacity="0.6"
      />
      <path d="M16.498 27.995v-6.028L9 17.616l7.498 10.38z" fill="#fff" />
      <path
        d="M16.498 20.573l7.497-4.353-7.497-3.348v7.7z"
        fill="#fff"
        fillOpacity="0.2"
      />
      <path
        d="M9 16.22l7.498 4.353v-7.7L9 16.22z"
        fill="#fff"
        fillOpacity="0.6"
      />
    </svg>
  );
}

/**
 * NEAR Protocol Logo
 */
export function NearIcon({ className = "w-6 h-6", size }: IconProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <circle cx="16" cy="16" r="16" fill="#000000" />
      <path
        d="M10.2 22.8V9.2h3.4l6.4 9.4V9.2h3.8v13.6h-3.4l-6.4-9.4v9.4H10.2z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/**
 * Base (Coinbase L2) Logo
 */
export function BaseIcon({ className = "w-6 h-6", size }: IconProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <circle cx="16" cy="16" r="16" fill="#0052FF" />
      <path
        d="M16 6a10 10 0 100 20A10 10 0 0016 6zm-1.8 14.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/**
 * Arbitrum (ARB) Logo
 */
export function ArbitrumIcon({ className = "w-6 h-6", size }: IconProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <circle cx="16" cy="16" r="16" fill="#28A0F0" />
      <path
        d="M21.5 19.3L19.2 16l2.3-3.3 2.9 4.1-2.9 2.5zm-5.5-8.8l4 5.7-4 5.7-4-5.7 4-5.7zm-5.5 8.8l2.3-3.3-2.3-3.3-2.9 4.1 2.9 2.5z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/**
 * Optimism (OP) Logo
 */
export function OptimismIcon({ className = "w-6 h-6", size }: IconProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <circle cx="16" cy="16" r="16" fill="#FF0420" />
      <path
        d="M8.5 12.2c0-2.3 1.8-3.9 4.3-3.9s4.3 1.6 4.3 3.9v7.6c0 2.3-1.8 3.9-4.3 3.9s-4.3-1.6-4.3-3.9v-7.6zm3 7.6c0 .8.5 1.4 1.3 1.4s1.3-.6 1.3-1.4v-7.6c0-.8-.5-1.4-1.3-1.4s-1.3.6-1.3 1.4v7.6zm8-11.3h3.5c2.4 0 4 1.5 4 3.6s-1.6 3.6-4 3.6h-1.3v4.1h-2.2V8.5zm2.2 4.9h1.2c1.1 0 1.8-.6 1.8-1.4s-.7-1.4-1.8-1.4h-1.2v2.8z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/**
 * Polygon (POL / MATIC) Logo
 */
export function PolygonIcon({ className = "w-6 h-6", size }: IconProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <circle cx="16" cy="16" r="16" fill="#8247E5" />
      <path
        d="M20.6 13.8a2.6 2.6 0 00-1.3-.3 2.5 2.5 0 00-2.2 1.3l-2.6 4.5a1.5 1.5 0 01-1.3.8 1.5 1.5 0 01-.8-.2l-2.1-1.2a1.5 1.5 0 01-.8-1.3v-2.4a1.5 1.5 0 01.8-1.3l2.1-1.2c.4-.2.9-.3 1.3-.3.9 0 1.7.5 2.2 1.3l.9 1.5 1.8-1-1-1.6A4.5 4.5 0 0013.6 8a4.5 4.5 0 00-2.3.6l-2.1 1.2A4.5 4.5 0 007 13.7v2.4a4.5 4.5 0 002.3 3.9l2.1 1.2a4.5 4.5 0 002.2.6 4.5 4.5 0 003.9-2.3l2.6-4.5a1.5 1.5 0 011.3-.8c.3 0 .6.1.8.2l2.1 1.2c.5.3.8.8.8 1.3v2.4a1.5 1.5 0 01-.8 1.3l-2.1 1.2a1.5 1.5 0 01-1.3.3 2.5 2.5 0 01-2.2-1.3l-.9-1.5-1.8 1 1 1.6a4.5 4.5 0 003.9 2.3c.8 0 1.5-.2 2.3-.6l2.1-1.2a4.5 4.5 0 002.3-3.9v-2.4a4.5 4.5 0 00-2.3-3.9l-2.1-1.2z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/**
 * BNB Chain (BNB) Logo
 */
export function BnbIcon({ className = "w-6 h-6", size }: IconProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <circle cx="16" cy="16" r="16" fill="#F0B90B" />
      <path
        d="M16 7l2.6 2.6-6.6 6.6-2.6-2.6L16 7zm0 18l-2.6-2.6 6.6-6.6 2.6 2.6L16 25zm-6.6-9.4L12 13l2.6 2.6-2.6 2.6-2.6-2.6zm10.6 2.6L17.4 13l2.6-2.6 2.6 2.6-2.6 3.2zm-4-1.4l2-2 2 2-2 2-2-2z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/**
 * Avalanche (AVAX) Logo
 */
export function AvalancheIcon({ className = "w-6 h-6", size }: IconProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <circle cx="16" cy="16" r="16" fill="#E84142" />
      <path
        d="M16.9 8.2a1 1 0 00-1.8 0L9.3 20.8a1 1 0 00.9 1.4h3.6a1 1 0 00.9-.6l1.3-2.6h3.4l-2.6-4.5 2.1-3.6 4.3 7.5a1 1 0 00.9.6h1.2a1 1 0 00.9-1.4L16.9 8.2z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/**
 * USD Coin (USDC) Logo
 */
export function UsdcIcon({ className = "w-6 h-6", size }: IconProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <path
        d="M16 6a10 10 0 00-6.7 17.4l1.4-1.4A8 8 0 0116 8v-2zm6.7 2.6l-1.4 1.4A8 8 0 0116 24v2a10 10 0 006.7-17.4z"
        fill="#FFFFFF"
        fillOpacity="0.7"
      />
      <path
        d="M16.5 11.5c-2.3 0-3.5 1-3.5 2.5 0 1.4 1 2.1 2.8 2.5l.8.2c1.3.3 1.8.7 1.8 1.4 0 .9-.8 1.5-2.2 1.5-1.5 0-2.4-.6-2.6-1.7h-1.6c.2 1.8 1.5 2.9 3.4 3.1V22h1.6v-1c2.4-.2 3.6-1.4 3.6-2.8 0-1.5-1.1-2.2-3-2.7l-.8-.2c-1.2-.3-1.6-.7-1.6-1.3 0-.8.7-1.3 1.9-1.3 1.3 0 2.1.5 2.3 1.4h1.6c-.2-1.6-1.4-2.5-3-2.6V10h-1.6v1.5h.3z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/**
 * Solana Logo
 */
export function SolanaIcon({ className = "w-6 h-6", size }: IconProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <circle cx="16" cy="16" r="16" fill="#141414" />
      <path d="M7 21.5a1 1 0 011-1h13.2a1 1 0 01.8.4l3 3.6a.5.5 0 01-.4.8H10.8a1 1 0 01-.8-.4l-3-3.4z" fill="url(#sol_g1)" />
      <path d="M7 10.5a1 1 0 011-1h13.2a1 1 0 01.8.4l3 3.6a.5.5 0 01-.4.8H10.8a1 1 0 01-.8-.4l-3-3.4z" fill="url(#sol_g2)" />
      <path d="M25 16a1 1 0 01-1 1H10.8a1 1 0 01-.8-.4l-3-3.6a.5.5 0 01.4-.8h13.8a1 1 0 01.8.4l3 3.4z" fill="url(#sol_g3)" />
      <defs>
        <linearGradient id="sol_g1" x1="7" y1="23" x2="25" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFA3" /><stop offset="1" stopColor="#DC1FFF" />
        </linearGradient>
        <linearGradient id="sol_g2" x1="7" y1="12" x2="25" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFA3" /><stop offset="1" stopColor="#DC1FFF" />
        </linearGradient>
        <linearGradient id="sol_g3" x1="7" y1="15" x2="25" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#DC1FFF" /><stop offset="1" stopColor="#00FFA3" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Bitcoin Logo
 */
export function BtcIcon({ className = "w-6 h-6", size }: IconProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <path d="M22.5 13.7c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.7-.4-.7 2.6c-.4-.1-.9-.2-1.4-.3l.7-2.7-1.7-.4-.7 2.7c-.4-.1-.7-.2-1.1-.3l-2.3-.6-.5 1.8s1.2.3 1.2.3c.7.2.8.7.8 1.1l-.8 3.2c0 .1.1.2.1.2l-.1 0-.9 3.5c-.1.2-.3.6-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.9 2.2.5c.4.1.8.2 1.2.3l-.7 2.8 1.7.4.7-2.7c.5.1.9.2 1.4.3l-.7 2.8 1.7.4.7-2.7c2.9.5 5.1.3 6-2.3.7-2.1-.1-3.3-1.5-4.1 1.1-.3 1.9-1.1 2.1-2.7zm-3.8 5.7c-.5 2.1-4 .9-5.1.7l.9-3.7c1.1.3 4.7.8 4.2 3zm.5-5.7c-.5 1.9-3.4.9-4.3.7l.8-3.4c1 .2 4 .7 3.5 2.7z" fill="#FFF" />
    </svg>
  );
}

/**
 * Dogecoin Logo
 */
export function DogeIcon({ className = "w-6 h-6", size }: IconProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <circle cx="16" cy="16" r="16" fill="#C2A633" />
      <path d="M12 9h4.8c4.2 0 7.2 2.7 7.2 7s-3 7-7.2 7H12V9zm3.5 11.2h1.4c2.2 0 3.7-1.5 3.7-4.2s-1.5-4.2-3.7-4.2h-1.4v8.4zm-4.5-4.7h13v1.8H11v-1.8z" fill="#FFF" />
    </svg>
  );
}

/**
 * Zcash Logo
 */
export function ZcashIcon({ className = "w-6 h-6", size }: IconProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <circle cx="16" cy="16" r="16" fill="#F4B728" />
      <path d="M17 7v3h3v2.5h-5.5l5.8 7.5H15v-3h-3v-2.5h5.5L11.7 7H17z" fill="#231F20" />
      <path d="M16 23v2h-2v-2h2zM16 7V5h-2v2h2z" fill="#231F20" />
    </svg>
  );
}

/**
 * Universal Multi-Chain Icon Dispatcher
 */
export function ChainIcon({
  chain,
  className = "w-5 h-5",
  size,
}: {
  chain: string;
  className?: string;
  size?: number;
}) {
  const c = (chain || "").toLowerCase();

  if (c.includes("near")) {
    return <NearIcon className={className} size={size} />;
  }
  if (c.includes("base")) {
    return <BaseIcon className={className} size={size} />;
  }
  if (c.includes("sol") || c.includes("solana")) {
    return <SolanaIcon className={className} size={size} />;
  }
  if (c.includes("btc") || c.includes("bitcoin")) {
    return <BtcIcon className={className} size={size} />;
  }
  if (c.includes("doge")) {
    return <DogeIcon className={className} size={size} />;
  }
  if (c.includes("zec") || c.includes("zcash")) {
    return <ZcashIcon className={className} size={size} />;
  }
  if (c.includes("arbitrum")) {
    return <ArbitrumIcon className={className} size={size} />;
  }
  if (c.includes("optimism") || c === "op") {
    return <OptimismIcon className={className} size={size} />;
  }
  if (c.includes("polygon") || c.includes("matic") || c.includes("amoy")) {
    return <PolygonIcon className={className} size={size} />;
  }
  if (c.includes("bnb") || c.includes("binance") || c.includes("bsc")) {
    return <BnbIcon className={className} size={size} />;
  }
  if (c.includes("avax") || c.includes("avalanche") || c.includes("fuji")) {
    return <AvalancheIcon className={className} size={size} />;
  }
  // Default to Ethereum
  return <EthIcon className={className} size={size} />;
}

/**
 * Universal Token Icon Dispatcher
 */
export function TokenIcon({
  symbol,
  chain,
  className = "w-6 h-6",
  size,
}: {
  symbol: string;
  chain?: string;
  className?: string;
  size?: number;
}) {
  const s = (symbol || "").toUpperCase();

  if (s === "USDC") {
    return <UsdcIcon className={className} size={size} />;
  }
  if (s === "NEAR") {
    return <NearIcon className={className} size={size} />;
  }
  if (s === "ETH") {
    return <EthIcon className={className} size={size} />;
  }
  if (s === "SOL") {
    return <SolanaIcon className={className} size={size} />;
  }
  if (s === "BTC") {
    return <BtcIcon className={className} size={size} />;
  }
  if (s === "DOGE") {
    return <DogeIcon className={className} size={size} />;
  }
  if (s === "ZEC") {
    return <ZcashIcon className={className} size={size} />;
  }
  if (s === "OP") {
    return <OptimismIcon className={className} size={size} />;
  }
  if (s === "POL" || s === "MATIC") {
    return <PolygonIcon className={className} size={size} />;
  }
  if (s === "BNB") {
    return <BnbIcon className={className} size={size} />;
  }
  if (s === "AVAX") {
    return <AvalancheIcon className={className} size={size} />;
  }

  // Fallback to chain icon or Ethereum
  if (chain) {
    return <ChainIcon chain={chain} className={className} size={size} />;
  }
  return <EthIcon className={className} size={size} />;
}
