import { describe, expect, it } from "vitest";
import { MASCOT_NAME, mascotCheer, mascotHome, mascotSvg } from "../../web/src/mascot.js";

const base = { streakDays: 3, todayCount: 0, dailyGoal: 10, dueCount: 0, dayIndex: 20000 } as const;

describe("mascotHome（状況に応じた表情と台詞）", () => {
  it("履歴なし（none）は自己紹介で迎える", () => {
    const v = mascotHome({ ...base, streakState: "none", streakDays: 0 });
    expect(v.mood).toBe("happy");
    expect(v.message).toContain(MASCOT_NAME);
  });

  it("ストリーク危機（at-risk）は心配顔で日数に言及する", () => {
    const v = mascotHome({ ...base, streakState: "at-risk", streakDays: 12 });
    expect(v.mood).toBe("worried");
    expect(v.message).toContain("12");
  });

  it("途切れ（broken）はしょんぼり顔で復帰を歓迎する（責めない）", () => {
    const v = mascotHome({ ...base, streakState: "broken", streakDays: 0 });
    expect(v.mood).toBe("sad");
    expect(v.message).not.toContain("ダメ");
  });

  it("目標達成済みは大よろこび", () => {
    const v = mascotHome({ ...base, streakState: "active", todayCount: 10 });
    expect(v.mood).toBe("cheer");
  });

  it("復習が残っていれば件数つきで誘導する", () => {
    const v = mascotHome({ ...base, streakState: "active", todayCount: 3, dueCount: 5 });
    expect(v.message).toContain("5");
  });

  it("進行中は残り問題数を示す", () => {
    const v = mascotHome({ ...base, streakState: "active", todayCount: 4 });
    expect(v.mood).toBe("happy");
    expect(v.message).toContain("6");
  });

  it("台詞は日替わりでローテーションする（慣れ防止）", () => {
    const msgs = new Set(
      [0, 1, 2].map((d) => mascotHome({ ...base, streakState: "at-risk", streakDays: 5, dayIndex: d }).message),
    );
    expect(msgs.size).toBeGreaterThan(1);
  });

  it("同じ日・同じ状況なら同じ台詞（安定）", () => {
    const a = mascotHome({ ...base, streakState: "active", todayCount: 2 });
    const b = mascotHome({ ...base, streakState: "active", todayCount: 2 });
    expect(a).toEqual(b);
  });
});

describe("mascotCheer（解答直後のリアクション）", () => {
  it("コンボ数で台詞が強化される", () => {
    expect(mascotCheer(true, 3)).toContain("3コンボ");
    expect(mascotCheer(true, 5)).toContain("5コンボ");
  });

  it("不正解は励ます（罰しない）", () => {
    const msg = mascotCheer(false, 0);
    expect(msg.length).toBeGreaterThan(0);
    expect(msg).not.toContain("ダメ");
  });
});

describe("mascotSvg（インラインSVG）", () => {
  it("有効なSVG要素でアクセシブルなラベルを持つ", () => {
    for (const mood of ["happy", "cheer", "teach", "worried", "sad", "sleepy"] as const) {
      const svg = mascotSvg(mood);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).toContain('role="img"');
      expect(svg).toContain(MASCOT_NAME);
    }
  });

  it("表情によって異なる描画になる", () => {
    expect(mascotSvg("happy")).not.toBe(mascotSvg("sad"));
    expect(mascotSvg("cheer")).not.toBe(mascotSvg("worried"));
  });

  it("サイズ指定が反映される", () => {
    expect(mascotSvg("happy", 48)).toContain('width="48"');
  });
});
