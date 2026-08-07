/**
 * テンプレート: 低圧幹線の許容電流（法規・低圧屋内配線・numeric）。
 *   電技解釈第148条: 低圧幹線に必要な許容電流 IW は、電動機等の定格電流合計 IM と
 *   それ以外の負荷の定格電流合計 IH から次で決まる。
 *     IM ≤ 50A のとき  IW ≥ 1.25·IM + IH
 *     IM > 50A のとき  IW ≥ 1.10·IM + IH
 *   （電動機の始動電流を見込んだ割増。50A を境に割増率が変わるのが要点）
 *
 * 典型ミス（解説で言及）:
 *   ・50A の境界を取り違えて割増率を逆に適用する
 *   ・電動機以外の負荷 IH にも割増率を掛ける
 *   ・割増を忘れて単純な合計 IM+IH とする
 */
import { formatClean, isCleanAnswer } from "../clean.js";
import { defineTemplate, pick } from "./helpers.js";

/** 電動機等の定格電流の合計〔A〕。50A の前後を両方含める（境界の判断を問うため）。 */
const IM_SET: ReadonlyArray<number> = [
  10, 15, 20, 24, 25, 30, 32, 35, 40, 44, 45, 48, 50, 55, 60, 64, 65, 70, 75, 80, 85, 90, 100, 110, 120,
];
/** 電動機以外の負荷の定格電流の合計〔A〕。 */
const IH_SET: ReadonlyArray<number> = [0, 5, 10, 15, 20, 25, 30, 40, 50];

type Params = {
  motor_current: number;
  other_current: number;
};

export const mainLineAllowableCurrent = defineTemplate<Params>({
  topic: "低圧幹線の許容電流",
  subject: "法規",
  exam: "denken2_primary",
  difficulty: 3,
  pastExam: {
    area: "低圧・引込・屋内配線",
    frequency: "mid",
    years: [2009, 2013, 2018, 2023],
    note: "電技解釈148条: IM≤50Aで1.25倍、IM>50Aで1.1倍。境界の判断が頻出",
  },
  paramSpecs: {
    motor_current: { unit: "A", realistic_range: [5, 150] },
    other_current: { unit: "A", realistic_range: [0, 50] },
  },
  paramOrder: ["motor_current", "other_current"],
  draw(rng) {
    return { motor_current: pick(IM_SET, rng), other_current: pick(IH_SET, rng) };
  },
  buildFrom({ motor_current: im, other_current: ih }) {
    if (im <= 0 || ih < 0) return null;
    const factor = im <= 50 ? 1.25 : 1.1;
    const iw = factor * im + ih;
    if (!isCleanAnswer(iw)) return null;
    const answerText = formatClean(iw);
    const boundary = im <= 50 ? "50A以下" : "50Aを超える";
    return {
      format: "numeric",
      params: {
        motor_current: { value: im, unit: "A", realistic_range: [5, 150] },
        other_current: { value: ih, unit: "A", realistic_range: [0, 50] },
      },
      answerValue: iw,
      answerUnit: "A",
      answerText,
      facts: { im, ih, factor, iw },
      defaultStatement:
        `低圧屋内幹線に、電動機の定格電流の合計が IM=${formatClean(im)}A、` +
        `電動機以外の負荷の定格電流の合計が IH=${formatClean(ih)}A の負荷が接続されている。` +
        `この幹線に必要な許容電流 IW〔A〕の最小値はいくらか。`,
      defaultSolution: [
        `電技解釈第148条: IM≤50A なら IW≥1.25·IM+IH、IM>50A なら IW≥1.1·IM+IH`,
        `本問は IM=${formatClean(im)}A で${boundary}ため、割増率は${formatClean(factor)}`,
        `IW=${formatClean(factor)}×${formatClean(im)}+${formatClean(ih)}`,
        `IW=${answerText}A`,
        `ポイント: 割増は電動機分 IM だけに掛ける。IH には掛けない。`,
      ],
      physicallyValid: true,
    };
  },
});
