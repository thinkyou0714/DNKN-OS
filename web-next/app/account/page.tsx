import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { resolveTier } from "@/lib/entitlement";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `アカウント — ${SITE.name}` };

export default async function Account() {
  const user = await getCurrentUser();
  const tier = await resolveTier(user?.id ?? null);

  return (
    <section>
      <div className="container" style={{ maxWidth: 560 }}>
        <h1 className="section-title">アカウント</h1>

        {user ? (
          <div className="card">
            <p>
              ログイン中: <strong>{user.email}</strong>
            </p>
            <p style={{ marginTop: 8 }}>
              現在のプラン: <strong>{tier === "pro" ? "Pro" : "無料"}</strong>
            </p>
          </div>
        ) : (
          <div className="card">
            <p>ログインしていません。</p>
            <p style={{ marginTop: 12 }}>
              <a className="btn btn-primary" href="/sign-in">
                ログイン
              </a>
            </p>
            <p className="note" style={{ textAlign: "left", marginTop: 14 }}>
              ※ 認証は Supabase 接続後に有効化されます（現在は休眠）。無料アプリはログイン不要でご利用いただけます。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
