"use client";

import React from "react";
import Link from "next/link";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center p-6 text-[#1E1315]">
      <div className="max-w-md w-full bg-white border border-[#EBE3D5] rounded-3xl p-8 shadow-xl text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
          <Compass className="w-6 h-6" />
        </div>
        <h2 className="font-serif text-2xl font-bold">Page Not Found</h2>
        <p className="text-xs text-[#6E5D4F] leading-relaxed">
          The requested page or route does not exist.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="w-full py-2.5 px-4 rounded-xl bg-[#1E1315] text-[#FAF7F0] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#2C1D20] transition inline-flex"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Terminal</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
