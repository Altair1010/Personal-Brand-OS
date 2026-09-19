import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Piltover",
  description: "AI-assisted marketing operations system",
};

// Root layout: html/body/Providers only. The dashboard shell (AppShell + AuthGate) lives in
// app/(dashboard)/layout.tsx so the (auth) route group can render login/signup without the
// sidebar/topbar and without the auth gate.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
