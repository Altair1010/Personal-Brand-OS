import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "mammoth", "exceljs"],
  outputFileTracingExcludes: {
    "*": [
      "./release/**",
      "./Agent P - report/**",
      "./prisma/*.db",
      "./prisma/*-shadow.db",
      "./prisma/*-from-schema.db",
    ],
  },
  experimental: {
    // Keep compilation in the parent process so NODE_OPTIONS heap sizing is honored.
    // The default build worker was hitting its lower V8 heap ceiling on this repository.
    webpackBuildWorker: false,
    webpackMemoryOptimizations: true,
    parallelServerCompiles: false,
    parallelServerBuildTraces: false,
  },
};

export default nextConfig;
