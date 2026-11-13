// src/lib/chainRegistry.ts
// Industry-Standard Central Chain & Token Registry using TrustWallet Assets Open-Source CDN

export interface TokenConfig {
  symbol: string;
  name: string;
  contractAddress: string;
  decimals: number;
  logo: string;
  isConfigured?: boolean;
}

export interface ChainConfig {
  chainId: number;
  name: string;
  slug: string;
  type: "evm" | "near" | "solana" | "bitcoin";
  nativeCurrency: {
    symbol: string;
    name: string;
    decimals: number;
    logo: string;
  };
  rpcUrls: string[];
  explorerUrl?: string;
  color: string;
  badgeLogo: string;
  enabled: boolean;
  configuredTokens: TokenConfig[];
}

export const TRUSTWALLET_BASE_URL = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains";

export const CHAIN_LOGOS: Record<string, string> = {
  base: `${TRUSTWALLET_BASE_URL}/base/info/logo.png`,
  arbitrum: `${TRUSTWALLET_BASE_URL}/arbitrum/info/logo.png`,
  ethereum: `${TRUSTWALLET_BASE_URL}/ethereum/info/logo.png`,
  near: `${TRUSTWALLET_BASE_URL}/near/info/logo.png`,
  solana: `${TRUSTWALLET_BASE_URL}/solana/info/logo.png`,
  bitcoin: `${TRUSTWALLET_BASE_URL}/bitcoin/info/logo.png`,
  polygon: `${TRUSTWALLET_BASE_URL}/polygon/info/logo.png`,
  optimism: `${TRUSTWALLET_BASE_URL}/optimism/info/logo.png`,
  binance: `${TRUSTWALLET_BASE_URL}/binance/info/logo.png`,
  bnb: `${TRUSTWALLET_BASE_URL}/binance/info/logo.png`,
  avalanche: `${TRUSTWALLET_BASE_URL}/avalanchec/info/logo.png`,
};

export const DEFAULT_CHAINS: Record<string, ChainConfig> = {
  base: {
    chainId: 8453,
    name: "Base",
    slug: "base",
    type: "evm",
    nativeCurrency: {
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      logo: `${TRUSTWALLET_BASE_URL}/ethereum/info/logo.png`,
    },
    rpcUrls: ["https://mainnet.base.org", "https://base-rpc.publicnode.com", "https://1rpc.io/base"],
    explorerUrl: "https://basescan.org",
    color: "#0052FF",
    badgeLogo: `${TRUSTWALLET_BASE_URL}/base/info/logo.png`,
    enabled: true,
    configuredTokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
        logo: `${TRUSTWALLET_BASE_URL}/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png`,
        isConfigured: true,
      },
      {
        symbol: "cbBTC",
        name: "Coinbase Wrapped BTC",
        contractAddress: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
        decimals: 8,
        logo: `${TRUSTWALLET_BASE_URL}/base/assets/0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf/logo.png`,
        isConfigured: true,
      },
      {
        symbol: "AERO",
        name: "Aerodrome",
        contractAddress: "0x940181a94A35A4569E4529A3CDfB74e48FD98762",
        decimals: 18,
        logo: `${TRUSTWALLET_BASE_URL}/base/assets/0x940181a94A35A4569E4529A3CDfB74e48FD98762/logo.png`,
        isConfigured: true,
      },
    ],
  },

  baseSepolia: {
    chainId: 84532,
    name: "Base Sepolia",
    slug: "base-sepolia",
    type: "evm",
    nativeCurrency: {
      symbol: "ETH (Testnet)",
      name: "Sepolia Ether",
      decimals: 18,
      logo: `${TRUSTWALLET_BASE_URL}/ethereum/info/logo.png`,
    },
    rpcUrls: ["https://sepolia.base.org", "https://base-sepolia-rpc.publicnode.com"],
    explorerUrl: "https://sepolia.basescan.org",
    color: "#0052FF",
    badgeLogo: `${TRUSTWALLET_BASE_URL}/base/info/logo.png`,
    enabled: true,
    configuredTokens: [
      {
        symbol: "USDC",
        name: "USD Coin (Circle)",
        contractAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        decimals: 6,
        logo: `${TRUSTWALLET_BASE_URL}/base/info/logo.png`,
        isConfigured: true,
      },
    ],
  },

  arbitrumSepolia: {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    slug: "arbitrum-sepolia",
    type: "evm",
    nativeCurrency: {
      symbol: "ETH (Arb Sepolia)",
      name: "Arbitrum Sepolia Ether",
      decimals: 18,
      logo: `${TRUSTWALLET_BASE_URL}/ethereum/info/logo.png`,
    },
    rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc", "https://arbitrum-sepolia.publicnode.com"],
    explorerUrl: "https://sepolia.arbiscan.io",
    color: "#28A0F0",
    badgeLogo: `${TRUSTWALLET_BASE_URL}/arbitrum/info/logo.png`,
    enabled: true,
    configuredTokens: [
      {
        symbol: "USDC",
        name: "USD Coin (Circle)",
        contractAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
        decimals: 6,
        logo: `${TRUSTWALLET_BASE_URL}/arbitrum/info/logo.png`,
        isConfigured: true,
      },
    ],
  },

  sepolia: {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    slug: "sepolia",
    type: "evm",
    nativeCurrency: {
      symbol: "ETH (Sepolia)",
      name: "Sepolia Ether",
      decimals: 18,
      logo: `${TRUSTWALLET_BASE_URL}/ethereum/info/logo.png`,
    },
    rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com", "https://1rpc.io/sepolia"],
    explorerUrl: "https://sepolia.etherscan.io",
    color: "#627EEA",
    badgeLogo: `${TRUSTWALLET_BASE_URL}/ethereum/info/logo.png`,
    enabled: true,
    configuredTokens: [
      {
        symbol: "USDC",
        name: "USD Coin (Circle)",
        contractAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        decimals: 6,
        logo: `${TRUSTWALLET_BASE_URL}/ethereum/info/logo.png`,
        isConfigured: true,
      },
    ],
  },

  near: {
    chainId: 0,
    name: "NEAR Protocol",
    slug: "near",
    type: "near",
    nativeCurrency: {
      symbol: "NEAR",
      name: "NEAR Protocol",
      decimals: 24,
      logo: `${TRUSTWALLET_BASE_URL}/near/info/logo.png`,
    },
    rpcUrls: ["https://rpc.testnet.near.org", "https://rpc.mainnet.near.org"],
    explorerUrl: "https://testnet.nearblocks.io",
    color: "#00EC97",
    badgeLogo: `${TRUSTWALLET_BASE_URL}/near/info/logo.png`,
    enabled: true,
    configuredTokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        contractAddress: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
        decimals: 6,
        logo: `${TRUSTWALLET_BASE_URL}/near/info/logo.png`,
        isConfigured: true,
      },
    ],
  },
};
