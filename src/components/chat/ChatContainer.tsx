"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import confetti from "canvas-confetti";
import { ChatMessage, RadarStep } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";
import { processUserMessage } from "@/lib/ai-gateway";
import { recordAgentSpend, getStoredAgentSession, saveAgentSession, validateSpendBudget } from "@/lib/near-embedded-wallet";
import { addTransactionRecord, addPayLinkRecord, getTransactions, TransactionRecord } from "@/lib/transactions-store";
import { useAuth } from "@/context/AuthContext";
import { deriveEvmAddress } from "@/lib/near-chain-signatures";
import { sanitizeNearAccountId } from "@/lib/near-utils";
import { signAndBroadcastNearTransfer, signAndBroadcastMpcEvmTransfer, getClientRpcUrl } from "@/lib/near-client-signer";
import { formatHumanFriendlyError } from "@/lib/error-formatter";
import { pollIntentExecution } from "@/lib/1click";
import { Send, Sparkles, History, X, AlertTriangle, Trash2, Bot, CheckCircle2, UserCheck, Search, Wallet } from "lucide-react";
import { DepositModal } from "@/components/modals/DepositModal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

/**
 * Signs and broadcasts deposit_near_tip to the Veil Escrow contract on NEAR
 * using the user's in-browser session key.
 */
async function signAndBroadcastEscrowDeposit({
  senderAccountId,
  senderSecretKey,
  tipId,
  recipientHandle,
  amountNear,
  contractId = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "Veil-agent.testnet",
  nodeUrl,
}: {
  senderAccountId: string;
  senderSecretKey: string;
  tipId: string;
  recipientHandle: string;
  amountNear: number | string;
  contractId?: string;
  nodeUrl?: string;
}): Promise<{ success: boolean; txHash: string; tipId: string }> {
  const effectiveNodeUrl = nodeUrl || getClientRpcUrl();
  const numAmount = typeof amountNear === "string" ? parseFloat(amountNear) : amountNear;
  if (isNaN(numAmount) || numAmount < 0.01) {
    throw new Error("Attached escrow deposit must be at least 0.01 NEAR");
  }

  const nearAPI = await import("near-api-js");
  const provider = new nearAPI.JsonRpcProvider({ url: effectiveNodeUrl });
  const keyPair = nearAPI.KeyPair.fromString(senderSecretKey as any);
  const signer = new nearAPI.KeyPairSigner(keyPair);
  const account = new nearAPI.Account(senderAccountId, provider, signer);
  const yoctoAmount = nearAPI.nearToYocto(numAmount.toString() as any);

  const cleanHandle = recipientHandle.replace("@", "").trim().toLowerCase();

  let outcome: any;
  if (typeof (account as any).callFunctionRaw === "function") {
    outcome = await (account as any).callFunctionRaw({
      contractId,
      methodName: "deposit_near_tip",
      args: {
        tip_id: tipId,
        recipient_handle: cleanHandle,
      },
      gas: BigInt("100000000000000"), // 100 TGas
      deposit: BigInt(yoctoAmount),
    });
  } else if (typeof (account as any).functionCall === "function") {
    outcome = await (account as any).functionCall({
      contractId,
      methodName: "deposit_near_tip",
      args: {
        tip_id: tipId,
        recipient_handle: cleanHandle,
      },
      gas: BigInt("100000000000000"),
      attachedDeposit: BigInt(yoctoAmount),
    });
  } else {
    throw new Error("NEAR Account method for function call not found in near-api-js");
  }

  const txHash =
    outcome?.transaction?.hash ||
    outcome?.transaction_outcome?.id ||
    outcome?.receipts_outcome?.[0]?.id ||
    `tx_${Date.now()}`;

  return { success: true, txHash, tipId };
}

interface UserSuggestion {
  xHandle: string;
  displayName: string;
  nearAccountId?: string;
  isRegistered: boolean;
  avatarUrl?: string;
  verified: boolean;
}

const SUGGESTIONS = [
  "Check my balance",
  "Tip @expatq3 0.1 NEAR",
  "Price of NEAR",
  "Price of BTC",
  "Claim testnet tokens",
  "Invoice @acme $50 for Website Design",
  "Claim my tips",
];

const DEFAULT_WELCOME_MSG: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Welcome to Veil! I am your Autonomous Social Finance Copilot on NEAR.\n\nConnect your 𝕏 account to begin sending tips, generating PayLinks, and claiming payouts with non-custodial delegated session keys.\n\nClick 'Connect 𝕏' in the header to get started!",
  createdAt: new Date(),
};

