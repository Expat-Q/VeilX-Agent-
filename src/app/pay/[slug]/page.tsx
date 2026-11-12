"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Copy,
  Check,
  QrCode,
  Wallet,
  Clock,
  Sparkles,
  AlertTriangle,
  Globe,
  Share2,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useAuth } from "@/context/AuthContext";
import { getStoredAgentSession, recordAgentSpend } from "@/lib/near-embedded-wallet";
import { addTransactionRecord } from "@/lib/transactions-store";
import { AssetLogo, ChainLogo } from "@/components/common/AssetLogo";
import { TokenSelectorModal, SupportedTokenItem } from "@/components/pay/TokenSelectorModal";

interface QuoteDetails {
  depositAddress: string;
  originChain: string;
  originAssetSymbol: string;
  amountInFormatted: string;
  amountInUsd: string;
  amountOutFormatted?: string;
  destinationAssetSymbol?: string;
  timeEstimateSeconds: number;
  deadline: string;
  signature?: string;
}

interface InvoiceData {
  id: string;
  slug: string;
  creatorHandle: string;
  recipientNearAccount: string;
  amountUsd: number;
  description: string;
}

const CHAIN_NAMES: Record<string, string> = {
  near: "NEAR Protocol",
  base: "Base",
  arbitrum: "Arbitrum",
  ethereum: "Ethereum",
  solana: "Solana",
  bitcoin: "Bitcoin",
  polygon: "Polygon",
  optimism: "Optimism",
  bnb: "BNB Chain",
};

const EVM_CHAINS_CONFIG: Record<
  string,
  {
    name: string;
    chainIdHex: string;
    chainParams: any;
    nativeSymbol: string;
    tokens: Record<string, string>;
  }
> = {
  base: {
    name: "Base",
    chainIdHex: "0x2105",
    chainParams: {
      chainId: "0x2105",
      chainName: "Base",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://mainnet.base.org"],
      blockExplorerUrls: ["https://basescan.org"],
    },
    nativeSymbol: "ETH",
    tokens: {
      USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      CBBTC: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    },
  },
  arbitrum: {
    name: "Arbitrum One",
    chainIdHex: "0xa4b1",
    chainParams: {
      chainId: "0xa4b1",
      chainName: "Arbitrum One",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://arb1.arbitrum.io/rpc"],
      blockExplorerUrls: ["https://arbiscan.io"],
    },
    nativeSymbol: "ETH",
    tokens: {
      USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548",
    },
  },
  ethereum: {
    name: "Ethereum",
    chainIdHex: "0x1",
    chainParams: {
      chainId: "0x1",
      chainName: "Ethereum Mainnet",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://eth.llamarpc.com"],
      blockExplorerUrls: ["https://etherscan.io"],
    },
    nativeSymbol: "ETH",
    tokens: {
      USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    },
  },
  polygon: {
    name: "Polygon",
    chainIdHex: "0x89",
    chainParams: {
      chainId: "0x89",
      chainName: "Polygon Mainnet",
      nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
      rpcUrls: ["https://polygon-rpc.com"],
      blockExplorerUrls: ["https://polygonscan.com"],
    },
    nativeSymbol: "POL",
    tokens: {
      USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    },
  },
  optimism: {
    name: "Optimism",
    chainIdHex: "0xa",
    chainParams: {
      chainId: "0xa",
      chainName: "OP Mainnet",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://mainnet.optimism.io"],
      blockExplorerUrls: ["https://optimistic.etherscan.io"],
    },
    nativeSymbol: "ETH",
    tokens: {
      USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      OP: "0x4200000000000000000000000000000000000042",
    },
  },
  bnb: {
    name: "BNB Chain",
    chainIdHex: "0x38",
    chainParams: {
      chainId: "0x38",
      chainName: "BNB Smart Chain",
      nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
      rpcUrls: ["https://bsc-dataseed.binance.org"],
      blockExplorerUrls: ["https://bscscan.com"],
    },
    nativeSymbol: "BNB",
    tokens: {
      USDT: "0x55d398326f99059fF775485246999027B3197955",
    },
  },
};

