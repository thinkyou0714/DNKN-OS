import { PricingCta } from "@/components/cta";
import { FEATURES, SITE } from "@/lib/site";

export default function Home() {
  return (
    <>
      <nav className="nav">
        <div className="brand">
          DENKEN<span className="dot">-</span>OS
        </div>
        <div className="nav-links">
          <a href="#features">特徴</a>
          <a href="/pricing">料金</a>
          <a href="/sign-in">ログイン</a>
          <a href={SITE.repoUrl}>GitHub</a>
        </div>
      </nav>

      <header className="hero">
        <div className="container">
          <span className="badge">{SITE.status}</span>
          <h1>{SITE.tagline}</h1>
          <p className="lead">{SITE.description}</p>
          <div className="cta-row">
            <PricingCta planId="free" />
            <a className="btn btn-primary" href="/pricing">
              料金を見る
            </a>
          </div>
        </div>
      </header>

      <section id="features">
        <div className="container">
          <h2 className="section-title">「今日の一問」を合格エンジンに</h2>
          <p className="section-sub">発信は予告編、アプリが本編。量・適応・記録・解説で合格まで運ぶ。</p>
          <div className="grid">
            {FEATURES.map((f) => (
              <article className="card" key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <p>
            {SITE.name} は {SITE.status}。問題データ・ドキュメントは CC-BY-SA-4.0、コードは MIT。
          </p>
          <p>
            <a href="/pricing">料金</a> ・ <a href={SITE.repoUrl}>GitHub</a> ・{" "}
            <a href={SITE.appUrl}>アプリを開く</a>
          </p>
        </div>
      </footer>
    </>
  );
}
