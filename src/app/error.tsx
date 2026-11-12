"use client";

import React, { useEffect } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[VeilX Global Error Boundary Caught]:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center p-6 text-[#1E1315]">
      <div className="max-w-md w-full bg-white border border-[#EBE3D5] rounded-3xl p-8 shadow-xl text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="font-serif text-2xl font-bold">Something went wrong</h2>
        <p className="text-xs text-[#6E5D4F] leading-relaxed">
          {error.message || "An unexpected error occurred while processing this transaction."}
        </p>
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#1E1315] text-[#FAF7F0] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#2C1D20] transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
          <Link
            href="/"
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#FAF7F0] border border-[#EBE3D5] text-[#1E1315] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-white transition"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Back Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
