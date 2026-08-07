/**
 * app-init.ts — 問題データ読込（reloadProblems）。
 * views/practice.ts から参照するための薄いモジュール。
 *
 * ## 分割ロード対応
 * 在庫が数万問規模になると単一 problems.json（数十MB）の一括 fetch/parse が
 * 初期コスト・メモリピークのボトルネックになる。そこで科目別シャード
 * （web/problems/<slug>.json）＋マニフェスト（web/problems/manifest.json）から
 * 読み込む。マニフェストが取れない/壊れている場合（古いキャッシュ等）は従来の
 * combined problems.json にフォールバックする（後方互換・オフライン安全）。
 *
 * II-164: 既読フラグで二重ロード防止。
 * II-165: onlineイベントで自動reloadProblems（app.ts側で登録）。
 */
import type { Problem } from "../../lib/engine/schema.js";
import type { ProblemManifest } from "../../lib/shared/problem-shards.js";
import { MANIFEST_FILE, SHARD_DIR } from "../../lib/shared/problem-shards.js";
import { setLoadFailed, setProblems, setTopicMeta, type TopicMeta } from "./state/app.js";
import { render } from "./views/router.js";

/** 二重ロード防止フラグ（II-164）: すでにロード中のときは重複fetchをしない。 */
let _loading = false;

/** data が Problem[] として最低限妥当か検証する（I-061）。不正なら throw。 */
function assertProblemArray(data: unknown, label: string): asserts data is Problem[] {
  if (!Array.isArray(data)) {
    throw new Error(`${label} は配列である必要があります`);
  }
  if (data.length > 0) {
    const first = data[0] as Record<string, unknown>;
    for (const key of ["id", "statement", "answer", "solution"] as const) {
      if (!(key in first)) {
        throw new Error(`${label} の先頭要素に "${key}" がありません`);
      }
    }
  }
}

/**
 * 科目別シャード + マニフェストから全問題を読み込む（分割ロード）。
 * マニフェスト取得失敗・壊れ・シャード欠落のいずれかで throw し、呼び出し側で
 * combined problems.json にフォールバックさせる。
 *
 * シャードは並列 fetch し、マニフェストの shards 順で結合する（combined と同順）。
 * 全問をメモリに揃える点は従来と同じ（各ビューが科目横断で参照するため）だが、
 * 単一巨大ファイルの一括 parse を避け、科目単位のキャッシュ/更新を可能にする。
 */
async function loadFromShards(): Promise<Problem[]> {
  const res = await fetch(`./${SHARD_DIR}/${MANIFEST_FILE}`);
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  const manifest = (await res.json()) as ProblemManifest;
  if (!manifest || !Array.isArray(manifest.shards) || manifest.shards.length === 0) {
    throw new Error("manifest.shards が不正です");
  }
  // 各シャードを並列取得（順序は manifest に従って後で結合）。
  const shardData = await Promise.all(
    manifest.shards.map(async (s) => {
      const r = await fetch(`./${SHARD_DIR}/${s.file}`);
      if (!r.ok) throw new Error(`shard ${s.file} ${r.status}`);
      const d = (await r.json()) as unknown;
      assertProblemArray(d, `シャード ${s.file}`);
      return d;
    }),
  );
  const all: Problem[] = [];
  for (const d of shardData) all.push(...d);
  // マニフェストの total と実件数の整合（壊れ検知）。total 未指定時はスキップ。
  if (typeof manifest.total === "number" && manifest.total !== all.length) {
    throw new Error(`manifest.total=${manifest.total} と実件数=${all.length} が不一致`);
  }
  return all;
}

/** combined な problems.json から読み込む（フォールバック・後方互換）。 */
async function loadFromCombined(): Promise<Problem[]> {
  const res = await fetch("./problems.json");
  if (!res.ok) throw new Error(String(res.status));
  const data = (await res.json()) as unknown;
  assertProblemArray(data, "problems.json");
  return data;
}

/** 問題データの取得。失敗してもアプリは起動し、学習タブにリトライ導線を出す。
 *
 *  読み込み経路: まず科目別シャード（manifest 駆動）→ 失敗したら combined problems.json。
 *  どちらも失敗したら loadFailed フローへ乗せる。
 *
 *  II-164: visibilitychange等での二重ロードを防ぐ既読フラグ付き。
 */
export async function reloadProblems(): Promise<void> {
  // 二重ロード防止（II-164）。
  if (_loading) return;
  _loading = true;
  try {
    let data: Problem[];
    try {
      data = await loadFromShards();
    } catch (shardErr) {
      // 分割ロードに失敗（古いキャッシュ・部分欠落など）→ combined にフォールバック。
      console.warn("[app] シャード読込に失敗、problems.json にフォールバック:", shardErr);
      data = await loadFromCombined();
    }
    setProblems(data);
    setLoadFailed(false);
    // 出題傾向メタ（頻出度）。取れなくても学習は成立するので失敗は握りつぶす。
    try {
      const r = await fetch(`./${SHARD_DIR}/topic-meta.json`);
      if (r.ok) setTopicMeta((await r.json()) as Record<string, TopicMeta>);
    } catch {
      // オフライン初回など。頻出度バッジが出ないだけで機能は落とさない。
    }
  } catch (err) {
    console.warn("[app] reloadProblems 失敗:", err);
    setProblems([]);
    setLoadFailed(true);
  } finally {
    _loading = false;
  }
  render();
}
