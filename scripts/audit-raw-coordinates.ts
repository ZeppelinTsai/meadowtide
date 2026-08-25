// audit-raw-coordinates.ts
//
// 這支不是自動修復工具，是「風險清單產生器」。地圖平移安全與否，最大的
// 破口不是 LAYOUT 本身（它的葉節點值本來就該是寫死的數字，那正是它作為
// single source of truth 的意義），而是**LAYOUT 外面**任何直接寫死座標、
// 沒有透過 `LAYOUT.xxx` 取值的地方——這種寫法在你目前的檔案裡真實存在，
// 例如 map-scene.ts 的 `northSeaWestX = -15`、`worldLeft = -8`，以及
// events 陣列裡舊城鎮南沙灘<->港口南沙灘那組 `x: 23, z: 36`。這些之後
// 平移地圖時 expandTileGrid()/shiftCoordinates() 都碰不到，一定要人工
// 複查。
//
// 用法：
//   npx tsx audit-raw-coordinates.ts path/to/layout-maps.ts path/to/map-scene.ts
//
// 掃描邏輯（純 AST 掃描，不做型別檢查，抓的是「模式」不是語意，會有
// 少量誤報/漏報，把它當檢查清單用，不是當正確性證明）：
//   1. 物件屬性：key 是 x/z/x1/z1/x2/z2/fromX/fromZ/toX/toZ/dx/dz，
//      value 直接是數字字面量（含負數），且不在 `LAYOUT` 這個變數宣告
//      的範圍內 —— 在 LAYOUT 裡面出現是正常的，那就是資料本身。
//   2. 變數宣告：名字結尾像座標（大小寫不拘的 x/z，或以 X/Z 結尾），
//      直接初始化成數字字面量，例如 `const northSeaWestX = -15`。

import * as ts from "typescript";
import * as fs from "node:fs";
import * as path from "node:path";

interface Finding {
  file: string;
  line: number;
  column: number;
  kind: "object-property" | "variable";
  name: string;
  value: string;
  snippet: string;
}

const COORD_KEYS = new Set([
  "x", "z", "x1", "z1", "x2", "z2",
  "fromX", "fromZ", "toX", "toZ", "dx", "dz",
]);

function looksLikeCoordName(name: string): boolean {
  // 裸的 x / z（大小寫不拘），或是駝峰命名結尾是大寫 X / Z（northSeaWestX、
  // worldRight 這種沒有 X/Z 結尾的邊界變數抓不到，這是已知的啟發式限制，
  // 不是每個「座標感」的名字都能靠命名規則猜到，複查時務必人工再看一遍
  // 這幾支檔案，不要只信這支腳本的清單）。
  return /^[xz]$/i.test(name) || /[XZ]$/.test(name);
}

function numericLiteralText(node: ts.Node): string | null {
  if (ts.isNumericLiteral(node)) return node.getText();
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return "-" + node.operand.getText();
  }
  return null;
}

function auditFile(filePath: string): Finding[] {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );

  // 找出 `export const LAYOUT = {...}` 宣告的完整範圍，範圍內的屬性一律
  // 跳過（那就是資料本身，允許是寫死的數字）。
  let layoutRangeStart = -1;
  let layoutRangeEnd = -1;
  const findLayout = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "LAYOUT" &&
      node.initializer
    ) {
      layoutRangeStart = node.initializer.getStart(sourceFile);
      layoutRangeEnd = node.initializer.getEnd();
    }
    ts.forEachChild(node, findLayout);
  };
  findLayout(sourceFile);

  const insideLayout = (pos: number) =>
    layoutRangeStart !== -1 && pos >= layoutRangeStart && pos < layoutRangeEnd;

  const findings: Finding[] = [];
  const relFile = path.basename(filePath);

  const visit = (node: ts.Node) => {
    // 情境 1：物件屬性 { x: -15, ... }
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
      const key = node.name.text;
      if (COORD_KEYS.has(key) && !insideLayout(node.getStart(sourceFile))) {
        const lit = numericLiteralText(node.initializer);
        if (lit !== null) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            node.getStart(sourceFile),
          );
          findings.push({
            file: relFile,
            line: line + 1,
            column: character + 1,
            kind: "object-property",
            name: key,
            value: lit,
            snippet: node.getText(sourceFile).slice(0, 80),
          });
        }
      }
    }

    // 情境 2：const northSeaWestX = -15;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      looksLikeCoordName(node.name.text) &&
      !insideLayout(node.getStart(sourceFile))
    ) {
      const lit = numericLiteralText(node.initializer);
      if (lit !== null) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        findings.push({
          file: relFile,
          line: line + 1,
          column: character + 1,
          kind: "variable",
          name: node.name.text,
          value: lit,
          snippet: node.getText(sourceFile).slice(0, 80),
        });
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error(
      "用法：npx tsx audit-raw-coordinates.ts <file1.ts> [file2.ts ...]",
    );
    process.exit(1);
  }

  let total = 0;
  for (const file of files) {
    const findings = auditFile(file);
    total += findings.length;
    if (findings.length === 0) {
      console.log(`\n${file}：沒抓到 LAYOUT 外的原始座標數字。`);
      continue;
    }
    console.log(`\n${file}：${findings.length} 處需要人工複查——`);
    for (const f of findings) {
      console.log(
        `  ${f.line}:${f.column}  [${f.kind}] ${f.name} = ${f.value}   ${f.snippet}`,
      );
    }
  }
  console.log(
    `\n共 ${total} 處。這份清單不是 bug 列表，是「地圖平移時這些地方不會自動跟著動，要自己判斷需不需要手動調整」的提醒清單。`,
  );
}

main();
