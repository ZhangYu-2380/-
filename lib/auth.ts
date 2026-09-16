import "server-only";

import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "monitor_auth";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

function monitorPassword() {
  return env.MONITOR_PASSWORD ?? process.env.MONITOR_PASSWORD ?? null;
}

function sessionSecret() {
  return env.MONITOR_AUTH_SECRET ?? process.env.MONITOR_AUTH_SECRET ?? null;
}

function fallbackAllowed() {
  return process.env.NODE_ENV !== "production";
}

async function sha256(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function signature(payload: string) {
  const secret = sessionSecret() ?? (fallbackAllowed() ? "local-demo-secret" : null);
  if (!secret) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
}

export async function verifyPassword(candidate: string) {
  const expected = monitorPassword() ?? (fallbackAllowed() ? "demo123" : null);
  if (!expected || !candidate) return false;
  const [candidateHash, expectedHash] = await Promise.all([
    sha256(candidate),
    sha256(expected),
  ]);
  return equalBytes(candidateHash, expectedHash);
}

export async function createSessionToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `v1:${expiresAt}`;
  const signed = await signature(payload);
  if (!signed) throw new Error("登录服务尚未配置");
  return `v1.${expiresAt}.${signed}`;
}

export async function verifySessionToken(token?: string) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, expiresAtText, received] = parts;
  const expiresAt = Number(expiresAtText);
  if (
    version !== "v1" ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000) ||
    !/^[a-f0-9]{64}$/.test(received ?? "") ||
    expiresAt > Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  ) {
    return false;
  }

  const expected = await signature(`${version}:${expiresAt}`);
  if (!expected) return false;
  return equalBytes(
    new TextEncoder().encode(received),
    new TextEncoder().encode(expected),
  );
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}
