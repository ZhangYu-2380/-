import { createSessionToken, verifyPassword } from "./auth";

// A bounded per-isolate limit for the mock demo. It is not a global rate limiter.
const attempts = new Map<string, { failures: number; reset: number }>();
const WINDOW_MS = 15 * 60 * 1000;

export async function authenticate(request: Request, password: string) {
  const address = request.headers.get("cf-connecting-ip") ?? "local";
  const now = Date.now();
  for (const [key, record] of attempts) if (record.reset <= now) attempts.delete(key);
  const record = attempts.get(address) ?? { failures: 0, reset: now + WINDOW_MS };
  if (record.failures >= 10) {
    return { status: 429, error: "尝试次数过多，请 15 分钟后重试。" } as const;
  }
  if (password.length > 512 || !(await verifyPassword(password))) {
    record.failures++;
    if (attempts.size >= 10000 && !attempts.has(address)) {
      return { status: 429, error: "登录繁忙，请稍后重试。" } as const;
    }
    attempts.set(address, record);
    return { status: 401, error: "密码不正确，请重试。" } as const;
  }
  const token = await createSessionToken();
  attempts.delete(address);
  return { status: 200, token } as const;
}
