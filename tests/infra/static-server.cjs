// 追加依存なしの静的サーバ（Node 標準のみ）。web/ を読み取り専用で配信する。
//
// 以前は playwright.config.ts が `node -e "..."` のワンライナーを組み立てていたが、
// JSON.stringify がダブルクォートを出力し、それが既にダブルクォートで囲まれた
// sh -c 文字列の内側に入るためシェルに剥がされ、Node がパスを正規表現リテラルと
// 解釈して SyntaxError: Invalid regular expression flags で必ず落ちていた。
// 設定は env 経由で受け取り、クォートの入れ子を完全になくす。
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = process.env.E2E_WEB_ROOT;
const port = Number(process.env.E2E_PORT || 4317);

if (!root) {
  console.error("E2E_WEB_ROOT is required");
  process.exit(1);
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

http
  .createServer((req, res) => {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/index.html";
    const fp = path.join(root, p);
    // path traversal ガード（path.join 後に root 配下であることを確認）
    if (!fp.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(fp, (e, buf) => {
      if (e) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, {
        "content-type": types[path.extname(fp)] || "application/octet-stream",
      });
      res.end(buf);
    });
  })
  .listen(port, () => console.log(`static web/ on ${port}`));
