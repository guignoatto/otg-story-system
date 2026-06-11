import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pacotes nativos/CJS que não devem ser empacotados pelo bundler do servidor.
  serverExternalPackages: ["sharp", "heic-convert"],
  // O binário nativo do sharp para linux-x64 é carregado dinamicamente em runtime
  // e o file tracing da Vercel não detecta essa dependência sozinho.
  outputFileTracingIncludes: {
    "/api/ai-images/generate": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
};

export default nextConfig;
