# DENKEN-OS ランディングページ（3訴求軸）

同一プロダクト DENKEN-OS を、訴求軸を変えて3パターンの1枚LPにしたもの。各HTMLは自己完結（外部CSS/JS/フォント読込なし・インラインSVG）。

## ファイル

| ファイル | 訴求軸 | 主な構成 |
|---|---|---|
| `index.html` | — | 3案の比較・選択ハブ（まずここを開く） |
| `lp-a-efficiency.html` | 効率 × 順番 | 忘却曲線SVG／弱点優先出題／繰り返し演習 |
| `lp-b-continuation.html` | 継続 × 共闘 | 今日の一問モック／物語・当事者性／習慣ループ |
| `lp-c-quality-free.html` | 品質 × 完全無料 | AIに答えを書かせない検証パイプライン／比較表／¥0 |
| `favicon.svg` | — | 共有ファビコン |
| `og-template.svg` | — | OGP画像の元テンプレ（SVG） |
| `og.png` | — | OGP画像（1200×630・各LPに wiring 済み） |
| `start.html` | — | A/Bエントリ・ローテータ（sticky割当） |
| `PRE-PUBLISH-CHECKLIST.md` | — | 景表法チェック＋主張→根拠の対応表 |

CTA遷移先はすべて公式Webアプリ `https://thinkyou0714.github.io/denken-os/`。

## プレビュー（PowerShell）

```powershell
# 3案＋ハブをまとめて開く
Get-ChildItem C:\tmp\denken-os-lp\*.html | ForEach-Object { Start-Process $_.FullName }

# ハブだけ開く
Start-Process C:\tmp\denken-os-lp\index.html
```

## A/B テスト

各LPの `<body>` に識別子を付与済み（`data-lp-variant="a|b|c"` / `data-lp-axis`）。計測ツールのイベントに乗せて比較する。

- **GA4 の例**（各LPの `</body>` 直前に貼る。DR計測のみ・PII送信なし）:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"></script>
<script>
  window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
  gtag('js',new Date());
  var v=document.body.dataset.lpVariant;
  gtag('config','G-XXXXXXX',{'lp_variant':v});
  // CTAクリックを計測
  document.querySelectorAll('a[href*="denken-os/"]').forEach(function(a){
    a.addEventListener('click',function(){gtag('event','cta_click',{lp_variant:v})});
  });
</script>
```

- **Plausible の例**（軽量・cookieレス）: `<script defer data-domain="..." src="https://plausible.io/js/script.tagged-events.js"></script>` を入れ、CTAに `class="plausible-event-name=cta_click plausible-event-variant=a"` を付ける。
- **配信の振り分け**: (1) 3案を別URLで出し流入元ごとに割当てる、(2) 入口1枚でランダム振り分け（`Math.random()` で variant を決めて該当ページへ）—いずれも計測は上記イベントで統一。

## GitHub Pages へデプロイ（手動・人間側で実行）

> このLP群は DENKEN-OS 本体リポジトリ（`thinkyou0714/denken-os`）の公開物になり得るため、**push/デプロイはユーザーが明示的に実行**すること（本エージェントは実施しない）。

```powershell
# 例: 本体リポジトリの web/lp/ に配置して Pages で公開する場合
$repo = "C:\work\lab\apps\denken-os"
New-Item -ItemType Directory -Force "$repo\web\lp"
Copy-Item C:\tmp\denken-os-lp\*.html,C:\tmp\denken-os-lp\*.svg "$repo\web\lp\"
# 内容を確認してからコミット（パスは明示・-A は使わない）
git -C $repo add web/lp/index.html web/lp/lp-a-efficiency.html web/lp/lp-b-continuation.html web/lp/lp-c-quality-free.html web/lp/favicon.svg web/lp/og-template.svg
git -C $repo commit -m "docs(lp): add DENKEN-OS landing pages (3 axes)"
git -C $repo push --no-verify
```

デプロイ後、公開URLに合わせて各LPの `canonical` / `og:url`（現状 `/lp/` を仮置き）を修正。

## OGP画像

**生成・wiring済み**：`og.png`（1200×630, `og-template.svg` から Chrome headless で生成）を各LPの `og:image` / `twitter:card=summary_large_image` に設定済み。ページ表示は変わらず、SNSシェア時のカードに反映される。軸ごとに差し替えたい場合のみ、`og-template.svg` を複製して `og-a.png` 等を作り、各LPの `og:image` を個別URLに変更:

```html
<meta property="og:image" content="https://thinkyou0714.github.io/denken-os/lp/og-a.png">
<meta name="twitter:card" content="summary_large_image">
```

## 既知の残・注意

- **収録問題は拡充中**（validated 少数・web版はデモ問題）。「豊富な過去問」等の将来訴求は現状足さない。
- **異モデル独立レビュー未実施**（fugu 課金枠切れ）。クレジット復旧後に再ヘッジ推奨。
- CTA/GitHubリンク到達確認済み（app 200 / repo 200・2026-07-04）。公開後URLでも再確認推奨。
- 配布用一括ZIP：`C:\tmp\denken-os-lp.zip`（デプロイは上記手順で人間側が実行）。
- 公開前に必ず `PRE-PUBLISH-CHECKLIST.md` を通す。
