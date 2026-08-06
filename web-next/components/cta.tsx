import { publicBillingEnabled } from "@/lib/flags";
import { SITE } from "@/lib/site";

/**
 * pricing/LP の CTA。課金 flag（NEXT_PUBLIC_BILLING_ENABLED）で出し分ける。
 * - free: 現行の無料 PWA（GitHub Pages）へ。
 * - pro + flag OFF（既定・休眠）: ウェイトリスト（checkout へは行かせない＝景表法/誤認回避）。
 * - pro + flag ON: Stripe checkout（route は後続 T17 で実装）。
 */
export function PricingCta({ planId }: { planId: "free" | "pro" }) {
  if (planId === "free") {
    return (
      <a className="btn btn-ghost" href={SITE.appUrl}>
        無料で始める
      </a>
    );
  }

  if (!publicBillingEnabled()) {
    return (
      <a className="btn btn-primary" href="#waitlist">
        ウェイトリストに登録
        <span className="btn-sub">（課金は準備中）</span>
      </a>
    );
  }

  return (
    <a className="btn btn-primary" href="/api/stripe/checkout">
      Pro を始める
    </a>
  );
}
