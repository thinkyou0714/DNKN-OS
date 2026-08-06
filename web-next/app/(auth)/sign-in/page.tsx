"use client";

import { type FormEvent, useState } from "react";
import { supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

type Status = "disabled" | "idle" | "sending" | "sent" | "error";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>(supabaseConfigured() ? "idle" : "disabled");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/account` },
      });
      setStatus(error ? "error" : "sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section>
      <div className="container" style={{ maxWidth: 460 }}>
        <h1 className="section-title">ログイン</h1>
        <p className="section-sub">メールアドレスにログインリンクを送ります（パスワード不要）。</p>

        {status === "disabled" ? (
          <div className="card">
            <p>
              認証は<strong>準備中</strong>です（Supabase 接続後に有効化されます）。
              いまは無料アプリをそのままご利用いただけます。
            </p>
            <p style={{ marginTop: 12 }}>
              <a className="btn btn-ghost" href="/">
                トップへ戻る
              </a>
            </p>
          </div>
        ) : status === "sent" ? (
          <div className="card">
            <p>
              <strong>{email}</strong> にログインリンクを送りました。メールを確認してください。
            </p>
          </div>
        ) : (
          <form className="card" onSubmit={onSubmit}>
            <label htmlFor="email" style={{ display: "block", marginBottom: 8, color: "var(--ink-soft)" }}>
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid var(--line)",
                marginBottom: 16,
                font: "inherit",
              }}
            />
            <button className="btn btn-primary" type="submit" disabled={status === "sending"}>
              {status === "sending" ? "送信中…" : "ログインリンクを送る"}
            </button>
            {status === "error" && (
              <p style={{ color: "var(--vermilion-ink)", marginTop: 12 }}>
                送信に失敗しました。時間をおいて再度お試しください。
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
