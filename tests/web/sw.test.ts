/**
 * tests/web/sw.test.ts — Service Worker（web/sw.js）の挙動テスト。
 *
 * sw.js は module ではないため、vm で self/caches/fetch をスタブした
 * サンドボックスに読み込み、登録されたイベントハンドラを直接叩いて検証する。
 * 対象:
 *  - stale-while-revalidate の基本動作（キャッシュ即返し＋裏更新）
 *  - SRI 原子ペア（index.html / dist/app.js）は裏差し替えしないこと（SW堅牢化第2弾）
 *  - 非 ok / 非 basic 応答をキャッシュしないこと（キャッシュ汚染防止）
 *  - オフライン×未キャッシュのナビゲーションは app shell へフォールバック
 *  - activate が旧キャッシュを破棄し claim を waitUntil 内で待つこと
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SW_SOURCE = readFileSync(join(__dirname, "../../web/sw.js"), "utf8");

const ORIGIN = "https://denken.example.com";

/** キャッシュ1個分のフェイク（Cache API の使用箇所のみ実装）。 */
class FakeCache {
  store = new Map<string, Response>();

  private keyOf(request: { url: string } | string): string {
    const url = typeof request === "string" ? new URL(request, `${ORIGIN}/`).href : request.url;
    return url;
  }

  async match(request: { url: string } | string): Promise<Response | undefined> {
    // 実 Cache API と同様、呼び出しごとに独立して消費できる Response を返す。
    return this.store.get(this.keyOf(request))?.clone();
  }

  async put(request: { url: string } | string, res: Response): Promise<void> {
    this.store.set(this.keyOf(request), res);
  }

  async addAll(paths: string[]): Promise<void> {
    for (const p of paths) this.store.set(new URL(p, `${ORIGIN}/`).href, new Response(`precached:${p}`));
  }
}

/** caches グローバルのフェイク。 */
class FakeCaches {
  map = new Map<string, FakeCache>();

  async open(name: string): Promise<FakeCache> {
    if (!this.map.has(name)) this.map.set(name, new FakeCache());
    return this.map.get(name)!;
  }

  async keys(): Promise<string[]> {
    return [...this.map.keys()];
  }

  async delete(name: string): Promise<boolean> {
    return this.map.delete(name);
  }
}

interface SwHarness {
  listeners: Map<string, (event: unknown) => void>;
  caches: FakeCaches;
  fetchCalls: string[];
  claimed: () => boolean;
  cacheName: () => string;
  /** fetch イベントを発火して Response を得る。 */
  dispatchFetch(url: string, opts?: { mode?: string }): Promise<Response>;
  dispatchActivate(): Promise<void>;
}

/** sw.js をサンドボックスで評価し、ハンドラ・フェイクへのハンドルを返す。 */
function loadSw(fetchImpl: (url: string) => Promise<Response>): SwHarness {
  const listeners = new Map<string, (event: unknown) => void>();
  const caches = new FakeCaches();
  const fetchCalls: string[] = [];
  let claimed = false;

  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      listeners.set(type, fn);
    },
    skipWaiting: () => {},
    clients: {
      claim: async () => {
        claimed = true;
      },
    },
    location: { origin: ORIGIN },
  };

  const sandbox = {
    self,
    caches,
    URL,
    Response,
    Promise,
    console,
    fetch: (request: { url: string } | string) => {
      const url = typeof request === "string" ? request : request.url;
      fetchCalls.push(url);
      return fetchImpl(url);
    },
  };
  runInNewContext(SW_SOURCE, sandbox, { filename: "web/sw.js" });

  // sw.js 先頭の const CACHE を評価済みサンドボックスから取り出す代わりに、
  // ソースから直接読む（プレースホルダ置換後の実トークン）。
  const cacheName = SW_SOURCE.match(/const CACHE = "([^"]+)"/)?.[1] ?? "";

  return {
    listeners,
    caches,
    fetchCalls,
    claimed: () => claimed,
    cacheName: () => cacheName,
    async dispatchFetch(url: string, opts?: { mode?: string }): Promise<Response> {
      const handler = listeners.get("fetch");
      if (!handler) throw new Error("fetch handler 未登録");
      let responded: Promise<Response> | null = null;
      const event = {
        request: { url, method: "GET", mode: opts?.mode ?? "no-cors" },
        respondWith: (p: Promise<Response>) => {
          responded = p;
        },
      };
      handler(event);
      if (!responded) throw new Error("respondWith が呼ばれていない");
      return responded;
    },
    async dispatchActivate(): Promise<void> {
      const handler = listeners.get("activate");
      if (!handler) throw new Error("activate handler 未登録");
      let waited: Promise<unknown> | null = null;
      handler({
        waitUntil: (p: Promise<unknown>) => {
          waited = p;
        },
      });
      if (waited) await waited;
    },
  };
}