export function ChatContainer() {
  const { user, isLoggedIn, nearBalance, nearTokens, balanceUsd, evmBalance, spendingLimitUsd, spentUsd, refreshAccountData } = useAuth();
  const currentHandle = user?.xHandle || "guest";
  const userAvatar = user?.avatarUrl || (user?.xHandle ? `https://unavatar.io/twitter/${user.xHandle}` : undefined);
  const STORAGE_KEY = `Veil_chat_history_${currentHandle}`;

  const welcomeContent = user
    ? `Welcome back, @${user.xHandle}. Veil Autonomous Finance Copilot on NEAR.\n\nYour personal wallet is ${user.nearAccountId}.\n\nI can execute instant tips to any X handle via your delegated session key, generate cross-chain PayLinks, and claim your incoming payouts automatically.\n\nWhat would you like to do today?`
    : `Welcome to Veil. Autonomous Social Finance Copilot on NEAR.\n\nConnect your X account to begin sending tips, generating PayLinks, and managing assets with non-custodial delegated session keys.\n\nClick "Connect X" in the header to get started.`;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome_initial",
      role: "assistant",
      content: welcomeContent,
      createdAt: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Precision Recipient Suggestions State
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const activeSearchQueryRef = useRef<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Unclaimed Escrow Tips state for active user
  const [pendingTipsCount, setPendingTipsCount] = useState<number>(0);
  const [pendingTipsTotal, setPendingTipsTotal] = useState<number>(0);
  const [drawerTransactions, setDrawerTransactions] = useState<TransactionRecord[]>([]);

  // Real-Time Oracle Market Prices
  const [oraclePrices, setOraclePrices] = useState({ near: 3.70, eth: 2240.0 });

  useEffect(() => {
    fetch("/api/prices?symbols=NEAR,ETH")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setOraclePrices({
            near: d.nearPrice || 3.70,
            eth: d.ethPrice || 2240.0,
          });
        }
      })
      .catch(() => {});
  }, []);
  const [isShielded, setIsShielded] = useState<boolean>(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState<boolean>(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);

  // Sync Shielded Mode preference from global header
  useEffect(() => {
    try {
      const saved = localStorage.getItem("Veil_shielded_mode");
      if (saved === "true") setIsShielded(true);
    } catch {}

    const handlePrivacyChange = (e: any) => {
      if (e?.detail?.isShielded !== undefined) {
        setIsShielded(Boolean(e.detail.isShielded));
      }
    };
    window.addEventListener("Veil_privacy_mode_changed", handlePrivacyChange);
    return () => window.removeEventListener("Veil_privacy_mode_changed", handlePrivacyChange);
  }, []);

  useEffect(() => {
    const fetchDrawerTxs = () => {
      if (user?.xHandle) {
        fetch(`/api/transactions?handle=${encodeURIComponent(user.xHandle)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.transactions && Array.isArray(data.transactions)) {
              setDrawerTransactions(
                data.transactions.map((t: any) => ({
                  id: t._id || t.id,
                  type: t.type || "tip_sent",
                  title: t.memo || (t.isInflow ? `Received from ${t.counterparty}` : `Sent to ${t.counterparty}`),
                  counterparty: t.counterparty,
                  amountUsd: Number(t.amountUsd) || 0,
                  asset: t.asset || "NEAR",
                  status: t.status,
                  statusLabel: !t.isInflow ? "Sent" : (t.status === "escrow_pending" ? "Ready to Claim" : "Claimed"),
                  txHash: t.txHash,
                  timestamp: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "Recently",
                  isInflow: Boolean(t.isInflow),
                }))
              );
            }
          })
          .catch(() => {});
      } else {
        setDrawerTransactions([]);
      }
    };

    fetchDrawerTxs();
    if (typeof window !== "undefined") {
      window.addEventListener("Veil_activity_updated", fetchDrawerTxs);
      return () => window.removeEventListener("Veil_activity_updated", fetchDrawerTxs);
    }
  }, [user?.xHandle]);

  // Check for unclaimed escrow tips whenever the authenticated handle changes
  useEffect(() => {
    if (currentHandle && currentHandle !== "guest") {
      fetch(`/api/near/pending-tips?handle=${encodeURIComponent(currentHandle)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.count > 0) {
            setPendingTipsCount(data.count);
            setPendingTipsTotal(data.totalNear || 0);
          } else {
            setPendingTipsCount(0);
            setPendingTipsTotal(0);
          }
        })
        .catch(() => {});
    } else {
      setPendingTipsCount(0);
      setPendingTipsTotal(0);
    }
  }, [currentHandle]);

  // 1. Rehydrate chat history from localStorage and MongoDB on mount/handle change
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to load local chat history", e);
    }

    // Fetch from MongoDB Atlas
    if (currentHandle && currentHandle !== "guest") {
      fetch(`/api/chat/history?handle=${encodeURIComponent(currentHandle)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages((prev) => {
              // Only replace if local state has only the initial welcome message
              if (prev.length <= 1) {
                const cloudMsgs: ChatMessage[] = data.messages.map((m: any) => ({
                  id: m.id || m._id || `db_${Math.random()}`,
                  role: m.role,
                  content: m.content,
                  actionCard: m.actionCard,
                  createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
                }));
                const merged = [
                  {
                    id: "welcome_initial",
                    role: "assistant" as const,
                    content: welcomeContent,
                    createdAt: new Date(),
                  },
                  ...cloudMsgs,
                ];
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                } catch {}
                return merged;
              }
              return prev;
            });
          }
        })
        .catch((err) => console.warn("Failed to fetch MongoDB chat history:", err));
    }
  }, [currentHandle, STORAGE_KEY, welcomeContent]);

  // 2. Unified Message Persistence: appends message to local storage AND database
  const appendMessage = (msg: ChatMessage) => {
    setMessages((prev) => {
      const updated = [...prev, msg];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn("localStorage quota exceeded", e);
      }
      return updated;
    });

    // Fire and forget to MongoDB Atlas
    if (msg.id !== "welcome_initial" && msg.id !== "welcome") {
      fetch("/api/chat/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userHandle: currentHandle,
          role: msg.role,
          content: msg.content,
          actionCard: msg.actionCard,
        }),
      }).catch((e) => console.warn("MongoDB history sync failed:", e));
    }
  };

  // 3. Update existing message in place and immediately persist changes
  const updateExistingMessage = (
    messageId: string,
    updater: (prevMsg: ChatMessage) => ChatMessage
  ) => {
    setMessages((prev) => {
      const updated = prev.map((m) => (m.id === messageId ? updater(m) : m));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to update localStorage:", e);
      }
      return updated;
    });
  };

  const handleClearChat = async () => {
    setIsClearModalOpen(true);
  };

  const confirmClearChat = async () => {
    setMessages([
      {
        id: "welcome_initial",
        role: "assistant",
        content: welcomeContent,
        createdAt: new Date(),
      },
    ]);
    localStorage.removeItem(STORAGE_KEY);
    try {
      await fetch(`/api/chat/history?handle=${currentHandle}`, { method: "DELETE" });
    } catch (e) {
      console.warn("Failed to delete MongoDB history", e);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursor = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);

    if (match) {
      const q = match[1];
      setMentionQuery(q);
      activeSearchQueryRef.current = q;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/user/search?q=${encodeURIComponent(q)}`, {
            signal: controller.signal,
          });
          if (res.ok) {
            const data = await res.json();
            // Verify active query still matches
            if (activeSearchQueryRef.current === q && Array.isArray(data.users)) {
              // Strictly ensure every item starts with or matches what user typed
              const filtered = data.users.filter((u: UserSuggestion) =>
                u.xHandle.toLowerCase().startsWith(q.toLowerCase())
              );
              filtered.sort((a: UserSuggestion, b: UserSuggestion) => {
                if (a.xHandle.toLowerCase() === q.toLowerCase()) return -1;
                if (b.xHandle.toLowerCase() === q.toLowerCase()) return 1;
                return 0;
              });
              setSuggestions(filtered);
              setSelectedSuggestionIndex(0);
            }
          }
        } catch (err: any) {
          if (err.name !== "AbortError") {
            console.warn("User search error:", err);
          }
        }
      }, 120);
    } else {
      setMentionQuery(null);
      setSuggestions([]);
      activeSearchQueryRef.current = "";
    }
  };

  const handleSelectSuggestion = (user: UserSuggestion) => {
    const cursor = inputRef.current?.selectionStart ?? input.length;
    const textBefore = input.slice(0, cursor);
    const textAfter = input.slice(cursor);
    const replacedBefore = textBefore.replace(/@([a-zA-Z0-9_]*)$/, `@${user.xHandle} `);
    const updated = replacedBefore + textAfter;

    setInput(updated);
    setMentionQuery(null);
    setSuggestions([]);
    activeSearchQueryRef.current = "";

    setTimeout(() => {
      inputRef.current?.focus();
      const newPos = replacedBefore.length;
      inputRef.current?.setSelectionRange(newPos, newPos);
    }, 15);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionQuery !== null && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (suggestions[selectedSuggestionIndex]) {
          e.preventDefault();
          handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        setSuggestions([]);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleConfirmTip = async (messageId: string, tipData: Record<string, any>) => {
    // 1. Mark message as broadcasting
    updateExistingMessage(messageId, (msg) => ({
      ...msg,
      actionCard: msg.actionCard
        ? {
            ...msg.actionCard,
            data: { ...msg.actionCard.data, isBroadcasting: true },
          }
        : undefined,
    }));

    const radarSpendLabel = tipData.conversionExplanation
      ? `Authorized via NEAR Session Key: ${tipData.conversionExplanation}`
      : `Authorized via NEAR Session Key (${tipData.amount} ${tipData.asset})`;

    try {
      const activeSession = getStoredAgentSession(user?.xHandle);
      if (activeSession?.isFrozen) {
        throw new Error("Emergency Freeze Active: All autonomous agent transactions are blocked by emergency safety controls.");
      }
      let clientTxHash = "";
      let effectiveSenderWallet = user?.nearAccountId || "anonymous.testnet";
      const cleanRecipientHandle = (tipData.recipientHandle || "").replace("@", "").trim();

      // Check recipient registration status:
      // If recipient is registered: keep direct transfer.
      // If recipient is unregistered: call contract deposit_near_tip(tip_id, recipient_handle) on Veil-agent.testnet.
      let isRecipientRegistered = Boolean(tipData.isRegistered);
      let recipientWallet = tipData.recipientWallet;

      if (tipData.isRegistered === undefined) {
        if (cleanRecipientHandle.includes(".") || cleanRecipientHandle.endsWith(".testnet") || cleanRecipientHandle.endsWith(".near")) {
          isRecipientRegistered = true;
          recipientWallet = cleanRecipientHandle;
        } else {
          try {
            const userRes = await fetch(`/api/user?handle=${encodeURIComponent(cleanRecipientHandle)}`);
            if (userRes.ok) {
              const userData = await userRes.json();
              if (userData?.exists && userData?.user?.nearAccountId) {
                isRecipientRegistered = true;
                recipientWallet = userData.user.nearAccountId;
              }
            }
          } catch (regErr) {
            console.warn("[ChatContainer] Recipient registration check warning:", regErr);
          }
        }
      }

      const escrowContract = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || "Veil-agent.testnet";
      const tipId = tipData.tipId || `tip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const isEvmTip = ["USDC", "ETH", "USDT"].includes((tipData.asset || "").toUpperCase()) ||
        Boolean(tipData.isEvmTransfer);

      if (isEvmTip) {
        // Direct EVM Transfer on Base Sepolia via NEAR MPC Chain Signatures
        const targetRecipAccount = recipientWallet || (cleanRecipientHandle.includes(".") ? cleanRecipientHandle : sanitizeNearAccountId(cleanRecipientHandle));
        const recipientEvmAddress = tipData.recipientAddress || deriveEvmAddress(targetRecipAccount).checksumAddress;

        let mpcTxHash = "";
        if (activeSession?.secretKey && user?.nearAccountId) {
          const mpcResult = await signAndBroadcastMpcEvmTransfer({
            senderAccountId: user.nearAccountId,
            senderSecretKey: activeSession.secretKey,
            recipientAddress: recipientEvmAddress,
            asset: (tipData.asset || "USDC").toUpperCase(),
            amount: tipData.amount,
            chain: tipData.chain || "base",
            chainId: tipData.chainId,
          });
          mpcTxHash = mpcResult.txHash;
        } else {
          const mpcRes = await fetch("/api/evm/send-mpc", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              senderNearAccountId: user?.nearAccountId,
              recipientAddress: recipientEvmAddress,
              asset: tipData.asset || "USDC",
              amount: tipData.amount,
              chain: tipData.chain || "base",
              chainId: tipData.chainId,
            }),
          });
          const mpcData = await mpcRes.json();
          if (!mpcRes.ok || !mpcData.txHash) {
            throw new Error(mpcData.error || "Failed to execute EVM transfer on Base Sepolia. Check balance or spending limit.");
          }
          mpcTxHash = mpcData.txHash;
        }
        clientTxHash = mpcTxHash;
      } else if (activeSession?.secretKey && user?.nearAccountId) {
        if (isRecipientRegistered) {
          // 2a. Direct Transfer for Registered Users
          const cleanRecip = recipientWallet || (cleanRecipientHandle.includes(".") ? cleanRecipientHandle : sanitizeNearAccountId(cleanRecipientHandle));
          try {
            const signRes = await signAndBroadcastNearTransfer({
              senderAccountId: effectiveSenderWallet,
              senderSecretKey: activeSession.secretKey,
              receiverId: cleanRecip,
              amountNear: Number(tipData.amount),
            });
            clientTxHash = signRes.txHash;
          } catch (firstErr: any) {
            console.warn("[ChatContainer] First client-side tip signing attempt notice:", firstErr.message);

            // If signing failed due to key authorization or missing subaccount, trigger instant auto-healing
            if (activeSession.publicKey) {
              try {
                console.log("[ChatContainer] Auto-healing subaccount key authorization via /api/user...");
                const healRes = await fetch("/api/user", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    xHandle: user.xHandle,
                    nearAccountId: effectiveSenderWallet,
                    publicKey: activeSession.publicKey,
                    spendingLimitUsd: activeSession.spendingLimitUsd || 50.0,
                  }),
                });
                if (healRes.ok) {
                  const healData = await healRes.json();
                  if (healData?.user?.nearAccountId) {
                    effectiveSenderWallet = healData.user.nearAccountId;
                    activeSession.accountId = effectiveSenderWallet;
                    saveAgentSession(activeSession, user.xHandle);
                    const updatedUser = { ...user, nearAccountId: effectiveSenderWallet };
                    localStorage.setItem("Veil_auth_user_v1", JSON.stringify(updatedUser));

                    // Retry signing with freshly verified on-chain subaccount
                    const retryRes = await signAndBroadcastNearTransfer({
                      senderAccountId: effectiveSenderWallet,
                      senderSecretKey: activeSession.secretKey,
                      receiverId: cleanRecip,
                      amountNear: Number(tipData.amount),
                    });
                    clientTxHash = retryRes.txHash;
                  }
                }
              } catch (healErr: any) {
                console.warn("[ChatContainer] Auto-healing retry notice:", healErr.message);
              }
            }

            if (!clientTxHash) {
              throw new Error(`Personal wallet signing failed: ${firstErr.message}. Ensure your wallet is funded with testnet NEAR.`);
            }
          }
        } else {
          // 2b. Escrow Contract Deposit for Unregistered Users:
          // Calls deposit_near_tip(tip_id, recipient_handle) on Veil-agent.testnet with attached deposit
          try {
            const escrowRes = await signAndBroadcastEscrowDeposit({
              senderAccountId: effectiveSenderWallet,
              senderSecretKey: activeSession.secretKey,
              tipId,
              recipientHandle: cleanRecipientHandle,
              amountNear: Number(tipData.amount),
              contractId: escrowContract,
            });
            clientTxHash = escrowRes.txHash;
          } catch (firstErr: any) {
            console.warn("[ChatContainer] Escrow deposit signing attempt notice:", firstErr.message);

            // Auto-healing for escrow deposit
            if (activeSession.publicKey) {
              try {
                console.log("[ChatContainer] Auto-healing subaccount key authorization for escrow...");
                const healRes = await fetch("/api/user", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    xHandle: user.xHandle,
                    nearAccountId: effectiveSenderWallet,
                    publicKey: activeSession.publicKey,
                    spendingLimitUsd: activeSession.spendingLimitUsd || 50.0,
                  }),
                });
                if (healRes.ok) {
                  const healData = await healRes.json();
                  if (healData?.user?.nearAccountId) {
                    effectiveSenderWallet = healData.user.nearAccountId;
                    activeSession.accountId = effectiveSenderWallet;
                    saveAgentSession(activeSession, user.xHandle);
                    const updatedUser = { ...user, nearAccountId: effectiveSenderWallet };
                    localStorage.setItem("Veil_auth_user_v1", JSON.stringify(updatedUser));

                    const retryRes = await signAndBroadcastEscrowDeposit({
                      senderAccountId: effectiveSenderWallet,
                      senderSecretKey: activeSession.secretKey,
                      tipId,
                      recipientHandle: cleanRecipientHandle,
                      amountNear: Number(tipData.amount),
                      contractId: escrowContract,
                    });
                    clientTxHash = retryRes.txHash;
                  }
                }
              } catch (healErr: any) {
                console.warn("[ChatContainer] Escrow auto-healing retry notice:", healErr.message);
              }
            }

            if (!clientTxHash) {
              throw new Error(`Escrow deposit failed: ${firstErr.message}. Ensure your wallet is funded with testnet NEAR.`);
            }
          }
        }
      }

      if (!clientTxHash) {
        throw new Error("Personal wallet signing is required for tip authorization. Please reconnect or claim testnet NEAR from the faucet.");
      }

      const res = await fetch("/api/near/send-tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientHandle: cleanRecipientHandle,
          amount: tipData.amount,
          asset: tipData.asset,
          senderHandle: isShielded ? "shielded_patron" : (user?.xHandle || "anonymous"),
          senderWallet: effectiveSenderWallet,
          txHash: clientTxHash,
          isShielded: isShielded,
          isDirectTransfer: isRecipientRegistered,
          tipId: isRecipientRegistered ? undefined : tipId,
        }),
      });
      const onchainData = await res.json();
      if (!res.ok) {
        throw new Error(onchainData.error || "Failed to broadcast tip");
      }
      const realTxHash = onchainData.txHash || clientTxHash;

      // Deduct tip from autonomous spending authority cap
      const tipUsd = Number(tipData.usdEquivalent) || Number((tipData.amount * oraclePrices.near).toFixed(2)) || Number(tipData.amount) || 0.04;
      recordAgentSpend(tipUsd, user?.xHandle, true);

      // Refresh on-chain wallet balance and spending cap immediately
      await refreshAccountData();

      // Record in client-side transaction store
      addTransactionRecord({
        type: isRecipientRegistered ? "direct_deposit" : "tip_sent",
        title: isRecipientRegistered ? `Direct Tip to @${cleanRecipientHandle}` : `Escrow Tip to @${cleanRecipientHandle}`,
        counterparty: `@${cleanRecipientHandle}`,
        amountUsd: tipUsd,
        asset: tipData.asset,
        status: isRecipientRegistered ? "completed" : "escrow_pending",
        statusLabel: isRecipientRegistered ? "Direct Transfer Sent" : "Deposited to Escrow",
        txHash: realTxHash,
        isInflow: false,
        memo: isRecipientRegistered
          ? `Sent ${tipData.amount} ${tipData.asset} directly to @${cleanRecipientHandle}`
          : `Deposited ${tipData.amount} ${tipData.asset} into Veil Escrow (${escrowContract}) for @${cleanRecipientHandle}`,
      }, user?.xHandle);

      // Dispatch global activity event for instant UI update
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("Veil_activity_updated"));
        try {
          confetti({ particleCount: 75, spread: 65, origin: { y: 0.65 } });
        } catch {}
      }

      const activeCap = getStoredAgentSession(user?.xHandle);
      const remainingToday = activeCap ? Math.max(0, activeCap.spendingLimitUsd - activeCap.spentUsd) : 50;

      // Generate Cryptographic Selective Disclosure Proof for Tip
      let tipProofUrl = "";
      try {
        const pRes = await fetch("/api/proofs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientClaim: `@${cleanRecipientHandle}`,
            amountClaim: `${tipData.amount} ${tipData.asset}`,
            usdValueClaim: tipUsd,
            asset: tipData.asset,
            network: "NEAR Protocol",
            factType: isRecipientRegistered ? "TIP_DELIVERED" : "ESCROW_DEPOSITED",
            senderSecret: user?.nearAccountId || "confidential_patron",
          }),
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.success && pData.proof) {
            tipProofUrl = pData.verificationUrl;
          }
        }
      } catch (pErr) {
        console.warn("Could not generate tip proof attestation:", pErr);
      }

      // Update message to settled tip with StatusRadar & Proof
      const finalMsgContent = isRecipientRegistered
        ? `✓ Confirmed & Sent${isShielded ? " (Shielded Mode)" : ""}! Successfully sent ${tipData.amount} ${tipData.asset} (~$${tipUsd.toFixed(2)}) directly to @${cleanRecipientHandle}.${isShielded ? " Sender identity blinded on-chain." : ""}\nSession Spending Cap: $${remainingToday.toFixed(2)} remaining today.${tipProofUrl ? `\n\n🔒 **Selective Disclosure Proof**: [View & Share Proof on 𝕏](${tipProofUrl}) *(Net worth & wallet address protected)*` : ""}`
        : `🔒 Escrow Deposit Confirmed${isShielded ? " (Shielded Mode)" : ""}! Safely deposited ${tipData.amount} ${tipData.asset} (~$${tipUsd.toFixed(2)}) into on-chain escrow (\`${escrowContract}\`) for @${cleanRecipientHandle}.\nRecipient @${cleanRecipientHandle} is unregistered. Funds are locked in escrow and ready for @${cleanRecipientHandle} to claim upon connecting their 𝕏 account.${isShielded ? " Sender identity blinded on-chain." : ""}\nSession Spending Cap: $${remainingToday.toFixed(2)} remaining today.${tipProofUrl ? `\n\n🔒 **Selective Disclosure Proof**: [View & Share Proof on 𝕏](${tipProofUrl}) *(Net worth & wallet address protected)*` : ""}`;

      updateExistingMessage(messageId, (msg) => ({
        ...msg,
        content: finalMsgContent,
        actionCard: {
          type: "tip",
          data: {
            ...tipData,
            tipId: isRecipientRegistered ? undefined : tipId,
            txHash: realTxHash,
            isBroadcasting: false,
            proofUrl: tipProofUrl,
            isDirectTransfer: isRecipientRegistered,
            isEscrow: !isRecipientRegistered,
          },
          radar: isRecipientRegistered
            ? [
                { id: "1", label: radarSpendLabel, status: "completed" },
                {
                  id: "2",
                  label: "Direct Transfer Confirmed on NEAR Testnet",
                  status: "completed",
                  txHash: realTxHash,
                  chain: "near",
                },
                { id: "3", label: `Delivered directly to @${cleanRecipientHandle}`, status: "completed" },
              ]
            : [
                { id: "1", label: radarSpendLabel, status: "completed" },
                {
                  id: "2",
                  label: `Locked in Escrow Contract (${escrowContract})`,
                  status: "completed",
                  txHash: realTxHash,
                  chain: "near",
                },
                { id: "3", label: `Escrow Ready to Claim for @${cleanRecipientHandle}`, status: "completed" },
              ],
        },
      }));
    } catch (err: any) {
      console.error("Tip confirmation error:", err);
      const friendlyError = formatHumanFriendlyError(err);
      updateExistingMessage(messageId, (msg) => ({
        ...msg,
        content: `Failed to broadcast tip: ${friendlyError}`,
        actionCard: msg.actionCard
          ? {
              ...msg.actionCard,
              data: { ...msg.actionCard.data, isBroadcasting: false },
            }
          : undefined,
      }));
    }
  };

  const handleConfirmDirectTransfer = async (messageId: string, transferData: Record<string, any>) => {
    if (!user) return;

    updateExistingMessage(messageId, (msg) => ({
      ...msg,
      actionCard: msg.actionCard
        ? {
            ...msg.actionCard,
            data: { ...msg.actionCard.data, isBroadcasting: true },
          }
        : undefined,
    }));

    try {
      const activeSession = getStoredAgentSession(user?.xHandle);
      if (activeSession?.isFrozen) {
        throw new Error("Emergency Freeze Active: All autonomous agent transactions are blocked by emergency safety controls.");
      }
      const selectedChain = (transferData.chain || "near").toLowerCase();
      const isNearChain = selectedChain === "near";
      const isEvmTransfer = !isNearChain && (
        Boolean(transferData.isEvmTransfer) ||
        Boolean(transferData.isCrossChain) ||
        (transferData.recipientAddress && transferData.recipientAddress.startsWith("0x")) ||
        ["USDC", "ETH", "USDT"].includes((transferData.asset || "").toUpperCase())
      );

      let realTxHash = "";
      let transferUsd = Number(transferData.usdEquivalent) || 0;

      if (isEvmTransfer) {
        // Direct EVM Transfer on Base Sepolia via Non-Custodial NEAR MPC Chain Signatures
        let mpcTxHash = "";
        if (activeSession?.secretKey && user?.nearAccountId) {
          const mpcResult = await signAndBroadcastMpcEvmTransfer({
            senderAccountId: user.nearAccountId,
            senderSecretKey: activeSession.secretKey,
            recipientAddress: transferData.recipientAddress,
            asset: (transferData.asset || "USDC").toUpperCase(),
            amount: transferData.amount,
            chain: transferData.chain || "base",
            chainId: transferData.chainId,
          });
          mpcTxHash = mpcResult.txHash;
        } else {
          // Fallback to server route if session key is not stored locally
          const mpcRes = await fetch("/api/evm/send-mpc", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              senderNearAccountId: user?.nearAccountId,
              recipientAddress: transferData.recipientAddress,
              asset: transferData.asset || "USDC",
              amount: transferData.amount,
              chain: transferData.chain || "base",
              chainId: transferData.chainId,
            }),
          });

          const mpcData = await mpcRes.json();
          if (!mpcRes.ok || !mpcData.txHash) {
            throw new Error(mpcData.error || "Failed to execute EVM transfer on Base Sepolia. Check balance or spending limit.");
          }
          mpcTxHash = mpcData.txHash;
        }

        realTxHash = mpcTxHash;
        transferUsd = (transferData.asset || "").toUpperCase() === "ETH"
          ? Number(transferData.amount) * (oraclePrices.eth || 2240)
          : Number(transferData.amount);

        recordAgentSpend(transferUsd, user?.xHandle, true);
        await refreshAccountData();

        addTransactionRecord({
          type: "cross_chain_swap",
          title: `Direct Base Transfer to ${transferData.recipientAddress.slice(0, 8)}...`,
          counterparty: transferData.recipientAddress,
          amountUsd: transferUsd,
          asset: transferData.asset || "USDC",
          status: "completed",
          statusLabel: "Sent via Base Sepolia",
          txHash: realTxHash,
          isInflow: false,
          memo: `Sent ${transferData.amount} ${transferData.asset} directly to ${transferData.recipientAddress} on Base Sepolia`,
        }, user?.xHandle);

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("Veil_activity_updated"));
          try {
            confetti({ particleCount: 75, spread: 65, origin: { y: 0.65 } });
          } catch {}
        }

        const activeCap = getStoredAgentSession(user?.xHandle);
        const remainingToday = activeCap ? Math.max(0, activeCap.spendingLimitUsd - activeCap.spentUsd) : 50;

        const targetChain = (transferData.chain || "base").toLowerCase();
        const explorerBase = targetChain.includes("arb")
          ? "https://sepolia.arbiscan.io"
          : targetChain.includes("eth")
          ? "https://sepolia.etherscan.io"
          : "https://sepolia.basescan.org";
        const explorerName = targetChain.includes("arb")
          ? "Arbiscan"
          : targetChain.includes("eth")
          ? "Etherscan"
          : "Basescan";

        updateExistingMessage(messageId, (msg) => ({
          ...msg,
          content: `✓ Direct EVM Transfer Confirmed! Sent ${transferData.amount} ${transferData.asset} (~$${transferUsd.toFixed(2)}) directly to \`${transferData.recipientAddress}\` on ${(transferData.chain || "Base").toUpperCase()} Sepolia.\n\n**Transaction Hash:** \`${realTxHash}\`\n[View on ${explorerName}](${explorerBase}/tx/${realTxHash})\n\nSession Spending Cap: $${remainingToday.toFixed(2)} remaining today.`,
          actionCard: {
            type: "tip",
            data: { ...transferData, txHash: realTxHash, destinationTxHash: realTxHash, targetChain: (transferData.chain || "BASE").toUpperCase(), isBroadcasting: false },
            radar: [
              { id: "1", label: `Authorized via NEAR MPC Key (${transferData.amount} ${transferData.asset})`, status: "completed" },
              { id: "2", label: `Direct On-Chain Transfer (${(transferData.chain || "Base").toUpperCase()} Sepolia)`, status: "completed", txHash: realTxHash, chain: targetChain },
              { id: "3", label: `Delivered to ${transferData.recipientAddress}`, status: "completed" },
            ],
          },
        }));
        return;
      }

      // Native NEAR Transfer
      let clientTxHash = "";
      if (activeSession?.secretKey && user?.nearAccountId) {
        try {
          const signRes = await signAndBroadcastNearTransfer({
            senderAccountId: user.nearAccountId,
            senderSecretKey: activeSession.secretKey,
            receiverId: transferData.recipientAddress.trim().toLowerCase(),
            amountNear: Number(transferData.amount),
            asset: transferData.asset || "NEAR",
          });
          clientTxHash = signRes.txHash;
        } catch (e: any) {
          console.warn("[ChatContainer] Client-side direct transfer signing fallback:", e.message);
        }
      }

      const res = await fetch("/api/near/send-tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientHandle: transferData.recipientAddress,
          amount: transferData.amount,
          asset: transferData.asset || "NEAR",
          senderHandle: user.xHandle,
          senderWallet: user.nearAccountId,
          senderPrivateKey: clientTxHash ? undefined : activeSession?.secretKey,
          txHash: clientTxHash || undefined,
          isDirectTransfer: true,
        }),
      });

      const onchainData = await res.json();
      if (!res.ok) {
        throw new Error(onchainData.error || "Failed to broadcast direct transfer");
      }

      realTxHash = onchainData.txHash || `tx_${Date.now()}`;
      transferUsd = Number(transferData.usdEquivalent) || Number((transferData.amount * oraclePrices.near).toFixed(2)) || 0.04;

      recordAgentSpend(transferUsd, user?.xHandle, true);
      await refreshAccountData();

      addTransactionRecord({
        type: "direct_deposit",
        title: `Direct Transfer to ${transferData.recipientAddress}`,
        counterparty: transferData.recipientAddress,
        amountUsd: transferUsd,
        asset: transferData.asset || "NEAR",
        status: "completed",
        statusLabel: "Direct Transfer Sent",
        txHash: realTxHash,
        isInflow: false,
        memo: `Sent ${transferData.amount} ${transferData.asset} directly to ${transferData.recipientAddress}`,
      }, user?.xHandle);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("Veil_activity_updated"));
        try {
          confetti({ particleCount: 75, spread: 65, origin: { y: 0.65 } });
        } catch {}
      }

      const activeCap = getStoredAgentSession(user?.xHandle);
      const remainingToday = activeCap ? Math.max(0, activeCap.spendingLimitUsd - activeCap.spentUsd) : 50;

      updateExistingMessage(messageId, (msg) => ({
        ...msg,
        content: `✓ Direct Transfer Confirmed! Sent ${transferData.amount} ${transferData.asset} (~$${transferUsd.toFixed(2)}) directly to \`${transferData.recipientAddress}\`.\nNo escrow lock required.\nSession Spending Cap: $${remainingToday.toFixed(2)} remaining today.`,
        actionCard: {
          type: "tip",
          data: { ...transferData, txHash: realTxHash, isBroadcasting: false },
          radar: [
            { id: "1", label: `Authorized via NEAR Session Key (${transferData.amount} ${transferData.asset})`, status: "completed" },
            { id: "2", label: `Direct On-Chain Transfer (NEAR Testnet)`, status: "completed", txHash: realTxHash, chain: "near" },
            { id: "3", label: `Delivered to ${transferData.recipientAddress}`, status: "completed" },
          ],
        },
      }));
    } catch (err: any) {
      console.error("Direct transfer confirmation error:", err);
      const friendlyError = formatHumanFriendlyError(err);
      updateExistingMessage(messageId, (msg) => ({
        ...msg,
        content: `Direct transfer failed: ${friendlyError}`,
        actionCard: msg.actionCard ? { ...msg.actionCard, data: { ...msg.actionCard.data, isBroadcasting: false } } : undefined,
      }));
    }
  };

  const handleExecuteIntent = async (messageId: string, intentData: Record<string, any>) => {
    if (!user) return;

    // 1. Mark as executing in UI with active radar
    const isDirectEvm = Boolean(intentData.isDirectEvm);
    const isMainnet = process.env.NEXT_PUBLIC_NEAR_NETWORK_ID === "mainnet";

    updateExistingMessage(messageId, (msg) => ({
      ...msg,
      actionCard: msg.actionCard
        ? {
            ...msg.actionCard,
            data: { ...msg.actionCard.data, isExecuting: true },
            radar: isDirectEvm
              ? [
                  { id: "1", label: `Base Sepolia Account Authorized (${intentData.sourceAmount} ${intentData.sourceAsset})`, status: "completed" },
                  { id: "2", label: `Signing via NEAR Chain Signatures MPC (v1.signer-prod)`, status: "processing" },
                  { id: "3", label: `Broadcasting on ${intentData.targetChain} to ${intentData.recipientHandle ? `@${intentData.recipientHandle}` : intentData.recipient}`, status: "pending" },
                ]
              : [
                  { id: "1", label: `NEAR Session Key Authorized & Locked (${intentData.sourceAmount} NEAR)`, status: "completed" },
                  { id: "2", label: `Routing through Defuse 1Click Solvers`, status: "processing" },
                  { id: "3", label: isMainnet
                      ? `Settlement on ${intentData.targetChain} to ${intentData.recipientHandle ? `@${intentData.recipientHandle}` : intentData.recipient}`
                      : `[ Testnet Demo — Simulated Swap ] Simulated Settlement on ${intentData.targetChain}`,
                    status: "pending",
                  },
                ],
          }
        : undefined,
    }));

    try {
      const activeSession = getStoredAgentSession(user?.xHandle);
      if (activeSession?.isFrozen) {
        throw new Error("Emergency Freeze Active: All autonomous agent transactions are blocked by emergency safety controls.");
      }
      const depositTarget = intentData.depositAddress || "solver.Veil-agent.testnet";

      let depositTxHash = "";
      let solverFillTxHash = "";

      if (isDirectEvm) {
        // Direct EVM Transfer via NEAR Chain Signatures MPC
        let targetEvmAddress = intentData.recipient;
        if (!targetEvmAddress || !targetEvmAddress.startsWith("0x")) {
          const cleanRecipientHandle = (intentData.recipientHandle || intentData.recipient || "").replace("@", "").trim();
          const recipientNearAccount = sanitizeNearAccountId(cleanRecipientHandle);
          targetEvmAddress = deriveEvmAddress(recipientNearAccount).checksumAddress;
        }

        const mpcRes = await fetch("/api/evm/send-mpc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderNearAccountId: user.nearAccountId,
            recipientAddress: targetEvmAddress,
            asset: intentData.targetAsset || "USDC",
            amount: intentData.targetAmount,
          }),
        });
        const mpcData = await mpcRes.json();
        if (!mpcRes.ok || !mpcData.txHash) {
          throw new Error(mpcData.error || "Failed to execute EVM transaction on Base Sepolia. Check your balance or spending cap.");
        }
        solverFillTxHash = mpcData.txHash;
        depositTxHash = mpcData.txHash;
      } else {
        // 2. Broadcast deposit transaction to solver single-use address on NEAR (client-side signed)
        let clientTxHash = "";
        if (activeSession?.secretKey && user?.nearAccountId) {
          try {
            const signRes = await signAndBroadcastNearTransfer({
              senderAccountId: user.nearAccountId,
              senderSecretKey: activeSession.secretKey,
              receiverId: depositTarget,
              amountNear: Number(intentData.sourceAmount),
            });
            clientTxHash = signRes.txHash;
          } catch (e: any) {
            console.warn("[ChatContainer] Client-side solver deposit signing fallback:", e.message);
          }
        }

        const res = await fetch("/api/near/send-tip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientHandle: depositTarget,
            amount: intentData.sourceAmount,
            asset: intentData.sourceAsset || "NEAR",
            senderHandle: user.xHandle,
            senderWallet: user.nearAccountId,
            senderPrivateKey: clientTxHash ? undefined : activeSession?.secretKey,
            txHash: clientTxHash || undefined,
            isDirectTransfer: true,
          }),
        });

        const onchainData = await res.json();
        if (!res.ok || !onchainData.txHash) {
          throw new Error(onchainData.error || "Failed to broadcast deposit to solver address on NEAR. Insufficient funds or session key issue.");
        }

        depositTxHash = onchainData.txHash;

        // In Testnet mode: Do NOT simply copy depositTxHash into solverFillTxHash and pretend it is settled!
        // In Mainnet mode: keep status as 'deposited' and poll pollIntentExecution() for up to 120s to capture real destinationTxHash.
        if (isMainnet) {
          // Status kept as deposited while polling
          updateExistingMessage(messageId, (msg) => ({
            ...msg,
            actionCard: msg.actionCard
              ? {
                  ...msg.actionCard,
                  data: {
                    ...msg.actionCard.data,
                    status: "deposited",
                    depositTxHash,
                  },
                  radar: [
                    { id: "1", label: `NEAR Session Key Authorized (${intentData.sourceAmount} NEAR)`, status: "completed" },
                    { id: "2", label: `Deposit Locked to 1Click Solver (${depositTarget.slice(0, 16)}...)`, status: "completed", txHash: depositTxHash, chain: "near" },
                    { id: "3", label: `Status: Deposited. Polling 1Click solver fill on ${intentData.targetChain}...`, status: "processing" },
                  ],
                }
              : undefined,
          }));

          if (intentData.orderId) {
            try {
              await fetch("/api/intents", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderId: intentData.orderId,
                  status: "deposited",
                  depositTxHash,
                }),
              });
            } catch (e) {
              console.warn("Could not patch intent status:", e);
            }
          }

          // Poll pollIntentExecution from 1click.ts for up to 120s
          const pollRes = await pollIntentExecution(depositTarget, 120000, 2500);
          if (pollRes.status === "SUCCESS" && pollRes.destinationTxHash) {
            solverFillTxHash = pollRes.destinationTxHash;
          } else if (pollRes.status === "REFUNDED") {
            throw new Error(`1Click order refunded by solver on-chain: ${pollRes.refundTxHash || "Refunded"}`);
          } else {
            console.log("[1Click] Mainnet solver polling timed out (120s). Intent status remains deposited.");
          }
        } else {
          // Testnet Demo mode: Do NOT copy depositTxHash into solverFillTxHash
          solverFillTxHash = "";
        }
      }

      // 3. Update radar
      updateExistingMessage(messageId, (msg) => ({
        ...msg,
        actionCard: msg.actionCard
          ? {
              ...msg.actionCard,
              radar: isDirectEvm
                ? [
                    { id: "1", label: `Base Sepolia Account Authorized (${intentData.sourceAmount} ${intentData.sourceAsset})`, status: "completed" },
                    { id: "2", label: `Signed via NEAR Chain Signatures MPC`, status: "completed", txHash: depositTxHash, chain: "evm" },
                    { id: "3", label: `Broadcasting on ${intentData.targetChain} to ${intentData.recipientHandle ? `@${intentData.recipientHandle}` : intentData.recipient}...`, status: "processing" },
                  ]
                : isMainnet
                ? [
                    { id: "1", label: `NEAR Session Key Authorized (${intentData.sourceAmount} NEAR)`, status: "completed" },
                    { id: "2", label: `Deposit Locked to 1Click Solver (${depositTarget.slice(0, 16)}...)`, status: "completed", txHash: depositTxHash, chain: "near" },
                    { id: "3", label: solverFillTxHash ? `Settled on ${intentData.targetChain}` : `Deposited — awaiting solver fill on ${intentData.targetChain}`, status: solverFillTxHash ? "completed" : "processing", txHash: solverFillTxHash || undefined, chain: "evm" },
                  ]
                : [
                    { id: "1", label: `NEAR Session Key Authorized (${intentData.sourceAmount} NEAR)`, status: "completed" },
                    { id: "2", label: `Deposit Locked to 1Click Solver (${depositTarget.slice(0, 16)}...)`, status: "completed", txHash: depositTxHash, chain: "near" },
                    { id: "3", label: `[ Testnet Demo — Simulated Swap ] Testnet demonstration swap completed`, status: "completed" },
                  ],
            }
          : undefined,
      }));

      // Update intent status in database if orderId exists
      if (intentData.orderId) {
        try {
          await fetch("/api/intents", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: intentData.orderId,
              status: isMainnet && !solverFillTxHash ? "deposited" : "success",
              depositTxHash,
              destinationTxHash: solverFillTxHash || undefined,
            }),
          });
        } catch (e) {
          console.warn("Could not patch intent status:", e);
        }
      }

      // 4. Financial accounting: Deduct spend, record transaction
      const transferUsd = Number(intentData.targetAmount) || Number((intentData.sourceAmount * oraclePrices.near).toFixed(2)) || 10;
      recordAgentSpend(transferUsd, user?.xHandle, true);
      await refreshAccountData();

      const recipientDisplayName = intentData.recipientHandle ? `@${intentData.recipientHandle}` : intentData.recipient;
      addTransactionRecord({
        type: "cross_chain_swap",
        title: !isDirectEvm && !isMainnet
          ? `[ Testnet Demo — Simulated Swap ] Intent to ${recipientDisplayName} (${intentData.targetChain})`
          : `Cross-Chain Intent to ${recipientDisplayName} (${intentData.targetChain})`,
        counterparty: recipientDisplayName,
        amountUsd: transferUsd,
        asset: intentData.targetAsset || "USDC",
        status: isMainnet && !solverFillTxHash && !isDirectEvm ? "escrow_pending" : "completed",
        statusLabel: !isDirectEvm && !isMainnet
          ? "Testnet demonstration swap completed"
          : (isMainnet && !solverFillTxHash && !isDirectEvm ? "Deposited" : "Intent Settled"),
        txHash: solverFillTxHash || depositTxHash,
        isInflow: false,
        memo: !isDirectEvm && !isMainnet
          ? `[ Testnet Demo — Simulated Swap ] Testnet demonstration swap completed. 1Click cross-chain swaps operate on Mainnet solver liquidity. Deposit on NEAR: ${depositTxHash}`
          : `Delivered ${intentData.targetAmount} ${intentData.targetAsset} on ${intentData.targetChain} via NEAR Intents 1Click Solvers`,
      }, user?.xHandle);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("Veil_activity_updated"));
        try {
          confetti({ particleCount: 85, spread: 70, origin: { y: 0.65 } });
        } catch {}
      }

      const activeCap = getStoredAgentSession(user?.xHandle);
      const remainingToday = activeCap ? Math.max(0, activeCap.spendingLimitUsd - activeCap.spentUsd) : 50;

      // 4.5. Generate Cryptographic Selective Disclosure Proof
      let proofUrl = "";
      try {
        const pRes = await fetch("/api/proofs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientClaim: recipientDisplayName,
            amountClaim: `${intentData.targetAmount} ${intentData.targetAsset}`,
            usdValueClaim: transferUsd,
            asset: intentData.targetAsset,
            network: intentData.targetChain,
            factType: "PAYMENT_CONFIRMED",
            senderSecret: user?.nearAccountId || "confidential_patron",
          }),
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.success && pData.proof) {
            proofUrl = pData.verificationUrl;
          }
        }
      } catch (pErr) {
        console.warn("Could not generate proof attestation:", pErr);
      }

      // 5. Final settled message with complete StatusRadar & Selective Disclosure Proof
      const depositDesc = isDirectEvm
        ? `${intentData.sourceAmount} ${intentData.sourceAsset}`
        : `${intentData.sourceAmount} NEAR (~$${transferUsd.toFixed(2)})`;

      const finalContent = isDirectEvm
        ? `⚡ Intent Order Successfully Settled!\nDelivered **${intentData.targetAmount} ${intentData.targetAsset} on ${intentData.targetChain}** to \`${recipientDisplayName}\` via NEAR Chain Signatures MPC.\nYour deposit: ${depositDesc}.\nRemaining daily spending cap: $${remainingToday.toFixed(2)}.${proofUrl ? `\n\n🔒 **Selective Disclosure Proof**: [View & Share Proof on 𝕏](${proofUrl}) *(Net worth & wallet address protected)*` : ""}`
        : isMainnet
        ? (solverFillTxHash
            ? `⚡ Intent Order Successfully Settled!\nDelivered **${intentData.targetAmount} ${intentData.targetAsset} on ${intentData.targetChain}** to \`${recipientDisplayName}\` via Defuse 1Click Solvers.\nYour deposit: ${depositDesc}.\nDeposit Tx: \`${depositTxHash}\`\nDestination Tx: \`${solverFillTxHash}\`\nRemaining daily spending cap: $${remainingToday.toFixed(2)}.${proofUrl ? `\n\n🔒 **Selective Disclosure Proof**: [View & Share Proof on 𝕏](${proofUrl}) *(Net worth & wallet address protected)*` : ""}`
            : `⚡ Intent Order Deposited!\nDeposit of ${depositDesc} confirmed on NEAR (\`${depositTxHash}\`). Solvers are executing settlement on ${intentData.targetChain} for \`${recipientDisplayName}\`.\nStatus: **deposited**.\nRemaining daily spending cap: $${remainingToday.toFixed(2)}.`)
        : `⚡ Intent Order [ Testnet Demo — Simulated Swap ]\nStatus: **Testnet demonstration swap completed**\n\n*Notice: Defuse 1Click cross-chain swaps operate on Mainnet solver liquidity. On Testnet, your deposit of ${depositDesc} was verified on-chain, and the destination settlement was simulated.*\n\nDelivered (Simulated): **${intentData.targetAmount} ${intentData.targetAsset} on ${intentData.targetChain}** to \`${recipientDisplayName}\`\nDeposit Tx: [${depositTxHash}](https://testnet.nearblocks.io/txns/${depositTxHash})\nRemaining daily spending cap: $${remainingToday.toFixed(2)}.${proofUrl ? `\n\n🔒 **Selective Disclosure Proof**: [View & Share Proof on 𝕏](${proofUrl}) *(Net worth & wallet address protected)*` : ""}`;

      updateExistingMessage(messageId, (msg) => ({
        ...msg,
        content: finalContent,
        actionCard: {
          type: "cross_chain_intent",
          data: {
            ...intentData,
            isExecuting: false,
            isSettled: !isMainnet || Boolean(solverFillTxHash) || isDirectEvm,
            status: isMainnet && !solverFillTxHash && !isDirectEvm ? "deposited" : "success",
            statusText: !isDirectEvm && !isMainnet ? "Testnet demonstration swap completed" : undefined,
            badge: !isDirectEvm && !isMainnet ? "[ Testnet Demo — Simulated Swap ]" : undefined,
            depositTxHash,
            destinationTxHash: solverFillTxHash || undefined,
            proofUrl,
          },
          radar: isDirectEvm
            ? [
                { id: "1", label: `Base Sepolia Account Authorized (${intentData.sourceAmount} ${intentData.sourceAsset})`, status: "completed" },
                { id: "2", label: `Signed via NEAR Chain Signatures MPC`, status: "completed", txHash: depositTxHash, chain: "evm" },
                { id: "3", label: `Delivered on ${intentData.targetChain} (${intentData.targetAmount} ${intentData.targetAsset})`, status: "completed", txHash: solverFillTxHash, chain: "evm" },
              ]
            : isMainnet
            ? [
                { id: "1", label: `NEAR Session Key Authorized (${intentData.sourceAmount} NEAR)`, status: "completed" },
                { id: "2", label: `1Click Solver Escrow Deposit Confirmed`, status: "completed", txHash: depositTxHash, chain: "near" },
                { id: "3", label: solverFillTxHash ? `Delivered on ${intentData.targetChain} (${intentData.targetAmount} ${intentData.targetAsset})` : `Status: Deposited. Polling fill on ${intentData.targetChain}...`, status: solverFillTxHash ? "completed" : "processing", txHash: solverFillTxHash || undefined, chain: "evm" },
              ]
            : [
                { id: "1", label: `NEAR Session Key Authorized (${intentData.sourceAmount} NEAR)`, status: "completed" },
                { id: "2", label: `1Click Solver Deposit Confirmed on NEAR`, status: "completed", txHash: depositTxHash, chain: "near" },
                { id: "3", label: `[ Testnet Demo — Simulated Swap ] Testnet demonstration swap completed`, status: "completed" },
              ],
        },
      }));
    } catch (err: any) {
      console.error("Execute intent error:", err);
      updateExistingMessage(messageId, (msg) => ({
        ...msg,
        content: `Intent execution failed: ${err.message || "Network error"}. Please check your balance and try again.`,
        actionCard: msg.actionCard
          ? {
              ...msg.actionCard,
              data: { ...msg.actionCard.data, isExecuting: false },
            }
          : undefined,
      }));
    }
  };

  const handlePayInvoice = async (messageId: string, invoiceData: Record<string, any>) => {
    if (!user) return;

    updateExistingMessage(messageId, (msg) => ({
      ...msg,
      actionCard: msg.actionCard
        ? {
            ...msg.actionCard,
            data: { ...msg.actionCard.data, isPaying: true },
          }
        : undefined,
    }));

    try {
      const activeSession = getStoredAgentSession(user?.xHandle);
      const numNear = (invoiceData.amountUsd / oraclePrices.near).toFixed(3);
      let clientTxHash = "";
      if (activeSession?.secretKey && user?.nearAccountId) {
        try {
          const signRes = await signAndBroadcastNearTransfer({
            senderAccountId: user.nearAccountId,
            senderSecretKey: activeSession.secretKey,
            receiverId: invoiceData.recipientNearAccount,
            amountNear: parseFloat(numNear),
          });
          clientTxHash = signRes.txHash;
        } catch (e: any) {
          console.warn("[ChatContainer] Client-side invoice payment signing fallback:", e.message);
        }
      }

      const res = await fetch("/api/near/send-tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientHandle: invoiceData.recipientNearAccount,
          amount: parseFloat(numNear),
          asset: "NEAR",
          senderHandle: user.xHandle,
          senderWallet: user.nearAccountId,
          senderPrivateKey: clientTxHash ? undefined : activeSession?.secretKey,
          txHash: clientTxHash || undefined,
          isDirectTransfer: true,
        }),
      });

      const onchainData = await res.json();
      if (!res.ok) {
        throw new Error(onchainData.error || "Failed to settle invoice on-chain");
      }

      const txHash = onchainData.txHash || `tx_${Date.now()}`;

      // Update invoice in MongoDB to settled
      await fetch("/api/paylinks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: invoiceData.slug,
          status: "settled",
          settledTx: txHash,
        }),
      }).catch(() => {});

      recordAgentSpend(invoiceData.amountUsd, user?.xHandle, true);
      await refreshAccountData();

      addTransactionRecord({
        type: "direct_deposit",
        title: `Paid Invoice: ${invoiceData.title || invoiceData.memo || invoiceData.slug}`,
        counterparty: invoiceData.recipientNearAccount,
        amountUsd: invoiceData.amountUsd,
        asset: "NEAR",
        status: "completed",
        statusLabel: "Invoice Paid",
        txHash,
        isInflow: false,
        memo: `Paid $${invoiceData.amountUsd.toFixed(2)} for ${invoiceData.slug} to ${invoiceData.recipientNearAccount}`,
      }, user?.xHandle);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("Veil_activity_updated"));
        try {
          confetti({ particleCount: 75, spread: 65, origin: { y: 0.65 } });
        } catch {}
      }

      const activeCap = getStoredAgentSession(user?.xHandle);
      const remainingToday = activeCap ? Math.max(0, activeCap.spendingLimitUsd - activeCap.spentUsd) : 50;

      updateExistingMessage(messageId, (msg) => ({
        ...msg,
        content: `✓ Invoice Settled! Successfully paid **$${invoiceData.amountUsd.toFixed(2)}** for \`${invoiceData.slug}\` to \`${invoiceData.recipientNearAccount}\`.\nSession Spending Cap: $${remainingToday.toFixed(2)} remaining today.`,
        actionCard: {
          type: "tip",
          data: { ...invoiceData, txHash, isBroadcasting: false },
          radar: [
            { id: "1", label: `Authorized via NEAR Session Key ($${invoiceData.amountUsd})`, status: "completed" },
            { id: "2", label: `Settled on NEAR Protocol (${txHash.slice(0, 8)}...)`, status: "completed", txHash, chain: "near" },
            { id: "3", label: `Invoice Marked Paid & Delivered`, status: "completed" },
          ],
        },
      }));
    } catch (err: any) {
      console.error("Invoice payment error:", err);
      updateExistingMessage(messageId, (msg) => ({
        ...msg,
        content: `Failed to settle invoice: ${err.message || "Network error"}.`,
        actionCard: msg.actionCard ? { ...msg.actionCard, data: { ...msg.actionCard.data, isPaying: false } } : undefined,
      }));
    }
  };

  const handleCancelTip = (messageId: string) => {
    updateExistingMessage(messageId, (msg) => ({
      ...msg,
      content: "✕ Tip action cancelled by user. No funds were moved.",
      actionCard: undefined,
    }));
  };

  const handleClaimFaucet = async (messageId: string, targetAccount?: string) => {
    const recipient = targetAccount || user?.nearAccountId;
    if (!recipient) return;

    // Set claiming state
    updateExistingMessage(messageId, (msg) => ({
      ...msg,
      actionCard: msg.actionCard
        ? {
            ...msg.actionCard,
            data: { ...msg.actionCard.data, isClaiming: true },
          }
        : undefined,
    }));

    try {
      const activeSession = getStoredAgentSession();
      const res = await fetch("/api/near/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: recipient,
          publicKey: activeSession?.publicKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Faucet claim failed");
      }

      // Refresh balance in AuthContext
      await refreshAccountData();

      const finalAccount = data.targetAccount || recipient;

      // Add to transaction records
      addTransactionRecord({
        type: "faucet_claim",
        title: "Testnet Faucet Dispense",
        counterparty: "Veil-agent.testnet",
        amountUsd: 0.88,
        asset: "NEAR",
        status: "claimed",
        statusLabel: "0.25 NEAR Dispensed",
        txHash: data.txHash,
        isInflow: true,
        memo: `Dispensed 0.25 testnet NEAR to ${finalAccount}`,
      });

      // Update message card (Preserving pendingIntent for 1-Click Proceed)
      updateExistingMessage(messageId, (msg) => ({
        ...msg,
        content: `✓ Gas Refilled (+0.25 NEAR). Dispensed 0.25 testnet NEAR to your wallet (${finalAccount}). Your balance has been replenished.`,
        actionCard: msg.actionCard
          ? {
              ...msg.actionCard,
              data: {
                ...msg.actionCard.data,
                isClaiming: false,
                isDispensed: true,
                txHash: data.txHash,
              },
            }
          : undefined,
      }));
    } catch (err: any) {
      console.error("Faucet claim error:", err);
      updateExistingMessage(messageId, (msg) => ({
        ...msg,
        content: `Faucet error: ${err.message || "Failed to dispense tokens"}. You can also visit https://faucet.testnet.near.org directly.`,
        actionCard: msg.actionCard
          ? {
              ...msg.actionCard,
              data: { ...msg.actionCard.data, isClaiming: false },
            }
          : undefined,
      }));
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isProcessing) return;

    setMentionQuery(null);
    setSuggestions([]);
    activeSearchQueryRef.current = "";

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date(),
    };

    appendMessage(userMessage);
    setInput("");

    // Quick Command Intercept: Deposit / Top up
    if (/^(?:deposit|deposit\s+funds|add\s+funds|top\s+up|fund\s+wallet)$/i.test(text)) {
      setIsDepositModalOpen(true);
      appendMessage({
        id: `asst_${Date.now()}`,
        role: "assistant",
        content: `💳 I've opened the **Deposit Modal** for you.\n\nYou can fund your personal wallet via:\n• **NEAR Testnet**: Free faucet tokens or direct NEAR transfer.\n• **Base Sepolia (EVM)**: Deposit testnet ETH or USDC.\n• **Omnichain (38+ Chains)**: Deposit SOL, BTC, ETH, POL, or DOGE via Defuse 1Click solvers.`,
        createdAt: new Date(),
      });
      return;
    }

    setIsProcessing(true);

    try {
      let result: any;
      try {
        const savedKey = typeof window !== "undefined" ? localStorage.getItem("Veil_llm_api_key") || undefined : undefined;
        const savedProvider = typeof window !== "undefined" ? localStorage.getItem("Veil_llm_provider") || undefined : undefined;

        const conversationHistory = messages
          .filter((m) => m.content && (m.role === "user" || m.role === "assistant"))
          .slice(-8)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: conversationHistory,
            mode: "social",
            customApiKey: savedKey,
            provider: savedProvider,
          }),
        });
        if (res.ok) {
          result = await res.json();
        } else {
          result = await processUserMessage(text, conversationHistory);
        }
      } catch {
        result = await processUserMessage(text);
      }

      let actionCard: ChatMessage["actionCard"] = undefined;

      // Scenario A: Tipping requires explicit human confirmation
      if (result.tool === "tip_handle") {
        if (!user) {
          appendMessage({
            id: `agent_${Date.now()}`,
            role: "assistant",
            content: `Authentication Required: Please connect your 𝕏 account and personal NEAR wallet first by clicking the "Connect 𝕏" button in the top right.`,
            createdAt: new Date(),
          });
          setIsProcessing(false);
          return;
        }

        // Multi-chain balance check: supports Base, Arbitrum, Ethereum EVM and NEAR native
        const isFromBase = /(?:from|via|using|with|on)\s+(?:the\s+|my\s+)?(?:base|arb|arbitrum|evm|sepolia)/i.test(text) ||
          /(?:base|arb|arbitrum|evm|sepolia)\s+(?:balance|wallet|chain)/i.test(text) ||
          result.args.sourceChain === "BASE" ||
          result.args.sourceChain === "ARBITRUM" ||
          result.args.isDirectEvm ||
          ["USDC", "ETH", "USDT"].includes((result.args.asset || "").toUpperCase());
        if (isFromBase) {
          const isEth = (result.args.asset || "").toUpperCase() === "ETH";
          const reqAmount = Number(result.args.amount) || 0;

          // Pre-flight balance check: Always query live API or cache to guarantee fresh balances
          let activeEvm = evmBalance;
          if (user?.nearAccountId) {
            try {
              const res = await fetch(`/api/evm/balance?accountId=${encodeURIComponent(user.nearAccountId)}`);
              if (res.ok) {
                const bData = await res.json();
                if (bData.success && bData.data) {
                  activeEvm = {
                    eth: bData.data.ethBalance,
                    usdc: bData.data.usdcBalance,
                    address: bData.data.address,
                    holdings: bData.data.holdings || [],
                    totalEvmUsd: bData.data.totalEvmUsd || 0,
                  };
                }
              }
            } catch (err) {
              console.warn("[ChatContainer] Pre-flight EVM tip balance fetch error:", err);
            }
          }

          const holdings = activeEvm?.holdings || [];

          const baseUsdcFromHoldings = holdings.find((h: any) => h.network === "Base Sepolia" && h.symbol === "USDC")?.balance;
          const baseEthFromHoldings = holdings.find((h: any) => h.network === "Base Sepolia" && h.symbol === "ETH")?.balance;

          const chainHoldings = [
            {
              chain: "Base Sepolia",
              slug: "base",
              chainId: 84532,
              balance: isEth
                ? parseFloat(baseEthFromHoldings || activeEvm?.eth || "0")
                : parseFloat(baseUsdcFromHoldings || activeEvm?.usdc || "0"),
            },
            {
              chain: "Arbitrum Sepolia",
              slug: "arbitrum",
              chainId: 421614,
              balance: parseFloat(holdings.find((h: any) => h.network === "Arbitrum Sepolia" && h.symbol === (isEth ? "ETH" : "USDC"))?.balance || "0"),
            },
          ];

          const explicitChainInText = text.toLowerCase().includes("arbitrum") || text.toLowerCase().includes("arb")
            ? chainHoldings.find((c) => c.slug === "arbitrum")
            : text.toLowerCase().includes("base")
            ? chainHoldings.find((c) => c.slug === "base")
            : null;

          let targetChain = explicitChainInText || chainHoldings.find((c) => c.balance >= reqAmount) || chainHoldings[0];

          if (targetChain.balance < reqAmount) {
            const breakdown = chainHoldings
              .map((c) => `• **${c.chain}**: ${isEth ? `${c.balance.toFixed(4)} ETH` : `$${c.balance.toFixed(2)} USDC`}`)
              .join("\n");

            appendMessage({
              id: `agent_${Date.now()}`,
              role: "assistant",
              content: `Insufficient Balance Detected:\nYour Universal EVM address (${evmBalance?.address ? `${evmBalance.address.slice(0, 10)}...${evmBalance.address.slice(-6)}` : ""}) needs **${reqAmount} ${isEth ? "ETH" : "USDC"}**, but holds:\n${breakdown}\n\nPlease claim free testnet tokens before executing:\n👉 **Circle USDC Faucet (Base & Arbitrum)**: [https://faucet.circle.com/](https://faucet.circle.com/)\n👉 **Base Sepolia ETH Faucet**: [https://www.alchemy.com/faucets/base-sepolia](https://www.alchemy.com/faucets/base-sepolia)\n👉 **Arbitrum Sepolia Faucet**: [https://faucet.quicknode.com/arbitrum/sepolia](https://faucet.quicknode.com/arbitrum/sepolia)`,
              createdAt: new Date(),
            });
            setIsProcessing(false);
            return;
          }

          result.args.chain = targetChain.slug;
          result.args.chainId = targetChain.chainId;
        } else {
          // Insufficient balance check on NEAR
          const currentNear = parseFloat(nearBalance || "0");
          const requiredNear = result.args.asset === "NEAR"
            ? Number(result.args.amount)
            : (Number(result.args.nearEquivalent) || (Number(result.args.amount) / oraclePrices.near));

          if (currentNear < requiredNear || currentNear <= 0.005) {
            appendMessage({
              id: `agent_${Date.now()}`,
              role: "assistant",
              content: `Insufficient Balance Detected:\nYour personal wallet (${user.nearAccountId}) currently has **${currentNear.toFixed(3)} NEAR**, but this tip requires **${requiredNear.toFixed(3)} NEAR** (+ network gas fee).\n\nYou can claim **0.25 testnet NEAR** using the dispenser below:`,
              createdAt: new Date(),
              actionCard: {
                type: "faucet",
                data: {
                  targetAccount: user.nearAccountId,
                  message: `Claim 0.25 testnet NEAR to replenish ${user.nearAccountId} before sending this tip.`,
                  pendingIntent: {
                    commandText: text,
                    label: `Tip @${result.args.recipientHandle} ${result.args.amount} ${result.args.asset}`,
                  },
                },
              },
            });
            setIsProcessing(false);
            return;
          }
        }

        const tipUsdEstimate = Number(result.args.usdEquivalent) || Number((result.args.amount * oraclePrices.near).toFixed(2)) || Number(result.args.amount) || 0.04;
        const budgetCheck = validateSpendBudget(tipUsdEstimate, user?.xHandle);
        if (!budgetCheck.allowed) {
          if (budgetCheck.isQuarantined) {
            const cleanHandle = (result.args.recipientHandle || "").replace("@", "").trim();
            let isRecipRegistered = false;
            try {
              const userRes = await fetch(`/api/user?handle=${encodeURIComponent(cleanHandle)}`);
              if (userRes.ok) {
                const userData = await userRes.json();
                if (userData?.exists && userData?.user?.nearAccountId) {
                  isRecipRegistered = true;
                }
              }
            } catch {}

            actionCard = {
              type: "confirm_tip" as const,
              data: {
                ...result.args,
                isRegistered: isRecipRegistered,
                isBroadcasting: false,
                isQuarantined: true,
                quarantineReason: budgetCheck.error,
                perTxMax: budgetCheck.perTxMax,
              },
            };

            const agentMsgId = `agent_${Date.now()}`;
            appendMessage({
              id: agentMsgId,
              role: "assistant",
              content: `⚠️ **Anomaly Quarantine: Human Approval Required**\n\nThis tip of **${result.args.amount} ${result.args.asset} (~$${tipUsdEstimate.toFixed(2)} USD)** exceeds your autonomous per-transaction limit of **$${budgetCheck.perTxMax?.toFixed(2)} USD**.\n\nPer Veil security policy, transactions exceeding your limit are quarantined and require your direct manual authorization before funds can move:`,
              createdAt: new Date(),
              actionCard,
            });
            setIsProcessing(false);
            return;
          } else {
            appendMessage({
              id: `agent_${Date.now()}`,
              role: "assistant",
              content: budgetCheck.error || "Spending Guardrail Triggered.",
              createdAt: new Date(),
            });
            setIsProcessing(false);
            return;
          }
        }

        const cleanHandle = (result.args.recipientHandle || "").replace("@", "").trim();
        let isRecipRegistered = false;
        try {
          const userRes = await fetch(`/api/user?handle=${encodeURIComponent(cleanHandle)}`);
          if (userRes.ok) {
            const userData = await userRes.json();
            if (userData?.exists && userData?.user?.nearAccountId) {
              isRecipRegistered = true;
            }
          }
        } catch {}

        actionCard = {
          type: "confirm_tip" as const,
          data: {
            ...result.args,
            isRegistered: isRecipRegistered,
            isBroadcasting: false,
          },
        };

        const agentMsgId = `agent_${Date.now()}`;
        appendMessage({
          id: agentMsgId,
          role: "assistant",
          content: isRecipRegistered
            ? `I have prepared a direct tip of ${result.args.amount} ${result.args.asset} for @${result.args.recipientHandle} (Registered User). Please review and confirm below:`
            : `I have prepared a tip of ${result.args.amount} ${result.args.asset} for @${result.args.recipientHandle}. Since @${result.args.recipientHandle} is not yet registered, funds will be locked into on-chain escrow (Veil-agent.testnet) until they connect their 𝕏 account. Please review and confirm below:`,
          createdAt: new Date(),
          actionCard,
        });
        setIsProcessing(false);
        return;
      }
      // Scenario B: Direct Transfer (Native Account-to-Account, Zero Escrow)
      else if (result.tool === "direct_transfer") {
        if (!user) {
          appendMessage({
            id: `agent_${Date.now()}`,
            role: "assistant",
            content: `Authentication Required: Please connect your 𝕏 account and personal NEAR wallet first by clicking the "Connect 𝕏" button in the top right.`,
            createdAt: new Date(),
          });
          setIsProcessing(false);
          return;
        }

        const recipientAddr = (result.args.recipientAddress || "").trim();
        const isFromBase = /(?:from|via|using|with|on)\s+(?:the\s+|my\s+)?(?:base|evm|sepolia)/i.test(text) ||
          /(?:base|evm|sepolia)\s+(?:balance|wallet|chain)/i.test(text) ||
          result.args.sourceChain === "BASE" ||
          result.args.isDirectEvm;

        const assetUpper = (result.args.asset || (isFromBase ? "USDC" : "NEAR")).toUpperCase();
        const isEvmTransfer = recipientAddr.startsWith("0x") ||
          Boolean(result.args.isCrossChain) ||
          isFromBase ||
          ["USDC", "ETH", "USDT"].includes(assetUpper);

        if (isEvmTransfer) {
          const requestedAmount = Number(result.args.amount) || 0;
          const isEth = assetUpper === "ETH";

          // Pre-flight balance check: Always query live API or cache to guarantee fresh balances
          let activeEvm = evmBalance;
          if (user?.nearAccountId) {
            try {
              const res = await fetch(`/api/evm/balance?accountId=${encodeURIComponent(user.nearAccountId)}`);
              if (res.ok) {
                const bData = await res.json();
                if (bData.success && bData.data) {
                  activeEvm = {
                    eth: bData.data.ethBalance,
                    usdc: bData.data.usdcBalance,
                    address: bData.data.address,
                    holdings: bData.data.holdings || [],
                    totalEvmUsd: bData.data.totalEvmUsd || 0,
                  };
                }
              }
            } catch (err) {
              console.warn("[ChatContainer] Pre-flight EVM balance fetch error:", err);
            }
          }

          const holdings = activeEvm?.holdings || [];

          const baseUsdcFromHoldings = holdings.find((h: any) => h.network === "Base Sepolia" && h.symbol === "USDC")?.balance;
          const baseEthFromHoldings = holdings.find((h: any) => h.network === "Base Sepolia" && h.symbol === "ETH")?.balance;

          const chainHoldings = [
            {
              chain: "Base Sepolia",
              slug: "base",
              chainId: 84532,
              balance: isEth
                ? parseFloat(baseEthFromHoldings || activeEvm?.eth || "0")
                : parseFloat(baseUsdcFromHoldings || activeEvm?.usdc || "0"),
            },
            {
              chain: "Arbitrum Sepolia",
              slug: "arbitrum",
              chainId: 421614,
              balance: parseFloat(holdings.find((h: any) => h.network === "Arbitrum Sepolia" && h.symbol === (isEth ? "ETH" : "USDC"))?.balance || "0"),
            },
            {
              chain: "Ethereum Sepolia",
              slug: "ethereum",
              chainId: 11155111,
              balance: parseFloat(holdings.find((h: any) => h.network === "Ethereum Sepolia" && h.symbol === (isEth ? "ETH" : "USDC"))?.balance || "0"),
            },
          ];

          const userChain = (result.args.chain || "").toLowerCase();
          const explicitChainInText = text.toLowerCase().includes("arbitrum") || text.toLowerCase().includes("arb")
            ? chainHoldings.find((c) => c.slug === "arbitrum")
            : text.toLowerCase().includes("ethereum") || text.toLowerCase().includes("eth mainnet")
            ? chainHoldings.find((c) => c.slug === "ethereum")
            : text.toLowerCase().includes("base")
            ? chainHoldings.find((c) => c.slug === "base")
            : null;

          let targetChain = explicitChainInText || chainHoldings.find((c) => c.slug === userChain && c.balance >= requestedAmount) || chainHoldings.find((c) => c.balance >= requestedAmount) || chainHoldings[0];

          if (targetChain.balance < requestedAmount) {
            const breakdown = chainHoldings
              .map((c) => `• **${c.chain}**: ${isEth ? `${c.balance.toFixed(4)} ETH` : `$${c.balance.toFixed(2)} ${assetUpper}`}`)
              .join("\n");

            appendMessage({
              id: `agent_${Date.now()}`,
              role: "assistant",
              content: `Insufficient Balance Detected:\nYour Universal EVM address (${evmBalance?.address ? `${evmBalance.address.slice(0, 10)}...${evmBalance.address.slice(-6)}` : ""}) needs **${requestedAmount} ${isEth ? "ETH" : assetUpper}**, but holds:\n${breakdown}\n\nPlease claim free testnet tokens before executing:\n👉 **Circle USDC Faucet (Base & Arbitrum)**: [https://faucet.circle.com/](https://faucet.circle.com/)\n👉 **Base Sepolia ETH Faucet**: [https://www.alchemy.com/faucets/base-sepolia](https://www.alchemy.com/faucets/base-sepolia)\n👉 **Arbitrum Sepolia Faucet**: [https://faucet.quicknode.com/arbitrum/sepolia](https://faucet.quicknode.com/arbitrum/sepolia)`,
              createdAt: new Date(),
            });
            setIsProcessing(false);
            return;
          }

          result.args.chain = targetChain.slug;
          result.args.chainId = targetChain.chainId;
        } else {
          const currentNear = parseFloat(nearBalance || "0");
          const requiredNear = assetUpper === "NEAR"
            ? Number(result.args.amount)
            : (Number(result.args.nearEquivalent) || (Number(result.args.amount) / oraclePrices.near));

          if (currentNear < requiredNear || currentNear <= 0.005) {
            appendMessage({
              id: `agent_${Date.now()}`,
              role: "assistant",
              content: `Insufficient Balance Detected:\nYour personal wallet (${user.nearAccountId}) currently has **${currentNear.toFixed(3)} NEAR**, but this transfer requires **${requiredNear.toFixed(3)} NEAR** (+ network gas fee).\n\nYou can claim **0.25 testnet NEAR** immediately using the Veil Testnet Faucet below:`,
              createdAt: new Date(),
              actionCard: {
                type: "faucet",
                data: {
                  targetAccount: user.nearAccountId,
                  message: `Claim 0.25 testnet NEAR to replenish ${user.nearAccountId} before sending this transfer.`,
                  pendingIntent: {
                    commandText: text,
                    label: `Send ${result.args.amount} ${result.args.asset} to ${result.args.recipientAddress?.slice(0, 10)}...`,
                  },
                },
              },
            });
            setIsProcessing(false);
            return;
          }
        }

        const transferUsdEstimate = isEvmTransfer
          ? (assetUpper === "ETH" ? (Number(result.args.amount) * oraclePrices.eth) : Number(result.args.amount))
          : (Number(result.args.usdEquivalent) || Number((result.args.amount * oraclePrices.near).toFixed(2)) || Number(result.args.amount) || 0.04);

        const budgetCheck = validateSpendBudget(transferUsdEstimate, user?.xHandle);
        if (!budgetCheck.allowed && !budgetCheck.isQuarantined) {
          appendMessage({
            id: `agent_${Date.now()}`,
            role: "assistant",
            content: budgetCheck.error || "Spending Guardrail Triggered.",
            createdAt: new Date(),
          });
          setIsProcessing(false);
          return;
        }

        actionCard = {
          type: "confirm_direct" as const,
          data: {
            ...result.args,
            isEvmTransfer,
            isBroadcasting: false,
            isQuarantined: budgetCheck.isQuarantined,
            quarantineReason: budgetCheck.error,
            perTxMax: budgetCheck.perTxMax,
          },
        };

        const agentMsgId = `agent_${Date.now()}`;
        const assetLabel = (result.args.asset || (isEvmTransfer ? (assetUpper === "ETH" ? "ETH" : "USDC") : "NEAR")).toUpperCase();
        const chainName = (result.args.chain || "Base").toUpperCase();
        appendMessage({
          id: agentMsgId,
          role: "assistant",
          content: `I've prepared a direct transfer of **${result.args.amount} ${assetLabel}** (~$${transferUsdEstimate.toFixed(2)}) to \`${result.args.recipientAddress}\`${isEvmTransfer ? ` on ${chainName} Sepolia via NEAR MPC` : ""}.\nThis delivers directly wallet-to-wallet on-chain with zero escrow lock or claim required. Please confirm below:`,
          createdAt: new Date(),
          actionCard,
        });
        setIsProcessing(false);
        return;
      }
      // Scenario B.2: Execute Cross-Chain Intent (NEAR Intents / Defuse 1Click Solvers)
      else if (result.tool === "execute_cross_chain_intent") {
        if (!user) {
          appendMessage({
            id: `agent_${Date.now()}`,
            role: "assistant",
            content: `Authentication Required: Please connect your 𝕏 account and personal NEAR wallet first by clicking the "Connect 𝕏" button in the top right.`,
            createdAt: new Date(),
          });
          setIsProcessing(false);
          return;
        }

        const requestedFromEvm = Boolean(result.args.isDirectEvm) ||
          (result.args.sourceChain && result.args.sourceChain.toUpperCase() === "BASE") ||
          /(?:from|via|using|with|on)\s+(?:the\s+|my\s+)?(?:base|evm|sepolia)/i.test(text) ||
          /(?:base|evm|sepolia)\s+(?:balance|wallet|chain)/i.test(text);

        let targetAsset = (result.args.targetAsset || "USDC").toUpperCase();
        const targetChain = (result.args.targetChain || "BASE").toUpperCase();
        const recipient = result.args.recipient || result.args.recipientHandle;
        let targetAmount = Number(result.args.amount) || Number(result.args.targetAmount) || 10;

        if (requestedFromEvm && targetAsset === "NEAR") {
          targetAsset = "USDC";
          if (result.args.amount) {
            targetAmount = Number((Number(result.args.amount) * oraclePrices.near).toFixed(2));
          }
        }

        // Check if user has sufficient funds directly on the target EVM chain!
        const userEvmUsdc = parseFloat(evmBalance?.usdc || "0");
        const userEvmEth = parseFloat(evmBalance?.eth || "0");
        const isEvmTarget = ["BASE", "ARBITRUM", "OPTIMISM", "POLYGON", "ETHEREUM", "BNB", "AVALANCHE"].includes(targetChain);

        const hasDirectEvmFunds = isEvmTarget && (
          (targetAsset === "USDC" && userEvmUsdc >= targetAmount) ||
          (targetAsset === "ETH" && userEvmEth >= targetAmount)
        );

        let isDirectEvm = false;
        let finalSourceChain = result.args.sourceChain || "NEAR";
        let finalSourceAsset = result.args.sourceAsset || "NEAR";
        let finalSourceAmount = 0;

        if (requestedFromEvm || hasDirectEvmFunds) {
          if (!hasDirectEvmFunds && requestedFromEvm) {
            appendMessage({
              id: `agent_${Date.now()}`,
              role: "assistant",
              content: `Insufficient Balance Detected on ${targetChain}:\nYour Universal EVM address on ${targetChain} (${evmBalance?.address ? `${evmBalance.address.slice(0, 10)}...${evmBalance.address.slice(-6)}` : ""}) currently holds **$${userEvmUsdc.toFixed(2)} USDC**, but **$${targetAmount.toFixed(2)} USDC** is required for this outbound transfer.\n\nPlease claim free Base Sepolia testnet USDC from the official Circle Faucet before executing:\n👉 [https://faucet.circle.com/](https://faucet.circle.com/)`,
              createdAt: new Date(),
            });
            setIsProcessing(false);
            return;
          }

          // Fund directly from user's active EVM balance on this chain
          isDirectEvm = true;
          finalSourceChain = targetChain;
          finalSourceAsset = targetAsset;
          finalSourceAmount = targetAmount;
        } else {
          // Cross-chain solver bridge from NEAR
          const nearPriceEstimate = oraclePrices.near;
          const requiredNear = targetAsset === "NEAR"
            ? targetAmount
            : Number((targetAmount / nearPriceEstimate).toFixed(3));

          finalSourceChain = "NEAR";
          finalSourceAsset = "NEAR";
          finalSourceAmount = requiredNear;

          const currentNear = parseFloat(nearBalance || "0");
          if (currentNear < requiredNear || currentNear <= 0.005) {
            appendMessage({
              id: `agent_${Date.now()}`,
              role: "assistant",
              content: `Insufficient Balance Detected:\nYour personal NEAR wallet (${user.nearAccountId}) currently has **${currentNear.toFixed(3)} NEAR**, but executing this cross-chain intent from NEAR requires approximately **${requiredNear.toFixed(3)} NEAR**.\n\n${userEvmUsdc > 0 ? `Note: You have **$${userEvmUsdc.toFixed(2)} USDC** on Base Sepolia in your Universal EVM wallet (${evmBalance?.address ? `${evmBalance.address.slice(0, 8)}...` : ""}).` : ""}\n\nYou can claim **0.25 testnet NEAR** using the dispenser below:`,
              createdAt: new Date(),
              actionCard: {
                type: "faucet",
                data: {
                  targetAccount: user.nearAccountId,
                  message: `Claim 0.25 testnet NEAR to replenish ${user.nearAccountId} before executing cross-chain intent.`,
                  pendingIntent: {
                    commandText: text,
                    label: `Deliver ${targetAmount} ${targetAsset} on ${targetChain}`,
                  },
                },
              },
            });
            setIsProcessing(false);
            return;
          }
        }

        const transferUsdEstimate = targetAsset === "NEAR"
          ? Number((targetAmount * oraclePrices.near).toFixed(2))
          : (targetAsset === "ETH" || targetAsset === "WETH")
          ? Number((targetAmount * oraclePrices.eth).toFixed(2))
          : (targetAsset === "BTC" || targetAsset === "cbBTC")
          ? Number((targetAmount * 68000).toFixed(2))
          : (targetAsset === "SOL")
          ? Number((targetAmount * 150).toFixed(2))
          : targetAmount;

        const budgetCheck = validateSpendBudget(transferUsdEstimate, user?.xHandle);
        if (!budgetCheck.allowed && !budgetCheck.isQuarantined) {
          appendMessage({
            id: `agent_${Date.now()}`,
            role: "assistant",
            content: budgetCheck.error || "Spending Guardrail Triggered.",
            createdAt: new Date(),
          });
          setIsProcessing(false);
          return;
        }

        // Request active solver quote & deposit address from backend (for cross-chain intent) or direct EVM parameters
        let quoteOrderId = `intent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        let solverDeposit = isDirectEvm
          ? (evmBalance?.address || "0xE56b972a06F1A9D474e419711d0ca3EBD4553D8F")
          : "";
        let computedSourceAmount = finalSourceAmount;

        if (!isDirectEvm) {
          try {
            const intentApiRes = await fetch("/api/intents", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sourceChain: "NEAR",
                sourceAsset: "NEAR",
                targetChain,
                targetAsset,
                amount: finalSourceAmount,
                recipient,
                senderHandle: user.xHandle,
                senderWallet: user.nearAccountId,
              }),
            });

            const apiData = await intentApiRes.json();
            if (!intentApiRes.ok || !apiData.success || !apiData.order?.depositAddress) {
              appendMessage({
                id: `agent_${Date.now()}`,
                role: "assistant",
                content: `1Click Solver Auction Unavailable:\n${apiData.error || "No active Defuse solvers currently quoting for this pair on testnet."}\n\nNEAR Intents liquidity solvers operate continuously on mainnet. For testnet testing, please execute direct transfers or check supported liquidity pairs.`,
                createdAt: new Date(),
              });
              setIsProcessing(false);
              return;
            }

            quoteOrderId = apiData.order.orderId;
            solverDeposit = apiData.order.depositAddress;
            computedSourceAmount = apiData.order.sourceAmount || finalSourceAmount;
          } catch (e: any) {
            appendMessage({
              id: `agent_${Date.now()}`,
              role: "assistant",
              content: `Failed to connect to Defuse 1Click solver gateway: ${e.message || "Network offline"}. Please try again later.`,
              createdAt: new Date(),
            });
            setIsProcessing(false);
            return;
          }
        }

        const intentCardData = {
          orderId: quoteOrderId,
          depositAddress: solverDeposit,
          sourceChain: finalSourceChain,
          sourceAsset: finalSourceAsset,
          sourceAmount: computedSourceAmount,
          targetChain,
          targetAsset,
          targetAmount,
          recipient,
          recipientHandle: result.args.recipientHandle,
          isDirectEvm,
          isConfidential: true,
          shieldStatus: "ACTIVE_TEE",
          estimatedFeeUsd: isDirectEvm ? 0.01 : 0.04,
          expiresAt: Date.now() + 60000,
          isExecuting: false,
          isQuarantined: budgetCheck.isQuarantined,
          quarantineReason: budgetCheck.error,
          perTxMax: budgetCheck.perTxMax,
        };

        const recipientLabel = result.args.recipientHandle ? `@${result.args.recipientHandle}` : recipient;
        const agentMsgId = `agent_${Date.now()}`;
        const msgContent = isDirectEvm
          ? `I've prepared a direct transfer on **${targetChain}** to deliver **${targetAmount} ${targetAsset}** to \`${recipientLabel}\`.\n\nFunded directly from your **${targetChain} ${targetAsset}** balance ($${userEvmUsdc.toFixed(2)} USDC available in your Universal EVM wallet via NEAR Chain Signatures MPC). Zero NEAR required. Review and confirm below:`
          : `I've prepared a cross-chain solver auction via **NEAR Intents (Defuse 1Click)** to deliver **${targetAmount} ${targetAsset} on ${targetChain}** to \`${recipientLabel}\`.\n\nYou provide **${computedSourceAmount} NEAR**; market-maker solvers will advance and settle the funds directly on ${targetChain} with zero bridge risk. Review and confirm below:`;

        appendMessage({
          id: agentMsgId,
          role: "assistant",
          content: msgContent,
          createdAt: new Date(),
          actionCard: {
            type: "cross_chain_intent",
            data: intentCardData,
          },
        });
        setIsProcessing(false);
        return;
      }
      // Scenario C: Pay Invoice via Agent
      else if (result.tool === "pay_invoice") {
        if (!user) {
          appendMessage({
            id: `agent_${Date.now()}`,
            role: "assistant",
            content: `Authentication Required: Please connect your 𝕏 account and personal NEAR wallet first by clicking the "Connect 𝕏" button in the top right.`,
            createdAt: new Date(),
          });
          setIsProcessing(false);
          return;
        }

        const slug = result.args.slug || result.args.invoiceSlug;
        let invoiceData: any = null;

        try {
          const invRes = await fetch(`/api/paylinks?slug=${encodeURIComponent(slug)}`);
          if (invRes.ok) {
            const data = await invRes.json();
            if (data.success && data.paylink) {
              invoiceData = data.paylink;
            }
          }
        } catch (e) {
          console.warn("Could not fetch invoice from API:", e);
        }

        if (!invoiceData) {
          invoiceData = {
            slug,
            amountUsd: Number(result.args.amountUsd) || 15.0,
            recipientNearAccount: result.args.recipientNearAccount || "Veil-agent.testnet",
            memo: result.args.memo || `Invoice ${slug}`,
            status: "active",
          };
        }

        if (invoiceData.status === "settled") {
          appendMessage({
            id: `agent_${Date.now()}`,
            role: "assistant",
            content: `ℹ️ Invoice \`${slug}\` is already marked as **settled**.\nTx Hash: ${invoiceData.settledTx || "Completed"}`,
            createdAt: new Date(),
          });
          setIsProcessing(false);
          return;
        }

        const invAmountUsd = Number(invoiceData.amountUsd) || 15.0;
        const budgetCheck = validateSpendBudget(invAmountUsd, user?.xHandle);
        if (!budgetCheck.allowed) {
          appendMessage({
            id: `agent_${Date.now()}`,
            role: "assistant",
            content: budgetCheck.error || "Spending Guardrail Triggered.",
            createdAt: new Date(),
          });
          setIsProcessing(false);
          return;
        }

        actionCard = {
          type: "pay_invoice" as const,
          data: {
            slug: invoiceData.slug,
            amountUsd: invAmountUsd,
            recipientNearAccount: invoiceData.recipientNearAccount || "Veil-agent.testnet",
            title: invoiceData.memo || invoiceData.title || `Invoice ${slug}`,
            isPaying: false,
          },
        };

        const agentMsgId = `agent_${Date.now()}`;
        appendMessage({
          id: agentMsgId,
          role: "assistant",
          content: `I've found invoice \`${slug}\` for **$${invAmountUsd.toFixed(2)}** (${(invAmountUsd / oraclePrices.near).toFixed(3)} NEAR) payable to \`${invoiceData.recipientNearAccount}\`.\nReview details and authorize one-click settlement below:`,
          createdAt: new Date(),
          actionCard,
        });
        setIsProcessing(false);
        return;
      }
      // Scenario D: Invoice generation
      else if (result.tool === "create_invoice") {
        const invoiceSlug = `inv_${Math.random().toString(36).substring(2, 8)}`;
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
        const targetClient = result.args.recipientHandle || result.args.clientHandle;
        const invoiceAmount = Number(result.args.amountUsd || result.args.usdEquivalent || (result.args.asset === "NEAR" ? result.args.amount * oraclePrices.near : result.args.amount)) || 15.0;
        const invoiceMemo = result.args.memo || (targetClient ? `Invoice for @${targetClient}` : "Payment Request");

        actionCard = {
          type: "invoice" as const,
          data: {
            ...result.args,
            recipientHandle: targetClient,
            amountUsd: invoiceAmount,
            amount: result.args.amount || invoiceAmount,
            memo: invoiceMemo,
            payUrl: `${baseUrl}/pay/${invoiceSlug}`,
          },
        };

        // Persist active PayLink to MongoDB
        fetch("/api/paylinks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: invoiceSlug,
            creatorHandle: user?.xHandle || "expatq3",
            recipientNearAccount: user?.nearAccountId || "Veil-agent.testnet",
            amountUsd: invoiceAmount,
            memo: invoiceMemo,
            supportedChains: ["Base (USDC)", "Solana (SOL)", "NEAR (USDC)"],
          }),
        }).catch((err) => console.warn("Failed to persist paylink to DB:", err));

        // Record active PayLink in transactions store
        addPayLinkRecord({
          slug: invoiceSlug,
          title: invoiceMemo,
          amountUsd: invoiceAmount,
          recipientAccount: user?.nearAccountId || "Veil-agent.testnet",
          supportedChains: ["Base (USDC)", "Solana (SOL)", "NEAR (USDC)"],
          status: "active",
        });

        appendMessage({
          id: `agent_${Date.now()}`,
          role: "assistant",
          content: result.assistantReply,
          createdAt: new Date(),
          actionCard,
        });
      }
      // Scenario C: Gasless Claim via Meta-Transactions
      else if (result.tool === "claim_funds") {
        if (!user) {
          appendMessage({
            id: `agent_${Date.now()}`,
            role: "assistant",
            content: `Authentication Required: Please connect your 𝕏 account using the button in the top right to verify identity and claim your pending tips.`,
            createdAt: new Date(),
          });
          setIsProcessing(false);
          return;
        }

        const targetHandle = user.xHandle;
        const targetWallet = user.nearAccountId;
        const activeSession = getStoredAgentSession(targetHandle);

        try {
          // 1. Fetch pending unclaimed tips from database
          const pendingRes = await fetch(`/api/near/pending-tips?handle=${encodeURIComponent(targetHandle)}`);
          const pendingData = await pendingRes.json();
          const tips = pendingData?.pendingTips || [];

          if (tips.length === 0) {
            appendMessage({
              id: `agent_${Date.now()}`,
              role: "assistant",
              content: `ℹ️ No pending tips found for @${targetHandle}.\n\nWhen another user sends you a tip on Veil or 𝕏, it will appear here in escrow ready for gasless claim.`,
              createdAt: new Date(),
            });
            setIsProcessing(false);
            return;
          }

          // 2. Claim all pending tips sequentially using the relayer
          let claimedCount = 0;
          let totalClaimedNear = 0;
          let lastTxHash = "";
          const claimErrors: string[] = [];

          for (const tip of tips) {
            try {
              const claimRes = await fetch("/api/relay/claim", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  tipId: tip.tipId,
                  recipientHandle: targetHandle,
                  recipientWallet: targetWallet,
                  publicKey: activeSession?.publicKey,
                }),
              });
              const claimData = await claimRes.json();
              if (claimRes.ok && claimData.success) {
                const txHash = claimData.txHash || claimData.relayedTxHash;
                const claimedAmount = Number(tip.amountNear || tip.amount || 0.01);
                claimedCount++;
                totalClaimedNear += claimedAmount;
                lastTxHash = txHash;

                addTransactionRecord(
                  {
                    type: "tip_claimed",
                    title: `Claimed Tip from @${tip.senderHandle || "anonymous"}`,
                    counterparty: `@${tip.senderHandle || "sender"}`,
                    amountUsd: Number((claimedAmount * oraclePrices.near).toFixed(2)),
                    asset: tip.asset || "NEAR",
                    status: "claimed",
                    statusLabel: "Claimed via Relayer (Gasless)",
                    txHash,
                    isInflow: true,
                    memo: `Delivered ${claimedAmount} NEAR directly to ${targetWallet}`,
                  },
                  targetHandle
                );
              } else {
                claimErrors.push(claimData.error || `Tip ${tip.tipId} failed`);
              }
            } catch (singleErr: any) {
              claimErrors.push(singleErr.message || `Tip ${tip.tipId} network error`);
            }
          }

          if (claimedCount === 0) {
            throw new Error(claimErrors.join("; ") || "Failed to claim any tips on-chain");
          }

          // Update active balance and transaction store
          await refreshAccountData();
          setPendingTipsCount(0);
          setPendingTipsTotal(0);

          const claimRadar: RadarStep[] = [
            { id: "1", label: "Signed Claim Intent with Local Session Key (0 gas)", status: "completed" },
            { id: "2", label: "Relayed via Veil NEP-366 Sponsor", status: "completed" },
            { id: "3", label: `Delivered to ${targetWallet}`, status: "completed", txHash: lastTxHash, chain: "near" },
          ];

          appendMessage({
            id: `agent_${Date.now()}`,
            role: "assistant",
            content: `🎉 Successfully claimed ${claimedCount} tip(s) totaling **${totalClaimedNear.toFixed(3)} NEAR** to \`${targetWallet}\`! Gas was sponsored by the Veil Relayer.\n\nLatest Transaction: [${lastTxHash}](https://testnet.nearblocks.io/txns/${lastTxHash})`,
            createdAt: new Date(),
            actionCard: {
              type: "claim",
              data: { amount: totalClaimedNear.toFixed(3), asset: "NEAR", txHash: lastTxHash },
              radar: claimRadar,
            },
          });
        } catch (claimErr: any) {
          console.error("Relayed claim error:", claimErr);
          appendMessage({
            id: `agent_${Date.now()}`,
            role: "assistant",
            content: `Failed to claim tip: ${claimErr.message || "Relayer error"}. Please try again.`,
            createdAt: new Date(),
          });
        } finally {
          setIsProcessing(false);
          return;
        }
      }
      // Scenario D: Check Balance & Spending Authority
      else if (result.tool === "check_balance") {
        if (!user) {
          appendMessage({
            id: `agent_${Date.now()}`,
            role: "assistant",
            content: `You are currently not signed in. Please click **"Connect 𝕏"** in the top header to connect your personal NEAR wallet and view your balances.`,
            createdAt: new Date(),
          });
        } else {
          let currentEvm = evmBalance;
          let currentNearTokens = nearTokens || [];
          let currentNear = parseFloat(nearBalance || "0");

          if (typeof window !== "undefined" && (!currentNearTokens || currentNearTokens.length === 0)) {
            try {
              const cached = sessionStorage.getItem("veil_cached_near_tokens");
              if (cached) currentNearTokens = JSON.parse(cached);
            } catch {}
          }

          if (user.nearAccountId) {
            try {
              const [evmRes, nearRes] = await Promise.all([
                fetch(`/api/evm/balance?accountId=${encodeURIComponent(user.nearAccountId)}`),
                fetch(`/api/near/account?accountId=${encodeURIComponent(user.nearAccountId)}`),
              ]);
              if (evmRes.ok) {
                const data = await evmRes.json();
                if (data?.success && data?.data) {
                  currentEvm = {
                    eth: data.data.ethBalance,
                    usdc: data.data.usdcBalance,
                    address: data.data.address,
                    totalEvmUsd: data.data.totalEvmUsd,
                    holdings: data.data.holdings || [],
                  };
                }
              }
              if (nearRes.ok) {
                const nData = await nearRes.json();
                if (nData?.amountNear) currentNear = parseFloat(nData.amountNear) || currentNear;
                if (nData?.tokens && Array.isArray(nData.tokens) && nData.tokens.length > 0) {
                  currentNearTokens = nData.tokens;
                }
              }
            } catch {}
          }

          const remainingCap = Math.max(0, spendingLimitUsd - spentUsd);
          const isLow = currentNear < 0.05;

          // Build dynamic NEAR NEP-141 token lines
          let nearTokensLines = "";
          let nearTokensUsd = 0;
          if (Array.isArray(currentNearTokens) && currentNearTokens.length > 0) {
            const nonZero = currentNearTokens.filter((t: any) => (t.numericBalance || 0) > 0);
            if (nonZero.length > 0) {
              nearTokensLines = nonZero
                .map((t: any) => `- NEP-141 (${t.symbol}): **${t.balance} ${t.symbol}** (~$${(t.valueUsd || (t.numericBalance * (t.usdPrice || 1))).toFixed(2)} USD)`)
                .join("\n");
              nearTokensUsd = nonZero.reduce((sum: number, t: any) => sum + (t.valueUsd || (t.numericBalance * (t.usdPrice || 1))), 0);
            }
          }

          // Build dynamic multi-chain EVM holdings list
          let evmHoldingsLines = "";
          if (currentEvm?.holdings && Array.isArray(currentEvm.holdings)) {
            const nonZero = currentEvm.holdings.filter((h: any) => parseFloat(h.balance) > 0);
            if (nonZero.length > 0) {
              evmHoldingsLines = nonZero
                .map((h: any) => `- ${h.network}: **${h.balance} ${h.symbol}** (~$${(h.valueUsd || 0).toFixed(2)})`)
                .join("\n");
            } else {
              evmHoldingsLines = `- Base Sepolia: **$${currentEvm.usdc || "0.00"} USDC**\n- Base Sepolia: **${currentEvm.eth || "0.0000"} ETH**`;
            }
          } else {
            evmHoldingsLines = `- Base Sepolia: **$${currentEvm?.usdc || "0.00"} USDC**\n- Base Sepolia: **${currentEvm?.eth || "0.0000"} ETH**`;
          }

          const nearNativeUsd = currentNear * oraclePrices.near;
          const totalNearUsd = nearNativeUsd + nearTokensUsd;
          const evmNetWorth = currentEvm?.totalEvmUsd ?? (parseFloat(currentEvm?.usdc || "0") + parseFloat(currentEvm?.eth || "0") * 2600);
          const totalCombinedNetWorth = evmNetWorth + totalNearUsd;

          const balReply =
            `**Omnichain Portfolio & Session Authority Status**\n\n` +
            `**NEAR Protocol (Testnet)**\n` +
            `- Account ID: \`${user.nearAccountId}\`\n` +
            `- Native Balance: **${currentNear.toFixed(3)} NEAR** (~$${nearNativeUsd.toFixed(2)} USD)\n` +
            (nearTokensLines ? `${nearTokensLines}\n` : "") +
            `- Total NEAR Assets: **~$${totalNearUsd.toFixed(2)} USD**\n` +
            `- Session Cap: **$${remainingCap.toFixed(2)}** remaining today (spent $${spentUsd.toFixed(2)} of $${spendingLimitUsd.toFixed(2)} limit)\n\n` +
            `**Universal EVM (NEAR Chain Signatures MPC)**\n` +
            `- Derived 0x Address: \`${currentEvm?.address || "Deriving via MPC..."}\`\n` +
            `- Supported Networks: Base Sepolia · Arbitrum Sepolia · Optimism · Ethereum Sepolia\n` +
            `${evmHoldingsLines}\n` +
            `- Total EVM Net Worth: **~$${evmNetWorth.toFixed(2)} USD**\n` +
            `- MPC Signer Contract: \`v1.signer-prod.testnet\`\n\n` +
            `**Total Combined Net Worth**: **~$${totalCombinedNetWorth.toFixed(2)} USD**` +
            (isLow ? `\n\n**Low Balance Notice**: Your balance is nearly depleted (${currentNear.toFixed(3)} NEAR). Claim 0.25 testnet NEAR below:` : "");

          appendMessage({
            id: `agent_${Date.now()}`,
            role: "assistant",
            content: balReply,
            createdAt: new Date(),
            actionCard: isLow
              ? {
                  type: "faucet",
                  data: {
                    targetAccount: user.nearAccountId,
                    message: `Fund ${user.nearAccountId} with 0.25 free testnet NEAR.`,
                  },
                }
              : undefined,
          });
        }
      }
      // Scenario E: Claim Testnet Faucet
      else if (result.tool === "faucet") {
        if (!user) {
          appendMessage({
            id: `agent_${Date.now()}`,
            role: "assistant",
            content: `Please connect your 𝕏 account and personal wallet first so the faucet knows where to dispense tokens! Alternatively, you can request tokens directly from the official faucet at https://faucet.testnet.near.org.`,
            createdAt: new Date(),
          });
        } else {
          appendMessage({
            id: `agent_${Date.now()}`,
            role: "assistant",
            content: `Here is the Veil Testnet Faucet for your wallet \`${user.nearAccountId}\`. Click the button below to instantly receive 0.25 testnet NEAR:`,
            createdAt: new Date(),
            actionCard: {
              type: "faucet",
              data: {
                targetAccount: user.nearAccountId,
                message: `Dispense 0.25 free testnet NEAR to ${user.nearAccountId}`,
              },
            },
          });
        }
      }
      // Scenario F: General fallback
      else {
        appendMessage({
          id: `agent_${Date.now()}`,
          role: "assistant",
          content: result.assistantReply,
          createdAt: new Date(),
        });
      }
    } catch (err: any) {
      appendMessage({
        id: `err_${Date.now()}`,
        role: "assistant",
        content: `Error: ${err.message || "Failed to process intent"}`,
        createdAt: new Date(),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const activeChatSession = getStoredAgentSession(user?.xHandle);
  const isSessionRevoked = !activeChatSession || !activeChatSession.publicKey;
  const isSessionFrozen = Boolean(activeChatSession?.isFrozen);

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)] h-[calc(100dvh-4rem)] max-w-4xl mx-auto px-2.5 sm:px-4 py-1.5 sm:py-2 w-full overflow-x-hidden">
      {/* Top Controls */}
      <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-butter-300/60 mb-1 gap-2">
        <div className="text-xs font-semibold text-brown-700 flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isSessionFrozen
                ? "bg-rose-600 animate-ping"
                : isSessionRevoked
                ? "bg-amber-500"
                : "bg-shield-emerald animate-pulse"
            }`}
          />
          <span className="truncate text-xs font-bold text-brown-800">
            <span className="sm:hidden">
              {isSessionFrozen ? "Frozen" : isSessionRevoked ? "Revoked" : "Copilot"}
            </span>
            <span className="hidden sm:inline">
              {isSessionFrozen
                ? "SESSION FROZEN"
                : isSessionRevoked
                ? "SESSION REVOKED"
                : `Autonomous Social Workspace ($${spendingLimitUsd.toFixed(0)} CAP)`}
            </span>
          </span>
          <span className="text-[10px] text-brown-400 font-normal hidden md:inline">• Gemini 2.5 Flash</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {messages.length > 1 && (
            <button
              onClick={handleClearChat}
              className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-white hover:bg-red-50 border border-butter-300 text-brown-600 hover:text-red-700 transition shadow-subtle"
              title="Clear Conversation History"
            >
              <Trash2 className="w-3 h-3 text-brown-400 hover:text-red-600 shrink-0" />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          )}
          <button
            onClick={() => setShowDrawer(!showDrawer)}
            className="flex items-center gap-1 sm:gap-1.5 text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-lg bg-white hover:bg-butter-200 border border-butter-300 text-brown-800 transition shadow-subtle shrink-0"
            title="View Activity & Invoices"
          >
            <History className="w-3.5 h-3.5 text-brown-500 shrink-0" />
            <span className="hidden sm:inline">Activity & Invoices</span>
            <span className="sm:hidden">Invoices</span>
          </button>
        </div>
      </div>

      {/* Unclaimed Escrow Tips Banner */}
      {pendingTipsCount > 0 && (
        <div className="my-2 p-3 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-between shadow-subtle animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center text-sm font-bold shrink-0">
              🎁
            </div>
            <div>
              <p className="text-xs font-bold text-brown-900">
                You have {pendingTipsCount} pending tip{pendingTipsCount > 1 ? "s" : ""} waiting in escrow!
              </p>
              <p className="text-[11px] text-brown-600">
                Total value: <strong className="text-amber-800 font-semibold">{pendingTipsTotal} NEAR</strong> • Gasless claim sponsored by Veil
              </p>
            </div>
          </div>
          <button
            onClick={() => handleSend("Claim my tips")}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-xl bg-brown-900 hover:bg-brown-800 text-butter-100 text-xs font-bold shadow-subtle transition shrink-0"
          >
            Claim Now
          </button>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto px-1 py-2 space-y-1">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            userAvatar={userAvatar}
            onConfirmTip={handleConfirmTip}
            onConfirmDirectTransfer={handleConfirmDirectTransfer}
            onExecuteIntent={handleExecuteIntent}
            onPayInvoice={handlePayInvoice}
            onCancelTip={handleCancelTip}
            onClaimFaucet={handleClaimFaucet}
            onProceedPendingCommand={(cmd) => handleSend(cmd)}
          />
        ))}
        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-brown-500 italic ml-10 sm:ml-11 my-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" /> Veil is executing intent...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick-Tip Presets & Suggestions Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-2 px-1 text-xs no-scrollbar">
        <span className="text-[10px] uppercase font-mono font-bold text-brown-500 pl-1 shrink-0">
          Quick Tip:
        </span>
        {["$1", "$5", "$10", "$25"].map((tipVal) => (
          <button
            key={tipVal}
            type="button"
            onClick={() => {
              setInput(`Tip @${user?.xHandle || "friend"} ${tipVal} USDC`);
              inputRef.current?.focus();
            }}
            className="px-2.5 py-1 rounded-full bg-white hover:bg-butter-100 border border-butter-300 text-brown-900 font-mono font-bold text-[11px] transition shadow-subtle shrink-0 cursor-pointer"
          >
            {tipVal}
          </button>
        ))}
        <div className="h-4 w-px bg-butter-300 mx-1 shrink-0" />
        {SUGGESTIONS.map((sug, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(sug)}
            className="px-3 py-1 rounded-full bg-white hover:bg-butter-200 border border-butter-300 text-brown-800 transition whitespace-nowrap flex items-center gap-1.5 text-xs font-medium shadow-subtle shrink-0 cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-shield-emerald shrink-0" />
            {sug}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="relative mt-1 mb-2 sm:mb-3"
      >
        {/* Clean 𝕏 Account Verification Dropdown */}
        {mentionQuery !== null && suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-white/95 backdrop-blur-md border border-butter-300 rounded-2xl shadow-elevated p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2">
            <div className="max-h-48 overflow-y-auto divide-y divide-butter-100">
              {suggestions.map((item, idx) => {
                const isSelected = idx === selectedSuggestionIndex;
                return (
                  <button
                    key={item.xHandle + idx}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion(item);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-butter-100 border border-butter-300 text-brown-900 shadow-sm"
                        : "hover:bg-butter-50 text-brown-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Image
                        src={item.avatarUrl || `https://unavatar.io/twitter/${item.xHandle}`}
                        alt={item.xHandle}
                        width={32}
                        height={32}
                        unoptimized
                        className="w-8 h-8 rounded-full object-cover shrink-0 border border-butter-200 bg-brown-900 text-[9px] text-butter-100 font-bold"
                      />
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-brown-900 truncate">
                            {item.displayName}
                          </span>
                          {item.verified && (
                            <span className="text-[10px] text-sky-500 font-bold" title="Verified on 𝕏">✓</span>
                          )}
                        </div>
                        <div className="text-[11px] text-brown-500 font-medium">
                          @{item.xHandle}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-brown-400 text-xs font-mono pr-1">
                      ↵
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask Veil: tip @expatq3 5 USDC, invoice 10 NEAR, claim payouts..."
          disabled={isProcessing}
          className="w-full bg-white border border-butter-300 rounded-2xl py-3 sm:py-3.5 pl-3.5 sm:pl-4 pr-11 sm:pr-12 text-xs sm:text-sm text-brown-900 placeholder-brown-400 focus:outline-none focus:border-brown-800 transition shadow-subtle"
        />

        <button
          type="submit"
          disabled={!input.trim() || isProcessing}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-brown-900 hover:bg-brown-800 disabled:opacity-40 disabled:hover:bg-brown-900 text-butter-100 transition shadow-sm"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Slide-over Activity & Invoices Drawer */}
      {showDrawer && (
        <div className="absolute top-12 right-2 sm:right-4 w-[calc(100vw-2rem)] max-w-xs bg-white border border-butter-300 rounded-2xl shadow-elevated p-4 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-3 border-b border-butter-200 mb-3">
            <span className="text-xs font-bold text-brown-900 uppercase tracking-wider">
              Recent Activity & Links
            </span>
            <button
              onClick={() => setShowDrawer(false)}
              className="p-1 rounded-lg hover:bg-butter-100 text-brown-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto">
            {drawerTransactions.length === 0 ? (
              <div className="text-center py-6 text-[11px] text-brown-400">
                No recent activity yet. Send tips or claim payouts to see them here.
              </div>
            ) : (
              drawerTransactions.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl bg-butter-50 border border-butter-200 flex items-center justify-between text-xs"
                >
                  <div className="truncate mr-2">
                    <div className="font-semibold text-brown-900 truncate">{item.counterparty || item.title}</div>
                    <div className="text-[10px] text-brown-500">
                      {item.type.replace(/_/g, " ")} • {item.timestamp}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-brown-900">
                      {item.isInflow ? "+" : "-"}${item.amountUsd.toFixed(2)}
                    </div>
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                        !item.isInflow || item.status === "claimed" || item.status === "completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.statusLabel || (!item.isInflow ? "Sent" : item.status)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Omnichain Deposit Modal */}
      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
      />

      {/* Styled Clear History Modal */}
      <ConfirmModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={confirmClearChat}
        title="Clear Conversation History"
        description="Are you sure you want to clear your conversation history? Your active sessions and transactions will remain safe."
        confirmText="Clear History"
        variant="danger"
      />
    </div>
  );
}