export default function PayInvoicePage() {
  const params = useParams();
  const slug = (params?.slug as string) || "inv_sample";

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [invoiceNotFound, setInvoiceNotFound] = useState(false);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(true);
  const [nearPrice, setNearPrice] = useState<number>(3.50);

  const { user, nearBalance, refreshAccountData, spendingLimitUsd, spentUsd } = useAuth();
  const [viewMode, setViewMode] = useState<"wallet" | "qr">("wallet");
  const [selectedChain, setSelectedChain] = useState<string>("base");
  const [selectedAsset, setSelectedAsset] = useState<string>("ETH");
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);

  const [quoteSecondsLeft, setQuoteSecondsLeft] = useState<number>(60);
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteDetails, setQuoteDetails] = useState<QuoteDetails | null>(null);
  const [depositStatus, setDepositStatus] = useState<string>("PENDING_DEPOSIT");
  const [copied, setCopied] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  // Detected Browser Wallet State
  const [detectedWallet, setDetectedWallet] = useState<{
    type: "evm" | "solana" | "near" | "none";
    name: string;
    isDetected: boolean;
  }>({ type: "none", name: "Wallet", isDetected: false });

  // Update wallet detection based on active chain
  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as any;

    if (selectedChain === "near") {
      if (win.meteor) {
        setDetectedWallet({ type: "near", name: "Meteor Wallet", isDetected: true });
      } else if (win.near) {
        setDetectedWallet({ type: "near", name: "Sender / HERE Wallet", isDetected: true });
      } else {
        setDetectedWallet({ type: "near", name: "MyNearWallet (Web)", isDetected: true });
      }
    } else if (selectedChain === "solana") {
      if (win.solana?.isPhantom) {
        setDetectedWallet({ type: "solana", name: "Phantom Wallet", isDetected: true });
      } else if (win.solana) {
        setDetectedWallet({ type: "solana", name: "Solana Wallet", isDetected: true });
      } else {
        setDetectedWallet({ type: "none", name: "Phantom Wallet", isDetected: false });
      }
    } else if (Boolean(EVM_CHAINS_CONFIG[selectedChain])) {
      if (win.ethereum?.isCoinbaseWallet) {
        setDetectedWallet({ type: "evm", name: "Coinbase Wallet", isDetected: true });
      } else if (win.ethereum?.isMetaMask) {
        setDetectedWallet({ type: "evm", name: "MetaMask", isDetected: true });
      } else if (win.ethereum?.isRainbow) {
        setDetectedWallet({ type: "evm", name: "Rainbow Wallet", isDetected: true });
      } else if (win.ethereum) {
        setDetectedWallet({ type: "evm", name: "Browser Web3 Wallet", isDetected: true });
      } else {
        setDetectedWallet({ type: "none", name: "MetaMask / Web3", isDetected: false });
      }
    } else {
      setDetectedWallet({ type: "none", name: "External Wallet", isDetected: false });
    }
  }, [selectedChain]);

  // Fetch real-time NEAR price oracle
  useEffect(() => {
    fetch("/api/near/price")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.priceUsd) {
          setNearPrice(data.priceUsd);
        }
      })
      .catch(() => {});
  }, []);

  // 1. Fetch real invoice data from MongoDB Atlas
  useEffect(() => {
    setIsLoadingInvoice(true);
    fetch(`/api/paylinks?slug=${slug}`)
      .then((res) => res.json())
      .then((data) => {
        setIsLoadingInvoice(false);
        if (data.success && data.paylink) {
          const isPrivate = Boolean(data.paylink.isPrivate);
          setInvoice({
            id: slug,
            slug: slug,
            creatorHandle: data.paylink.creatorHandle || "anonymous",
            recipientNearAccount: data.paylink.recipientNearAccount || data.paylink.creatorWallet || "veilx-agent.testnet",
            amountUsd: data.paylink.amountUsd || data.paylink.amount || 0.0,
            description: isPrivate
              ? "🔒 Confidential Invoice (Encrypted Details)"
              : (data.paylink.memo || "Payment Request"),
          });
          if (data.paylink.status === "settled") {
            setDepositStatus("SETTLED");
            if (data.paylink.settledTx) {
              setTxHash(data.paylink.settledTx);
            }
          }
        } else {
          setInvoiceNotFound(true);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch paylink from DB:", err);
        setIsLoadingInvoice(false);
        setInvoiceNotFound(true);
      });
  }, [slug]);

  // NEAR native amount calculation with live oracle price
  const estimatedNearAmount = invoice ? (invoice.amountUsd / nearPrice).toFixed(3) : "0.000";

  // Omnichain solver route request via Defuse 1Click Solvers
  const handleFetchSolverQuote = async (chain: string, asset?: string) => {
    if (!invoice) return;
    setIsQuoting(true);
    setQuoteError(null);

    const c = chain.toUpperCase();
    let assetSymbol = asset ? asset.toUpperCase() : "USDC";
    if (!asset) {
      if (c === "SOLANA" || c === "SOL") assetSymbol = "SOL";
      else if (c === "BITCOIN" || c === "BTC") assetSymbol = "BTC";
      else if (c === "ETHEREUM" || c === "ETH") assetSymbol = "ETH";
      else if (c === "BASE") assetSymbol = "ETH";
      else if (c === "ARBITRUM") assetSymbol = "ETH";
      else if (c === "NEAR") assetSymbol = "NEAR";
    }

    try {
      const res = await fetch("/api/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceChain: c,
          sourceAsset: assetSymbol,
          targetChain: "NEAR",
          targetAsset: "NEAR",
          amount: invoice.amountUsd,
          recipient: invoice.recipientNearAccount,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.order) {
        throw new Error(data.error || "Failed to retrieve solver quote");
      }

      setQuoteDetails({
        depositAddress: data.order.depositAddress,
        originChain: data.order.sourceChain,
        originAssetSymbol: data.order.sourceAsset,
        amountInFormatted: data.order.sourceAmount.toString(),
        amountInUsd: invoice.amountUsd.toFixed(2),
        timeEstimateSeconds: data.order.timeEstimateSeconds || 25,
        deadline: new Date(data.order.expiresAt).toLocaleTimeString(),
      });
      setQuoteSecondsLeft(60);
      setDepositStatus("PENDING_DEPOSIT");
    } catch (err: any) {
      console.error("Quote error:", err);
      setQuoteError(err.message || "Failed to obtain solver quote. Please try again.");
    } finally {
      setIsQuoting(false);
    }
  };

  // 60-Second Solver Quote Expiration Progress Ring with Auto-Requote
  useEffect(() => {
    if (!quoteDetails || depositStatus === "SETTLED" || selectedChain === "near") return;
    const timer = setInterval(() => {
      setQuoteSecondsLeft((prev) => {
        if (prev <= 1) {
          handleFetchSolverQuote(selectedChain, selectedAsset);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteDetails?.depositAddress, depositStatus, selectedChain, selectedAsset]);

  // Poll for solver settlement when a cross-chain deposit address is active
  useEffect(() => {
    if (!quoteDetails?.depositAddress || depositStatus === "SETTLED" || selectedChain === "near") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/intents?depositAddress=${encodeURIComponent(quoteDetails.depositAddress)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status === "SUCCESS" || data.status === "SETTLED") {
            setDepositStatus("SETTLED");
            if (data.destinationTxHash) {
              setTxHash(data.destinationTxHash);
            }
          }
        }
      } catch (err) {
        console.error("Polling status error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [quoteDetails?.depositAddress, depositStatus, selectedChain]);

  // Celebratory Confetti Burst on Settlement
  useEffect(() => {
    if (depositStatus === "SETTLED") {
      try {
        confetti({
          particleCount: 85,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#16A34A", "#F59E0B", "#10B981", "#3B82F6", "#FDFBF7"],
        });
      } catch {}
    }
  }, [depositStatus]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  // Real External Wallet Payment Connection & Signing (EVM, Solana, NEAR)
  const handleRealPayment = async () => {
    if (!invoice) return;
    setIsPaying(true);
    setPayError(null);

    try {
      if (selectedChain === "near") {
        const win = typeof window !== "undefined" ? (window as any) : {};
        const targetAccount = invoice.recipientNearAccount || "veilx-agent.testnet";
        const numNear = parseFloat(estimatedNearAmount) || 1;
        const nearAmountYocto = (BigInt(Math.floor(numNear * 1e6)) * BigInt(1e18)).toString();

        if (win.meteor && win.meteor.accountId) {
          const res = await win.meteor.signAndSendTransaction({
            receiverId: targetAccount,
            actions: [{ type: "Transfer", params: { deposit: nearAmountYocto } }],
          });
          const hash = res?.transaction?.hash;
          if (hash) {
            setTxHash(hash);
            setDepositStatus("SETTLED");
          }
        } else if (win.near && win.near.account) {
          const res = await win.near.sendMoney({
            receiverId: targetAccount,
            amount: nearAmountYocto,
          });
          const hash = res?.transaction?.hash;
          if (hash) {
            setTxHash(hash);
            setDepositStatus("SETTLED");
          }
        } else {
          // Open MyNearWallet Testnet Web Wallet with prefilled recipient and amount
          const myNearWalletUrl = `https://testnet.mynearwallet.com/send-money?recipient=${encodeURIComponent(
            targetAccount
          )}&amount=${encodeURIComponent(numNear.toString())}`;
          window.open(myNearWalletUrl, "_blank", "noopener,noreferrer");
        }
      } else if (Boolean(EVM_CHAINS_CONFIG[selectedChain])) {
        // Connect & Pay via External EVM Browser Wallet (MetaMask, Coinbase Wallet)
        const win = typeof window !== "undefined" ? (window as any) : {};
        if (!win.ethereum) {
          throw new Error("No EVM wallet detected (MetaMask, Coinbase Wallet). Please install an extension or use the Demo button.");
        }

        // 1. Request Account Connection
        const accounts = await win.ethereum.request({ method: "eth_requestAccounts" });
        if (!accounts || accounts.length === 0) {
          throw new Error("Wallet connection rejected by user.");
        }
        const userAddress = accounts[0];

        // 2. Target network verification
        const config = EVM_CHAINS_CONFIG[selectedChain];
        if (config) {
          try {
            await win.ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: config.chainIdHex }],
            });
          } catch (switchErr: any) {
            if (switchErr.code === 4902) {
              await win.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [config.chainParams],
              });
            }
          }
        }

        // 3. Ensure intent quote exists for cross-chain settlement
        if (!quoteDetails?.depositAddress) {
          await handleFetchSolverQuote(selectedChain, selectedAsset);
        }

        const depositTarget = quoteDetails?.depositAddress;
        if (!depositTarget) {
          throw new Error("1Click cross-chain solver deposit address is not ready. Please try again or use Demo simulation.");
        }

        // 4. Sign & Broadcast Transaction
        let broadcastTx = "";
        const isNative = selectedAsset === config.nativeSymbol;
        if (isNative) {
          const rawAmount = quoteDetails?.amountInFormatted || (invoice.amountUsd / 2200).toFixed(6);
          const weiValue = BigInt(Math.floor(parseFloat(rawAmount) * 1e18)).toString(16);
          broadcastTx = await win.ethereum.request({
            method: "eth_sendTransaction",
            params: [
              {
                from: userAddress,
                to: depositTarget,
                value: "0x" + weiValue,
              },
            ],
          });
        } else {
          // ERC-20 token transfer (USDC, USDT, etc.)
          const tokenAddress = config?.tokens[selectedAsset.toUpperCase()];
          if (!tokenAddress) {
            throw new Error(`Token contract for ${selectedAsset} on ${selectedChain} is not configured.`);
          }
          const rawAmount = quoteDetails?.amountInFormatted || invoice.amountUsd.toString();
          const tokenUnits = BigInt(Math.floor(parseFloat(rawAmount) * 1e6)).toString(16).padStart(64, "0");
          const cleanTarget = depositTarget.replace("0x", "").padStart(64, "0");
          const data = `0xa9059cbb${cleanTarget}${tokenUnits}`;

          broadcastTx = await win.ethereum.request({
            method: "eth_sendTransaction",
            params: [
              {
                from: userAddress,
                to: tokenAddress,
                data: data,
                value: "0x0",
              },
            ],
          });
        }

        if (broadcastTx) {
          setTxHash(broadcastTx);
          setDepositStatus("SETTLED");
          await fetch("/api/paylinks", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slug: invoice.slug,
              status: "settled",
              settledTx: broadcastTx,
              payerHandle: `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`,
              payerWallet: userAddress,
              amountNear: parseFloat(estimatedNearAmount) || 1,
            }),
          }).catch(() => {});
        }
      } else if (selectedChain === "solana") {
        const win = typeof window !== "undefined" ? (window as any) : {};
        if (!win.solana) {
          throw new Error("Phantom / Solana wallet not detected. Please install Phantom or use Demo simulation.");
        }
        await win.solana.connect();
        // Since Solana testnet solvers are simulated, trigger demo solver
        handleSimulateSolverPayment();
      }
    } catch (err: any) {
      console.error("Payment execution error:", err);
      setPayError(err.message || "Payment authorization failed");
    } finally {
      setIsPaying(false);
    }
  };

  const handleSimulateSolverPayment = async () => {
    if (!invoice) return;
    setIsPaying(true);
    setPayError(null);
    try {
      // 1. Simulate 2-second solver discovery & instant fill latency
      await new Promise((r) => setTimeout(r, 1800));
      const demoTx = `sim_solver_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // 2. Mark settled in database
      await fetch("/api/paylinks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: invoice.slug,
          status: "settled",
          settledTx: demoTx,
          payerHandle: `solver_${selectedChain}`,
          payerWallet: `defuse_${selectedChain}_solver.near`,
          amountNear: parseFloat(estimatedNearAmount) || 1,
        }),
      }).catch(() => {});

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("veilx_activity_updated"));
        try {
          confetti({
            particleCount: 85,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#16A34A", "#F59E0B", "#10B981", "#3B82F6", "#FDFBF7"],
          });
        } catch {}
      }

      setTxHash(demoTx);
      setDepositStatus("SETTLED");
    } catch (err: any) {
      setPayError(err.message || "Simulated solver settlement failed");
    } finally {
      setIsPaying(false);
    }
  };

  const handleAgentPayment = async () => {
    if (!user || !invoice) return;
    setIsPaying(true);
    setPayError(null);
    try {
      const activeSession = getStoredAgentSession(user.xHandle);
      const numNear = parseFloat(estimatedNearAmount) || 1;

      const currentNear = parseFloat(nearBalance || "0");
      if (currentNear < numNear) {
        throw new Error(
          `Insufficient wallet balance: you have ${currentNear.toFixed(3)} NEAR, but invoice requires ${numNear.toFixed(3)} NEAR.`
        );
      }

      const remainingCap = Math.max(0, spendingLimitUsd - spentUsd);
      if (invoice.amountUsd > remainingCap) {
        throw new Error(
          `Session spending guardrail: invoice is $${invoice.amountUsd.toFixed(2)}, but your remaining limit today is $${remainingCap.toFixed(2)}.`
        );
      }

      if (!activeSession?.secretKey) {
        throw new Error("Active session key not found. Please re-authenticate your session.");
      }

      // 100% Non-Custodial In-Browser Direct Transfer via User Session Key
      const nearAPI = await import("near-api-js");
      const nodeUrl = typeof window !== "undefined"
        ? `${window.location.origin}/api/near/rpc`
        : (process.env.NEXT_PUBLIC_NEAR_NODE_URL || "https://rpc.testnet.near.org");
      const provider = new nearAPI.JsonRpcProvider({ url: nodeUrl });
      const keyPair = nearAPI.KeyPair.fromString(activeSession.secretKey as any);
      const signer = new nearAPI.KeyPairSigner(keyPair);
      const senderAccount = new nearAPI.Account(user.nearAccountId, provider, signer);
      const yocto = nearAPI.nearToYocto(numNear.toString() as any);

      const targetRecipient = invoice.recipientNearAccount || "veilx-agent.testnet";
      console.log(`[PayInvoice] Signing in-browser transfer of ${numNear} NEAR to ${targetRecipient}...`);

      const txOutcome = await senderAccount.transfer({
        receiverId: targetRecipient,
        amount: BigInt(yocto),
      });

      const realTxHash =
        (txOutcome as any)?.transaction?.hash ||
        (txOutcome as any)?.transaction_outcome?.id ||
        (txOutcome as any)?.receipts_outcome?.[0]?.id ||
        `tx_${Date.now()}`;

      // Mark settled in MongoDB and write inflow records
      await fetch("/api/paylinks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: invoice.slug,
          status: "settled",
          settledTx: realTxHash,
          payerHandle: user.xHandle,
          payerWallet: user.nearAccountId,
          amountNear: numNear,
        }),
      }).catch(() => {});

      recordAgentSpend(invoice.amountUsd, user.xHandle);
      await refreshAccountData();

      addTransactionRecord(
        {
          type: "direct_deposit",
          title: `Paid Invoice: ${invoice.description || invoice.slug}`,
          counterparty: invoice.recipientNearAccount,
          amountUsd: invoice.amountUsd,
          asset: "NEAR",
          status: "completed",
          statusLabel: "Invoice Paid",
          txHash: realTxHash,
          isInflow: false,
          memo: `Paid $${invoice.amountUsd.toFixed(2)} directly to ${invoice.recipientNearAccount}`,
        },
        user.xHandle
      );

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("veilx_activity_updated"));
      }

      setTxHash(realTxHash);
      setDepositStatus("SETTLED");
    } catch (err: any) {
      console.error("Agent pay error:", err);
      setPayError(err.message || "Failed to pay invoice with agent");
    } finally {
      setIsPaying(false);
    }
  };

  const isSettled = depositStatus === "SETTLED";

  const currentChainName = CHAIN_NAMES[selectedChain] || selectedChain.toUpperCase();

  const payAmountDisplay =
    selectedChain === "near" && selectedAsset === "NEAR"
      ? `${estimatedNearAmount} NEAR`
      : quoteDetails
      ? `${quoteDetails.amountInFormatted} ${quoteDetails.originAssetSymbol}`
      : selectedAsset === "ETH"
      ? `${(invoice ? invoice.amountUsd / 2200 : 0.0001).toFixed(5)} ETH`
      : selectedAsset === "SOL"
      ? `${(invoice ? invoice.amountUsd / 140 : 0.001).toFixed(4)} SOL`
      : selectedAsset === "BTC" || selectedAsset === "cbBTC"
      ? `${(invoice ? invoice.amountUsd / 68000 : 0.000005).toFixed(6)} ${selectedAsset}`
      : `${(invoice?.amountUsd || 0).toFixed(2)} ${selectedAsset}`;

  if (isLoadingInvoice) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#1E1315]" />
          <span className="text-xs font-bold text-[#8C7A7C] uppercase tracking-wider">
            Loading Invoice...
          </span>
        </div>
      </div>
    );
  }

  if (invoiceNotFound || !invoice) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#EBE3D5] p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-[#1E1315]">Invoice Not Found</h2>
          <p className="text-xs text-[#8C7A7C]">
            This payment link does not exist or may have expired. Please verify the URL.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4 py-8">
      {/* Relay-Style Select Token Modal */}
      <TokenSelectorModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        selectedChain={selectedChain}
        selectedAsset={selectedAsset}
        onSelect={(token: SupportedTokenItem) => {
          setSelectedChain(token.chainId);
          setSelectedAsset(token.symbol);
          if (token.chainId === "near" && token.symbol === "NEAR") {
            setQuoteDetails(null);
          } else {
            handleFetchSolverQuote(token.chainId, token.symbol);
          }
        }}
      />

      <div className="max-w-md w-full bg-white rounded-3xl border border-[#EBE3D5] p-6 space-y-5 shadow-sm">
        {/* Header: Recipient & Amount */}
        <div className="space-y-3 pb-3 border-b border-[#EBE3D5]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#1E1315] text-[#FDFBF7] flex items-center justify-center font-bold text-sm shadow-inner">
                ✦
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#8C7A7C] block">
                  INVOICE CHECKOUT
                </span>
                <span className="text-xs font-bold text-[#1E1315] block truncate max-w-[200px]">
                  @{invoice.creatorHandle}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-[#1E1315] tracking-tight">
                ${invoice.amountUsd.toFixed(2)}
              </div>
              <span className="text-[10px] font-bold text-[#8C7A7C] block">USD</span>
            </div>
          </div>

          <div className="bg-[#FAF5EC] rounded-xl p-2.5 flex items-center justify-between text-xs">
            <span className="text-[#8C7A7C] truncate pr-2">{invoice.description}</span>
            <span className="font-mono text-[11px] font-bold text-[#1E1315] shrink-0">
              {estimatedNearAmount} NEAR
            </span>
          </div>
        </div>

        {/* Settled Success State: Apple Pay / Cash App Style Digital Receipt */}
        {isSettled ? (
          <div className="p-6 rounded-3xl bg-gradient-to-b from-[#F0FDF4] to-[#FAFDF8] border-2 border-[#BBF7D0] text-center space-y-4 animate-in zoom-in-95 duration-300 shadow-sm">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full bg-[#DCFCE7] animate-ping opacity-40"></div>
              <div className="relative w-16 h-16 rounded-full bg-[#16A34A] text-white flex items-center justify-center shadow-md">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
            </div>

            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#16A34A] block mb-1">
                PAYMENT CONFIRMED
              </span>
              <div className="text-3xl font-black text-[#1E1315] tracking-tight">
                {payAmountDisplay}
              </div>
              <span className="text-xs font-semibold text-[#8C7A7C] block mt-0.5">
                ≈ ${invoice.amountUsd.toFixed(2)} USD
              </span>
            </div>

            {/* Receipt Breakdown Card */}
            <div className="bg-white rounded-2xl p-4 border border-[#BBF7D0] text-left text-xs space-y-2.5 shadow-inner/50">
              <div className="flex justify-between items-center pb-2 border-b border-[#F0FDF4]">
                <span className="text-[#8C7A7C]">Invoice For</span>
                <span className="font-bold text-[#1E1315] truncate max-w-[200px]">
                  {invoice.description}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#F0FDF4]">
                <span className="text-[#8C7A7C]">Recipient</span>
                <span className="font-bold text-[#1E1315] truncate max-w-[200px]">
                  @{invoice.creatorHandle}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#F0FDF4]">
                <span className="text-[#8C7A7C]">Destination Wallet</span>
                <span className="font-mono text-[11px] font-bold text-[#1E1315] truncate max-w-[180px]">
                  {invoice.recipientNearAccount}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#F0FDF4]">
                <span className="text-[#8C7A7C]">Payment Rail</span>
                <span className="font-bold text-[#166534] bg-[#DCFCE7] px-2 py-0.5 rounded-full text-[10px]">
                  {selectedChain === "near" ? "NEAR Protocol (0 Gas)" : `${selectedChain.toUpperCase()} 1Click Solver`}
                </span>
              </div>
              {txHash && (
                <div className="flex justify-between items-center">
                  <span className="text-[#8C7A7C]">Proof Hash</span>
                  <span className="font-mono text-[11px] font-bold text-[#166534]">
                    {txHash.slice(0, 10)}...{txHash.slice(-6)}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              {txHash && (
                <a
                  href={`https://testnet.nearblocks.io/txns/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full h-11 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>View Proof on Block Explorer</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  const tweetText = `Just settled an invoice of $${invoice.amountUsd.toFixed(2)} on @VeilXapp via NEAR Protocol! Non-custodial cross-chain intents: ${window.location.href}`;
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, "_blank");
                }}
                className="w-full h-10 rounded-xl bg-white hover:bg-emerald-50 border border-[#BBF7D0] text-[#166534] text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Receipt on 𝕏</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* METHOD 1: Pay with VeilX Agent (If Logged In) */}
            {user && (
              <div className="p-4 rounded-2xl bg-[#FAF5EC] border border-[#EBE3D5] space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#1E1315] text-[#FDFBF7] flex items-center justify-center font-bold text-xs">
                      ✦
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#1E1315] block">
                        VeilX Agent 1-Click Pay
                      </span>
                      <span className="text-[10px] text-[#8C7A7C] block truncate max-w-[200px]">
                        @{user.xHandle} ({user.nearAccountId})
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
                    Delegated Key
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleAgentPayment}
                  disabled={isPaying}
                  className="w-full h-11 rounded-xl bg-[#1E1315] hover:bg-[#2F1F22] text-[#FDFBF7] text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isPaying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Settling via NEAR Session Key...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        Pay ${invoice.amountUsd.toFixed(2)} with VeilX Agent
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}

            {payError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{payError}</span>
              </div>
            )}

            {/* Divider */}
            <div className="relative flex items-center justify-center my-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#EBE3D5]"></div>
              </div>
              <span className="relative bg-white px-2.5 text-[10px] uppercase tracking-wider font-semibold text-[#8C7A7C]">
                {user ? "Or Pay via External Web3 Wallet" : "Select Payment Rail & Wallet"}
              </span>
            </div>

            {/* Relay-Style Pay With Token Selector (Image 2) */}
            <div className="p-3 bg-[#FAF7F0] border border-[#EBE3D5] rounded-2xl flex items-center justify-between shadow-2xs">
              <div className="pr-2">
                <span className="text-[10px] font-extrabold text-[#8C7A7C] uppercase tracking-wider block mb-0.5">
                  PAY WITH ASSET
                </span>
                <span className="text-xs font-semibold text-[#5C4D4F]">
                  38+ Chains via 1Click
                </span>
              </div>

              {/* Relay Pill Trigger Button */}
              <button
                type="button"
                onClick={() => setIsTokenModalOpen(true)}
                className="flex items-center gap-2.5 bg-white hover:bg-neutral-50 border border-[#EBE3D5] hover:border-[#1E1315]/40 py-1.5 px-3 rounded-full transition shadow-xs cursor-pointer group shrink-0"
              >
                {/* Composite Icon: Token Icon with tiny Chain Badge at bottom-right */}
                <div className="relative shrink-0 w-8 h-8">
                  <AssetLogo symbol={selectedAsset} className="w-8 h-8 rounded-full" />
                  <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5 shadow-xs border border-white">
                    <ChainLogo chain={selectedChain} className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Token Symbol & Chain Name */}
                <div className="text-left pr-0.5">
                  <div className="text-xs font-black text-[#1E1315] leading-tight">
                    {selectedAsset}
                  </div>
                  <div className="text-[10px] font-medium text-[#8C7A7C] leading-none">
                    {currentChainName}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-[#8C7A7C] group-hover:text-[#1E1315] transition" />
              </button>
            </div>

            {/* Omnichain Intent Settlement Info Banner */}
            {selectedChain !== "near" && (
              <div className="p-3 rounded-2xl bg-[#FAF5EC] border border-[#EBE3D5] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-[#1E1315]">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>NEAR Intents Settlement</span>
                  </div>
                  {quoteDetails && (
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#7A6A5E]">
                      <Clock className="w-3 h-3 text-[#7A6A5E]" />
                      <span>Quote {quoteSecondsLeft}s</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-[#5C4D4F] leading-relaxed">
                  Paying with <strong>{selectedAsset} on {currentChainName}</strong>. 1Click solvers front instant liquidity and settle directly to @{invoice.creatorHandle}&apos;s account in ~12s.
                </p>
              </div>
            )}

            {/* View Mode Switcher: [ Browser Wallet ] vs [ Scan QR Code ] */}
            <div className="flex items-center justify-center pt-1">
              <div className="inline-flex p-1 rounded-full bg-[#FAF5EC] border border-[#EBE3D5]">
                <button
                  type="button"
                  onClick={() => setViewMode("wallet")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                    viewMode === "wallet"
                      ? "bg-[#1E1315] text-[#FDFBF7] shadow-sm"
                      : "text-[#5C4D4F] hover:text-[#1E1315]"
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Browser Wallet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("qr")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                    viewMode === "qr"
                      ? "bg-[#1E1315] text-[#FDFBF7] shadow-sm"
                      : "text-[#5C4D4F] hover:text-[#1E1315]"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Scan QR Code</span>
                </button>
              </div>
            </div>

            {/* Amount to Pay Callout */}
            <div className="text-center py-1">
              <span className="text-[9px] uppercase tracking-wider font-semibold text-[#8C7A7C] block mb-0.5">
                AMOUNT TO AUTHORIZE
              </span>
              <div className="text-3xl font-black text-[#1E1315] tracking-tight">
                {payAmountDisplay}
              </div>
            </div>

            {/* TAB A: Browser Wallet View */}
            {viewMode === "wallet" && (
              <div className="border border-[#EBE3D5] rounded-2xl p-4 bg-white space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#1E1315] text-[#FDFBF7] flex items-center justify-center font-bold text-xs shadow-inner">
                      {selectedChain === "near" ? "Ⓝ" : selectedChain === "base" ? "🔵" : "⚡"}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#1E1315]">
                        {detectedWallet.name}
                      </div>
                      <div className="text-[10px] text-[#8C7A7C]">
                        {detectedWallet.isDetected ? "Ready to connect & authorize" : "Install extension to pay directly"}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      detectedWallet.isDetected
                        ? "bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        detectedWallet.isDetected ? "bg-[#16A34A] animate-pulse" : "bg-amber-500"
                      }`}
                    ></span>
                    {detectedWallet.isDetected ? "Detected" : "Extension Optional"}
                  </span>
                </div>

                {/* Primary Button: Connect & Pay with detected wallet */}
                <button
                  type="button"
                  onClick={handleRealPayment}
                  disabled={isPaying || isQuoting}
                  className="w-full h-11 rounded-xl bg-[#1E1315] hover:bg-[#2F1F22] disabled:opacity-50 text-[#FDFBF7] text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                >
                  {isPaying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Confirming Transaction...</span>
                    </>
                  ) : (
                    <>
                      <Wallet className="w-3.5 h-3.5" />
                      <span>
                        {selectedChain === "near"
                          ? "Pay with NEAR Wallet"
                          : `Connect & Pay with ${detectedWallet.name} (${selectedChain.toUpperCase()})`}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                {/* Testnet Sandbox Simulation Button */}
                {selectedChain !== "near" && (
                  <button
                    type="button"
                    onClick={handleSimulateSolverPayment}
                    disabled={isPaying}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                  >
                    {isPaying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Simulating Cross-Chain Solver Settlement...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Simulate External Solver Deposit (Demo)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}

                <div className="text-center pt-1">
                  <span className="text-[10px] text-[#8C7A7C] block">
                    Zero gas on destination • 100% Non-custodial cross-chain intents
                  </span>
                </div>
              </div>
            )}

            {/* TAB B: Scan QR Code View */}
            {viewMode === "qr" && (
              <div className="border border-[#EBE3D5] rounded-2xl p-5 bg-white text-center space-y-3 shadow-sm">
                <div className="p-3 bg-[#FAF5EC] rounded-xl border border-[#EBE3D5] inline-block shadow-inner mx-auto">
                  <QRCodeSVG
                    value={
                      quoteDetails?.depositAddress ||
                      `near:${invoice.recipientNearAccount}?amount=${estimatedNearAmount}`
                    }
                    size={180}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-[#1E1315]">
                    Scan using your mobile wallet app
                  </p>
                  <p className="text-[10px] text-[#8C7A7C]">
                    Rainbow, MetaMask Mobile, Phantom, or Meteor
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
