import type { NextConfig } from "next";

// DENKEN-OS Next.js 16 移行アプリの設定。
// 収益化は休眠設計: 課金 UI は NEXT_PUBLIC_BILLING_ENABLED（既定 false）で gate する。

// 応答セキュリティヘッダ（静的・全ルート）。安全に効く最小セット。
// 注: 厳格な nonce-CSP（script-src 'self' 'nonce' 'strict-dynamic'）は T06 で proxy.ts に実装予定
//     （Next16 の hydration inline script と両立させるため runtime 検証が要る）。ここでは CSP を除く安全ヘッダのみ。
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

// 後続タスク（docs/monetization/goals/GOALS.md）:
//   T02 @denken/core(lib) workspace 化 / T04 既存 web/ ロジック移植 / T05 Serwist offline SW（要 `next build --webpack`）
//   T06 nonce-CSP proxy.ts / T07 CI・Vercel・post-build secret scan / T10-T18 auth・Stripe。
const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
