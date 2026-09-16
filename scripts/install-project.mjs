import { spawnSync } from "node:child_process";
if (!process.env.npm_execpath?.includes("pnpm")) {
  throw new Error("Use pnpm run install:ci with the pinned pnpm version.");
}
const result = spawnSync(process.execPath, [
  process.env.npm_execpath, "install", "--frozen-lockfile", "--prefer-offline",
], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
