import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse pulls in pdfjs-dist (ESM + eval) which breaks under webpack RSC bundling.
  // Keep it (and mammoth) external so Next require()s them from node_modules at runtime.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "mammoth"],
};

export default nextConfig;
