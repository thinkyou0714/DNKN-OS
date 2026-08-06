/**
 * scripts/supervision-io.ts — テンプレ監修台帳の入出力（scripts 共通）。
 *
 * 台帳（data/supervision/templates.json）は次の3箇所から読まれる:
 *   - supervision-templates.ts … 状況表示・パケット生成・監修記録
 *   - audit-status.ts          … 要再監修・孤児を品質ゲートに載せる
 *   - build-problems.ts        … 監修済みテンプレから生成した問題へ監修フラグを伝播する
 * パスと読み書きの作法を1箇所に集約し、ズレを防ぐ（problems-io.ts と同じ役割）。
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyLedger, parseLedger, type TemplateSupervisionLedger } from "../lib/audit/template-supervision.js";
import { atomicWriteFileSync } from "./shared.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** 監修台帳のパス（リポジトリ唯一の正）。 */
export const TEMPLATE_LEDGER_PATH = join(__dirname, "../data/supervision/templates.json");

/**
 * 台帳を読む。ファイルが無い/壊れている場合も空台帳を返し、例外は投げない
 * （監修記録が読めないだけでビルドや監査を止めない。壊れていれば「未監修」に倒れるので安全側）。
 */
export function loadTemplateLedger(path: string = TEMPLATE_LEDGER_PATH): TemplateSupervisionLedger {
  if (!existsSync(path)) return emptyLedger();
  try {
    return parseLedger(readFileSync(path, "utf8"));
  } catch {
    return emptyLedger();
  }
}

/** 台帳を書く（項目は upsertLedgerEntry が topic 順に並べるので差分が読みやすい）。 */
export function saveTemplateLedger(ledger: TemplateSupervisionLedger, path: string = TEMPLATE_LEDGER_PATH): void {
  // 初回実行時は data/supervision/ がまだ無いことがある。
  mkdirSync(dirname(path), { recursive: true });
  atomicWriteFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`);
}
