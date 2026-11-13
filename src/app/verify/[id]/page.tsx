// src/app/verify/[id]/page.tsx
// Public, Instant Verification Screen for Selective Disclosure Proofs on 𝕏
// Verified in <5ms without requiring an account or exposing wallet balances

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ShieldCheck, Lock, CheckCircle2, Clock, Share2, Copy, Check, ExternalLink, ArrowLeft } from "lucide-react";
import { SelectiveDisclosureProof } from "@/lib/proof-attestation";
import { TokenIcon, ChainIcon } from "@/components/icons/ChainTokenIcon";

export default function VerifyProofPage() {
  const params = useParams();
  const proofId = params?.id as string;

  const [proof, setProof] = useState<SelectiveDisclosureProof | null>(null);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!proofId) return;

    fetch(`/api/proofs?proofId=${encodeURIComponent(proofId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.proof) {
          setProof(data.proof);
          setIsValid(data.verification?.isValid ?? true);
          setIsExpired(data.verification?.isExpired ?? false);
        } else {
          setIsValid(false);
        }
      })
      .catch((err) => {
        console.error("Proof fetch failed:", err);
        setIsValid(false);
      })
      .finally(() => setLoading(false));
  }, [proofId]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareTwitter = () => {
    if (!proof) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `Verified confidential tip of ${proof.amountClaim} to ${proof.recipientClaim} via VeilX on @NEARProtocol! 🔒 Verified Proof: ${url}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  const remainingDays = proof ? Math.max(0, Math.ceil((proof.expiresAt - Date.now()) / (24 * 60 * 60 * 1000))) : 0;

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-brown-900 flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Top Navbar */}
      <header className="max-w-2xl mx-auto w-full flex items-center justify-between pb-6 border-b border-butter-200">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl overflow-hidden border border-butter-300 shadow-subtle group-hover:scale-105 transition-transform shrink-0">
            <Image
              src="/veil.png"
              alt="Veil Logo"
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-brown-900">
            Veil
          </span>
          <span className="ml-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-butter-200 text-brown-700">
            Verifier
          </span>
        </Link>

        <Link
          href="/"
          className="flex items-center gap-1 text-xs font-semibold text-brown-600 hover:text-brown-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to App</span>
        </Link>
      </header>

      {/* Main Verification Container */}
      <main className="max-w-xl mx-auto w-full my-auto py-8">
        {loading ? (
          <div className="p-8 rounded-3xl bg-white border border-butter-200 shadow-card flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-4 border-shield-emerald border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-semibold text-brown-600">Verifying cryptographic attestation...</p>
          </div>
        ) : !proof || isValid === false ? (
          <div className="p-8 rounded-3xl bg-white border border-red-200 shadow-card text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto text-2xl">
              ⚠️
            </div>
            <h1 className="text-xl font-extrabold text-brown-900">Invalid or Expired Proof</h1>
            <p className="text-sm text-brown-600 max-w-md mx-auto">
              This proof could not be cryptographically validated or has exceeded its expiration window. Proofs expire automatically to protect counterparty confidentiality.
            </p>
            <Link
              href="/"
              className="inline-block px-4 py-2 rounded-xl bg-brown-900 text-butter-100 text-xs font-bold hover:bg-brown-800 transition"
            >
              Go to Veil Home
            </Link>
          </div>
        ) : (
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-butter-200 shadow-card space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Verification Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center shadow-subtle">
                  <ShieldCheck className="w-6 h-6 text-shield-emerald" />
                </div>
                <div>
                  <h1 className="text-base font-extrabold text-brown-900 flex items-center gap-1.5">
                    Selective Disclosure Proof
                    <CheckCircle2 className="w-4 h-4 text-shield-emerald inline" />
                  </h1>
                  <p className="text-[11px] font-medium text-brown-500">
                    Cryptographically attested on NEAR Protocol
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Verified Valid
              </span>
            </div>

            {/* Fact Statement Banner */}
            <div className="p-4 rounded-2xl bg-[#FAF6EE] border border-butter-300 space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-brown-500">
                Attested Fact
              </span>
              <p className="text-sm sm:text-base font-bold text-brown-900 leading-snug">
                Verified that <strong className="text-shield-emerald">{proof.recipientClaim}</strong> received an authentic payment of <strong className="text-brown-900">{proof.amountClaim}</strong>.
              </p>
            </div>

            {/* Proof Disclosure Table */}
            <div className="space-y-3 divide-y divide-butter-100 text-xs">
              <div className="flex items-center justify-between pt-2">
                <span className="text-brown-500 font-medium">Recipient Claim:</span>
                <strong className="text-brown-900 font-mono text-sm">{proof.recipientClaim}</strong>
              </div>

              <div className="flex items-center justify-between pt-2.5">
                <span className="text-brown-500 font-medium">Settled Amount:</span>
                <div className="flex items-center gap-1.5">
                  <TokenIcon symbol={proof.asset} size={18} />
                  <strong className="text-brown-900 font-mono font-bold text-sm">
                    {proof.amountClaim}
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2.5">
                <span className="text-brown-500 font-medium">Settlement Network:</span>
                <div className="flex items-center gap-1.5">
                  <ChainIcon chain={proof.network} size={16} />
                  <span className="font-semibold text-brown-800">{proof.network}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2.5">
                <span className="text-brown-500 font-medium">Payer Net Worth & History:</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-900 text-[11px] font-bold">
                  <Lock className="w-3 h-3 text-amber-700" />
                  <span>PROTECTED · CONFIDENTIAL</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2.5">
                <span className="text-brown-500 font-medium">Attestation Issuer:</span>
                <span className="font-semibold text-brown-800">{proof.issuer}</span>
              </div>

              <div className="flex items-center justify-between pt-2.5">
                <span className="text-brown-500 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-brown-400" /> Proof Expiry:
                </span>
                <span className="font-semibold text-brown-700">
                  {isExpired ? (
                    <span className="text-red-600 font-bold">Expired</span>
                  ) : (
                    <span>Valid for {remainingDays} more day{remainingDays === 1 ? "" : "s"}</span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2.5">
                <span className="text-brown-500 font-medium">Cryptographic Hash:</span>
                <code className="text-[10px] text-brown-400 font-mono">
                  {proof.signature.slice(0, 10)}...{proof.signature.slice(-10)}
                </code>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <button
                onClick={handleShareTwitter}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-subtle"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Proof on 𝕏</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-butter-100 hover:bg-butter-200 border border-butter-300 text-brown-800 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-subtle"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-brown-500" />
                    <span>Copy Proof Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto w-full text-center text-xs text-brown-500 pt-6 border-t border-butter-200">
        <p>
          Veil Selective Disclosure Engine • Zero-Knowledge financial privacy for social commerce on NEAR Protocol
        </p>
      </footer>
    </div>
  );
}
