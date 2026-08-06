import { describe, expect, it } from "vitest";
import { CHOSEN_MAX_LEN, LocalProgress } from "../../web/src/store.js";
import { MemoryStorage } from "../helpers/storage.js";

const DAY = 86_400_000;

describe("LocalProgress（ブラウザ進捗・FSRS）", () => {
  it("正解を記録し FSRS 状態を更新・永続化する（reps が増え、次回は未来に予定）", () => {
    const p = new LocalProgress(new MemoryStorage());
    const now = Date.UTC(2026, 0, 10);
    p.record("三相交流電力", true, now);
    const view = p.record("三相交流電力", true, now);
    const st = p.getCardView("三相交流電力");
    expect(st?.reps).toBe(2);
    expect(view.dueMs).toBeGreaterThan(now); // 次回復習は未来に予定される
    expect(p.logs().length).toBe(2);
  });

  it("4段階評価で記録できる（again=やり直し、easy=正解）", () => {
    const p = new LocalProgress(new MemoryStorage());
    const now = Date.UTC(2026, 0, 10);
    p.record("機械", "again", now);
    p.record("機械", "easy", now);
    const logs = p.logs();
    expect(logs[0]?.rating).toBe("again");
    expect(logs[0]?.correct).toBe(false);
    expect(logs[1]?.rating).toBe("easy");
    expect(logs[1]?.correct).toBe(true);
  });

  it("problemId を記録できる（問題単位分析の素地）", () => {
    const p = new LocalProgress(new MemoryStorage());
    p.record("三相交流電力", true, Date.UTC(2026, 0, 10), 3000, "T-0001");
    expect(p.logs()[0]?.problemId).toBe("T-0001");
  });

  it("復習期限が来た topic を due として返す（未来 now で期限到来）", () => {
    const p = new LocalProgress(new MemoryStorage());
    const now = Date.UTC(2026, 0, 10);
    p.record("理論", true, now);
    // 直後は due ではない（未来に予定）。
    expect(p.dueTopics(now)).not.toContain("理論");
    // 100日後には期限到来。
    expect(p.dueTopics(now + 100 * DAY)).toContain("理論");
  });

  it("目標保持率を設定・取得できる（既定0.9、範囲外はクランプ）", () => {
    const storage = new MemoryStorage();
    const p = new LocalProgress(storage);
    expect(p.desiredRetention()).toBe(0.9);
    p.setDesiredRetention(0.85);
    expect(new LocalProgress(storage).desiredRetention()).toBe(0.85);
    p.setDesiredRetention(0.5); // 下限0.7にクランプ
    expect(new LocalProgress(storage).desiredRetention()).toBe(0.7);
  });

  it("連続学習日数を数える（今日まで連続）", () => {
    const p = new LocalProgress(new MemoryStorage());
    const today = Date.UTC(2026, 0, 10);
    p.record("理論", true, today - 2 * DAY);
    p.record("理論", true, today - 1 * DAY);
    p.record("理論", false, today);
    expect(p.streakDays(today)).toBe(3);
  });

  it("途切れた場合は連続日数がリセットされる", () => {
    const p = new LocalProgress(new MemoryStorage());
    const today = Date.UTC(2026, 0, 10);
    p.record("理論", true, today - 5 * DAY); // 飛んでいる
    p.record("理論", true, today);
    expect(p.streakDays(today)).toBe(1);
  });

  it("別インスタンスでも同じ Storage を共有すれば復元できる", () => {
    const storage = new MemoryStorage();
    const a = new LocalProgress(storage);
    a.record("機械", false, Date.UTC(2026, 0, 10));
    const b = new LocalProgress(storage);
    expect(b.logs().length).toBe(1);
    expect(b.getCardView("機械")).toBeDefined();
  });

  // ---- II-6: dueCountCached メモ化（renderNav の重い revive を間引く）----

  it("dueCountCached は同条件の dueTopics().length と一致する", () => {
    const p = new LocalProgress(new MemoryStorage());
    const now = Date.UTC(2026, 0, 10);
    p.record("理論", true, now);
    p.record("電力", true, now);
    const future = now + 100 * DAY;
    expect(p.dueCountCached(future)).toBe(p.dueTopics(future).length);
    // 期限前は 0 件。
    expect(p.dueCountCached(now)).toBe(p.dueTopics(now).length);
  });

  it("record 後はキャッシュが無効化され、新しい due 件数を返す", () => {
    const p = new LocalProgress(new MemoryStorage());
    const now = Date.UTC(2026, 0, 10);
    const future = now + 100 * DAY;
    p.record("理論", true, now);
    expect(p.dueCountCached(future)).toBe(1); // 乗せる
    // 別 topic を追加すると due 件数が増える（キャッシュは record で破棄）。
    p.record("電力", true, now);
    expect(p.dueCountCached(future)).toBe(2);
    expect(p.dueCountCached(future)).toBe(p.dueTopics(future).length);
  });

  it("同一分・同一カードなら2回目はキャッシュ値（dueTopics と一致を維持）", () => {
    const p = new LocalProgress(new MemoryStorage());
    const now = Date.UTC(2026, 0, 10);
    const future = now + 100 * DAY;
    p.record("理論", true, now);
    const a = p.dueCountCached(future);
    const b = p.dueCountCached(future);
    expect(a).toBe(b);
    expect(a).toBe(p.dueTopics(future).length);
  });

  it("clearDueCountCache 後も正しい件数を返す", () => {
    const p = new LocalProgress(new MemoryStorage());
    const now = Date.UTC(2026, 0, 10);
    const future = now + 100 * DAY;
    p.record("理論", true, now);
    p.dueCountCached(future);
    p.clearDueCountCache();
    expect(p.dueCountCached(future)).toBe(p.dueTopics(future).length);
  });

  it("setDesiredRetention はキャッシュを破棄する", () => {
    const p = new LocalProgress(new MemoryStorage());
    const now = Date.UTC(2026, 0, 10);
    const future = now + 100 * DAY;
    p.record("理論", true, now);
    p.dueCountCached(future);
    p.setDesiredRetention(0.8);
    // retention 変更後も dueTopics と一致する（再計算される）。
    expect(p.dueCountCached(future)).toBe(p.dueTopics(future).length);
  });

  // ---- #34/#35: 試験日逆算スケジューリングの配線 ----

  it("試験日を渡すと直前期(<=14日)で cramMode が立つ", () => {
    const storage = new MemoryStorage();
    // 試験日を今日から10日後（JST）に置く。daysUntil は Date.now() 基準のため、
    // 「直近の日付」を ISO で作る。
    const soon = new Date(Date.now() + 10 * DAY).toISOString().slice(0, 10);
    const p = new LocalProgress(storage, undefined, soon);
    expect(p.cramMode()).toBe(true);
  });

  it("試験日が遠い/未設定なら cramMode は立たない", () => {
    const far = new Date(Date.now() + 200 * DAY).toISOString().slice(0, 10);
    expect(new LocalProgress(new MemoryStorage(), undefined, far).cramMode()).toBe(false);
    // 試験日未設定（従来挙動）
    expect(new LocalProgress(new MemoryStorage()).cramMode()).toBe(false);
  });

  it("setExamDate で直前モードが切り替わる（遠い→近い）", () => {
    const p = new LocalProgress(new MemoryStorage());
    expect(p.cramMode()).toBe(false);
    const soon = new Date(Date.now() + 5 * DAY).toISOString().slice(0, 10);
    p.setExamDate(soon);
    expect(p.cramMode()).toBe(true);
    p.setExamDate(null);
    expect(p.cramMode()).toBe(false);
  });

  it("試験日逆算でも dueCountCached は dueTopics().length と一致する", () => {
    const soon = new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10);
    const p = new LocalProgress(new MemoryStorage(), undefined, soon);
    const now = Date.now();
    p.record("理論", true, now);
    const future = now + 100 * DAY;
    expect(p.dueCountCached(future)).toBe(p.dueTopics(future).length);
  });

  it("試験日を渡しても従来の記録・復元は壊れない（後方互換）", () => {
    const storage = new MemoryStorage();
    const far = new Date(Date.now() + 300 * DAY).toISOString().slice(0, 10);
    const a = new LocalProgress(storage, undefined, far);
    a.record("機械", true, Date.UTC(2026, 0, 10));
    const b = new LocalProgress(storage, undefined, far);
    expect(b.logs().length).toBe(1);
    expect(b.getCardView("機械")).toBeDefined();
  });

  it("誤答時だけ選んだ答えを記録する（誤概念分析の素材・正解時は残さない）", () => {
    const p = new LocalProgress(new MemoryStorage());
    p.record("三相交流電力", "again", Date.UTC(2026, 0, 10), 1000, "T-0001", "173.2");
    p.record("三相交流電力", "good", Date.UTC(2026, 0, 10), 1000, "T-0002", "100");
    const logs = p.logs();
    expect(logs[0]?.chosen).toBe("173.2");
    // 正解のログには chosen を持たせない（誤答の分析にしか使わないため）。
    expect(logs[1]?.chosen).toBeUndefined();
  });

  it("選んだ答えは長さを切り詰めて保存する（ログの肥大で quota を潰さない）", () => {
    const p = new LocalProgress(new MemoryStorage());
    p.record("理論", false, Date.UTC(2026, 0, 10), 1000, "T-0001", "9".repeat(200));
    expect((p.logs()[0]?.chosen ?? "").length).toBe(CHOSEN_MAX_LEN);
  });

  it("空文字・未指定の chosen は保存しない", () => {
    const p = new LocalProgress(new MemoryStorage());
    p.record("理論", false, Date.UTC(2026, 0, 10), 1000, "T-0001", "   ");
    p.record("電力", false, Date.UTC(2026, 0, 10), 1000, "T-0002");
    expect(p.logs()[0]?.chosen).toBeUndefined();
    expect(p.logs()[1]?.chosen).toBeUndefined();
  });

  it("日境界は既定 JST（UTC 22時=JST翌07時の学習が『今日』に入る）", () => {
    const p = new LocalProgress(new MemoryStorage()); // 既定 JST(+9h)
    // 2026-01-10T22:00:00Z = JST 2026-01-11 07:00。JST では「11日」の学習。
    p.record("理論", true, Date.UTC(2026, 0, 10, 22, 0), 10 * 60_000);
    // now = JST 2026-01-11 09:00 → 同じ JST 日なので今日の学習時間に算入される。
    const nowJst11 = Date.UTC(2026, 0, 11, 0, 0);
    expect(p.todayMinutes(nowJst11)).toBe(10);
    // 参考: UTC 日境界(offset=0)なら別日扱いで 0 分になる。
    const utc = new LocalProgress(new MemoryStorage(), 0);
    utc.record("理論", true, Date.UTC(2026, 0, 10, 22, 0), 10 * 60_000);
    expect(utc.todayMinutes(nowJst11)).toBe(0);
  });
});
