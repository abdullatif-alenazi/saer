import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages serves this repository below /saer rather than at the domain root.
  output: "export",
  basePath: process.env.GITHUB_ACTIONS ? "/saer" : "",
  trailingSlash: true,
};

export default nextConfig;
