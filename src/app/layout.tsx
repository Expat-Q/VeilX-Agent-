import type { Metadata } from "next";
import "./globals.css";
import { HeaderNav } from "@/components/layout/HeaderNav";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "Veil — Autonomous Omnichain Finance & Tokenized Equities",
  description: "Autonomous trading copilot for tokenized equities, cross-chain PayLinks, and social finance powered by NEAR Protocol.",
  icons: {
    icon: "/veil.png",
    shortcut: "/veil.png",
    apple: "/veil.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-butter-100 text-brown-900 flex flex-col antialiased selection:bg-butter-300 overflow-x-hidden max-w-full">
        <AuthProvider>
          <HeaderNav />
          <main className="flex-1 flex flex-col">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
