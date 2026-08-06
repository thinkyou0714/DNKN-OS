import type { Metadata } from "next";
import { PricingCta } from "@/components/cta";
import { PLANS, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `料金 — ${SITE.name}`,
  description: "無料で始めて、Pro で無限に演習。参考書 数冊より安く、弱点に最短で当てる。",
};

export default function Pricing() {
  return (
    <>
      <nav className="nav">
        <div className="brand">
          <a href="/" style={{ textDecoration: "none", color: "inherit" }}>
            DENKEN<span className="dot">-</span>OS
          </a>
        </div>
        <div className="nav-links">
          <a href="/#features">特徴</a>
          <a href={SITE.repoUrl}>GitHub</a>
        </div>
      </nav>

      <section>
        <div className="container">
          <h1 className="section-title">料金</h1>
          <p className="section-sub">
            無料で「今日の一問」。合格まで本気なら Pro で無限に演習。参考書 数冊より安い投資に。
          </p>

          <div className="plans">
            {PLANS.map((plan) => (
              <article className={`plan${plan.highlighted ? " highlight" : ""}`} key={plan.id}>
                <div className="name">{plan.name}</div>
                <div className="price">
                  {plan.price}
                  <span className="period"> {plan.period}</span>
                </div>
                <p className="tagline">{plan.tagline}</p>
                <ul>
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <PricingCta planId={plan.id} />
              </article>
            ))}
          </div>

          <p className="note" id="waitlist">
            ※ {SITE.status} のため、Pro の価格・提供時期は予定です。課金は準備中で、開始時に改めてご案内します。
            <br />
            課金開始時は「特定商取引法に基づく表記」「解約方法」を明示します。虚偽・誇大な表示は行いません。
          </p>
        </div>
      </section>

      <footer>
        <div className="container">
          <p>
            <a href="/">トップ</a> ・ <a href={SITE.repoUrl}>GitHub</a>
          </p>
        </div>
      </footer>
    </>
  );
}
