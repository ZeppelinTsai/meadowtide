// 遷移用暫時工具：從 meadowtide.html 抽出指定行範圍(以原始檔案行號為準)的原始碼，
// 不做任何修改，純粹是把大檔案切成小塊方便寫進新模組。遷移完成後會刪除這個檔案。
const fs = require("fs");
const html = fs.readFileSync("meadowtide.html", "utf8");
const m = html.match(
  /<script src="https:\/\/cdnjs[^>]+><\/script>\s*<script>([\s\S]*)<\/script>/,
);
const scriptLines = m[1].split("\n");
const OFFSET = 189; // originalLine = scriptLine + OFFSET

const [, , startArg, endArg] = process.argv;
const start = Number(startArg);
const end = Number(endArg);
const sliceStart = start - OFFSET - 1; // scriptLines 是 0-based
const sliceEnd = end - OFFSET;
const out = scriptLines.slice(sliceStart, sliceEnd).join("\n");
process.stdout.write(out);
