import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pacotes nativos/CJS que não devem ser empacotados pelo bundler do servidor.
  serverExternalPackages: ["sharp", "heic-convert"],
};

export default nextConfig;
