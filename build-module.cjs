// 遷移用暫時工具：抽出原始碼的行範圍(可多段)、幫每個頂層 function/const/let
// 宣告自動加上 export，最後把 header(import 區塊) + 內容寫進目標檔案。
// 遷移完成後這個檔案會被刪除，不是專案的一部分。
const fs = require("fs");
const html = fs.readFileSync("meadowtide.html", "utf8");
const m = html.match(
  /<script src="https:\/\/cdnjs[^>]+><\/script>\s*<script>([\s\S]*)<\/script>/,
);
const scriptLines = m[1].split("\n");
const OFFSET = 189;

function extract(start, end) {
  const sliceStart = start - OFFSET - 1;
  const sliceEnd = end - OFFSET;
  return scriptLines.slice(sliceStart, sliceEnd).join("\n");
}

function addExports(code) {
  return code.replace(
    /^( {6})(function |const |let )/gm,
    (m, indent, kind) => `${indent}export ${kind}`,
  );
}

const configPath = process.argv[2];
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const { outFile, header, ranges, noExportPattern } = config;

let body = ranges.map(([s, e]) => extract(s, e)).join("\n\n");
body = addExports(body);
if (noExportPattern) {
  // 有些區塊裡的宣告故意不要 export(例如純內部使用的暫存變數)
  const re = new RegExp(noExportPattern, "gm");
  body = body.replace(re, (m2) => m2.replace(/^( *)export /, "$1"));
}

const out = (header ? header.trimEnd() + "\n\n" : "") + body.trim() + "\n";
fs.mkdirSync(require("path").dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, out);
console.log("wrote", outFile, `(${out.split("\n").length} lines)`);
