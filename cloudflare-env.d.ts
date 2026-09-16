declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    MONITOR_PASSWORD?: string;
    MONITOR_AUTH_SECRET?: string;
  }
}
