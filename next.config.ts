import type { NextConfig } from "next";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1];
const assetPrefix = process.env.GITHUB_ACTIONS && repository && !repository.endsWith(".github.io")
  ? `/${repository}`
  : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  assetPrefix,
};

export default nextConfig;
