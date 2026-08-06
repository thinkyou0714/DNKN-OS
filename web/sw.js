// Service Worker — app shell を cache-first でキャッシュし、オフラインで動かす。
// 静的アセットは cache-first（調査の定石）。問題データもキャッシュして完全オフライン化。
// ★web/ のアセット(dist/app.js 等)を変更したらこの版数を必ず上げること。版数を上げると
//   このファイルのバイトが変わり SW 更新が走り、activate で旧キャッシュを破棄して新バンドルを取り直す。
//   (v3: numeric採点の空入力是正・数値比較・JST日境界・直近重複回避を配信)
//   (v4: タブ型SPA・FSRS・模試/復習/間違いノート/進捗/公式/設定・数式整形・220問を配信)
//   (v5: 一次フル模試の科目別足切り判定・学習ヒートマップを配信)
//   (v6: 図解(回路図/ベクトル図/ブロック図/特性曲線のインラインSVG)・構造化解説を配信)
//   (v7: UI刷新 — デザインシステム/ダーク最適化/セグメントタブ/カード磨き/モーションを配信)
//   (v8: テーマ切替/スパークライン/空状態/スケルトン/ヒートマップセル/目標リング/更新トースト)
//   (v9: モバイル下部タブバー(親指リーチ)・タブアイコン・印刷スタイルを配信)
//   (v10: 二次記述の部分点ルーブリック自己採点を配信)
//   (v11: 質問タブ＝AIチャット（内蔵ナレッジ＋BYOK Claude・RAG接地・出典付き）を配信)
//   (v12: 品質向上 — 模試時間制限の本実装＋見直し・バックアップ・ヒント開示・公式検索・
//         番号バッジ・経過時間・目標達成トースト・オンボーディング・読込リトライ・保存安全化)
//   (v13: 信頼性/a11y/リテンション — エラーバウンダリ・オフライン表示・復習1日上限バッチ化・
//         ストリーク予兆ナッジ・タブのrole=tab/矢印キー操作)
//   (v14: ゲーミフィケーション基盤 — XP/レベル/称号・デイリークエスト・ストリークお守り・
//         実績バッジ・マスコット「デンタマ」・紙吹雪/効果音/XPフロート・週間XP・
//         数値空入力ガード・模試中断確認)
//   (v15: 継続強化第2弾 — ウィークリークエスト・科目別XP・次称号ティーザー・自分の記録・
//         キーボード評価(1〜3)・「あと1問」ナッジ・デンタマ微アニメ/非表示設定・
//         マイクロモーション・グローバルエラー捕捉・再表示時のお守りブリッジ)
//   (v16: 節目と導線 — 目標設定ウィザード・セッション終了サマリー(明日のクエスト予告)・
//         ストリーク大台祝賀(30/50/100…)・実績3種追加(初マスター/無傷の三十日/月間皆勤賞)・
//         マスター論点チップ・ゴーストレース・ショートカットヘルプ(?)・A2HS導線・コンボ発光)
//   (v17: 報酬と健全性 — クエスト全達成後の正解XP×1.5ブースト・おやすみ予約(🔥維持)・
//         デンタマ成長(Lv10星/Lv20ヘルメット/Lv40王冠)＋まめ知識12種・効果音音量4段階・
//         実績タップでシェア・ヘルプのカード内クリック誤閉じ修正)
//   (v18: 問題データ拡充 — テンプレ88種・788問(法規77/MC49)を配信。出荷済み405問のIDは温存し、新規は内容由来の安定ID)
//   (v19: リファクタ — 分割バンドル・保存失敗可視化(lastPersistError)・日付ユーティリティ一元化・
//         sanitizeSvg・SW堅牢化(fetch失敗フォールバック・install失敗時skipWaiting抑制))
//   (v20: Wave2リファクタ — CSP/SRI・SW版数自動化・RLS補完・fuzz/統合テスト追加)
//   (v21: 最高品質化 — stale-while-revalidate(陳腐化解消)・週次クエスト修正・採点/a11y/試験忠実度の根本是正)
//   (v22: SW堅牢化第2弾 — SRI原子ペア(index.html/app.js)をSWR裏差し替え対象から除外(新HTML×旧JSの
//         SRI不整合による白画面を防止)・clients.claim()をwaitUntil内で待機)
// ★ CACHE の版数は build:web が自動更新する（プレースホルダ置換）。手動編集禁止。
const CACHE = "denken-os-v22-dc68bb56";
// 問題データは科目別シャード（分割ロード）＋ combined フォールバックの両方をプリキャッシュする。
// シャード一覧は科目の固定集合（6科目）に対応し、lib/shared/problem-shards.ts の SUBJECT_SLUGS と
// 一致させること（該当0件の科目でも空配列シャードが必ず出力されるため 404 にならない）。
const ASSETS = [
  "./",
  "./index.html",
  "./dist/app.js",
  "./problems.json",
  "./problems/manifest.json",
  "./problems/theory.json",
  "./problems/power.json",
  "./problems/machine.json",
  "./problems/law.json",
  "./problems/power-mgmt.json",
  "./problems/machine-ctrl.json",
  "./manifest.webmanifest",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting()),
    // addAll が失敗した場合（ネットワークエラー等）は skipWaiting しない。
    // アクティブ化を保留することで、破損したキャッシュが使われるのを防ぐ。
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      // claim も waitUntil 内で待つ（activate 完了前に取りこぼさない）。
      .then(() => self.clients.claim()),
  );
});

// SRI で結ばれた原子ペア: index.html は dist/app.js の SRI ハッシュ（sha384）を埋め込むため、
// 片方だけ裏で差し替わると 新HTML×旧JS（またはその逆）となり SRI 検証に失敗して白画面になる。
// この2つ（と "./"）は install の addAll でのみ「原子的に」更新し、SWR の裏差し替え対象から外す。
// CACHE 版数はプリキャッシュ全アセットの内容ハッシュ（build:web）なので、どちらかが変わる
// 配信では必ず sw.js のバイトが変わり SW 更新→新キャッシュへの一括切替が走る（＝陳腐化しない）。
function isSriAtomicPair(request) {
  const path = new URL(request.url).pathname;
  return path.endsWith("/") || path.endsWith("/index.html") || path.endsWith("/dist/app.js");
}

// stale-while-revalidate: キャッシュを即返ししつつ裏でネットワーク更新する（web#3）。
// 純 cache-first では SW 版数が上がるまで problems.json / index.html が陳腐化したままだったため、
// オンライン時は次回読込で最新が反映されるよう、取得成功時にキャッシュを差し替える。
// ただし SRI 原子ペア（index.html / dist/app.js）は上記の理由で裏差し替えしない。
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached && isSriAtomicPair(request)) return cached;
  const network = fetch(request)
    .then((res) => {
      // 同一オリジンの正常応答のみ保存（opaque/エラー応答はキャッシュ汚染を避けて保存しない）。
      // SRI 原子ペアは install 時の addAll だけがキャッシュを書く。
      if (res?.ok && res.type === "basic" && !isSriAtomicPair(request)) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  if (cached) {
    network.catch(() => {}); // 裏で更新（失敗は無視）。
    return cached;
  }
  const res = await network;
  if (res) return res;
  // オフライン かつ 未キャッシュ: ナビゲーションは app shell へフォールバック。
  if (request.mode === "navigate") {
    const shell = await cache.match("./");
    if (shell) return shell;
  }
  return Response.error();
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // 同一オリジンのみ SW が扱う（外部 API 等は素通し）。
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(staleWhileRevalidate(event.request));
});
