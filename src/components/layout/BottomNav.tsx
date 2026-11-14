"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, MessageSquare, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [unclaimedCount, setUnclaimedCount] = useState<number>(0);

  useEffect(() => {
    if (user?.xHandle) {
      fetch(`/api/near/pending-tips?handle=${encodeURIComponent(user.xHandle)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.count) setUnclaimedCount(data.count);
          else setUnclaimedCount(0);
        })
        .catch(() => {});
    } else {
      setUnclaimedCount(0);
    }
  }, [user?.xHandle]);

  // Do not display on landing page ("/") or onboarding page ("/onboarding")
  if (pathname === "/" || pathname === "/onboarding") {
    return null;
  }

  const navItems = [
    {
      label: "Terminal",
      href: "/terminal",
      icon: TrendingUp,
      isActive: pathname === "/terminal",
      badge: null,
    },
    {
      label: "Social Pay",
      href: "/chat",
      icon: MessageSquare,
      isActive: pathname === "/chat",
      badge: null,
    },
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      isActive: pathname === "/dashboard",
      badge: unclaimedCount > 0 ? (
        <span
          className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse ring-2 ring-white"
          title={`${unclaimedCount} pending tip(s)`}
        />
      ) : null,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-butter-300 md:hidden flex items-center justify-around h-14 shadow-lg px-2"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center min-h-[44px] h-full flex-1 py-1 rounded-xl transition cursor-pointer select-none ${
              item.isActive
                ? "text-brown-900"
                : "text-brown-500 hover:text-brown-800"
            }`}
          >
            <div
              className={`flex flex-col items-center justify-center px-3 py-1 rounded-xl transition ${
                item.isActive ? "bg-butter-200/70" : ""
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    item.isActive ? "scale-105 stroke-[2.25]" : "stroke-[1.75]"
                  }`}
                />
                {item.badge}
              </div>
              <span
                className={`text-[10px] mt-0.5 tracking-tight ${
                  item.isActive ? "font-bold text-brown-900" : "font-medium text-brown-600"
                }`}
              >
                {item.label}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