/** マイクロタスクを流しきる（裏更新の完了待ち）。 */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("web/sw.js — stale-while-revalidate と SRI 原子ペア", () => {
  let harness: SwHarness;
  let networkBody: string;
  let networkOk: boolean;

  /** SW は res.type === "basic"（同一オリジン）のみキャッシュするため、type を偽装する。 */
  function basicResponse(body: string, status = 200): Response {
    const res = new Response(body, { status });
    Object.defineProperty(res, "type", { value: "basic" });
    return res;
  }

  beforeEach(() => {
    networkBody = "from-network";
    networkOk = true;
    harness = loadSw(async () => (networkOk ? basicResponse(networkBody) : basicResponse("err", 500)));
  });

  async function precache(paths: string[]): Promise<FakeCache> {
    const cache = await harness.caches.open(harness.cacheName());
    await cache.addAll(paths);
    return cache;
  }

  it("非原子アセット（problems.json）はキャッシュ即返し＋裏でネットワーク更新する", async () => {
    const cache = await precache(["./problems.json"]);
    const res = await harness.dispatchFetch(`${ORIGIN}/problems.json`);
    expect(await res.text()).toBe("precached:./problems.json");
    await flush();
    // 裏更新でキャッシュがネットワーク応答に差し替わる。
    expect(harness.fetchCalls).toContain(`${ORIGIN}/problems.json`);
    const updated = await cache.match(`${ORIGIN}/problems.json`);
    expect(await updated?.clone().text()).toBe("from-network");
  });

  it("SRI 原子ペア（index.html / dist/app.js / toolkit.html / dist/toolkit.js / ルート）はキャッシュヒット時に裏差し替えしない", async () => {
    const cache = await precache(["./", "./index.html", "./dist/app.js", "./toolkit.html", "./dist/toolkit.js"]);
    for (const path of ["/", "/index.html", "/dist/app.js", "/toolkit.html", "/dist/toolkit.js"]) {
      const res = await harness.dispatchFetch(`${ORIGIN}${path}`);
      expect((await res.text()).startsWith("precached:")).toBe(true);
    }
    await flush();
    // ネットワークへ一切行かない＝キャッシュは install(addAll) のみが書く。
    expect(harness.fetchCalls).toEqual([]);
    expect(await (await cache.match(`${ORIGIN}/dist/app.js`))?.clone().text()).toBe("precached:./dist/app.js");
    expect(await (await cache.match(`${ORIGIN}/dist/toolkit.js`))?.clone().text()).toBe("precached:./dist/toolkit.js");
  });

  it("非 ok 応答はキャッシュに保存しない（キャッシュ汚染防止）", async () => {
    networkOk = false;
    const cache = await precache(["./problems.json"]);
    const res = await harness.dispatchFetch(`${ORIGIN}/problems.json`);
    expect(await res.text()).toBe("precached:./problems.json");
    await flush();
    expect(await (await cache.match(`${ORIGIN}/problems.json`))?.clone().text()).toBe("precached:./problems.json");
  });

  it("オフライン×未キャッシュのナビゲーションは app shell（./）へフォールバックする", async () => {
    harness = loadSw(async () => {
      throw new Error("offline");
    });
    const cache = await harness.caches.open(harness.cacheName());
    await cache.addAll(["./"]);
    const res = await harness.dispatchFetch(`${ORIGIN}/unknown-page`, { mode: "navigate" });
    expect(await res.text()).toBe("precached:./");
  });

  it("activate は旧キャッシュを破棄し、claim を waitUntil 内で完了する", async () => {
    await harness.caches.open("denken-os-v20-deadbeef");
    await harness.caches.open(harness.cacheName());
    await harness.dispatchActivate();
    expect(await harness.caches.keys()).toEqual([harness.cacheName()]);
    expect(harness.claimed()).toBe(true);
  });
});
