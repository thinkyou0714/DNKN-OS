// serve:web — ビルド済みの web/ をローカルブラウザで確認するための薄いランチャ。
// 実体は e2e と同じ tests/infra/static-server.cjs（追加依存なし・Node標準のみ）。
// 環境変数の受け渡しだけを担い、サーバ実装を二重に持たない。
const path = require("node:path");

process.env.E2E_WEB_ROOT = path.join(__dirname, "..", "web");
process.env.E2E_PORT = process.env.PORT || "4317";

console.log(`DENKEN-OS: http://127.0.0.1:${process.env.E2E_PORT}/index.html`);
console.log("停止は Ctrl+C。");
require(path.join(__dirname, "..", "tests", "infra", "static-server.cjs"));
