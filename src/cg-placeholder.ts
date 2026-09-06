/** UI fallback; text stays above the bottom 30vh dialogue overlay. */
export function createCgPlaceholder(assetId: string, description = "", width = window.innerWidth, height = window.innerHeight): string {
  const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
  const maxCharacters = Math.max(8, Math.floor((width - 40) / 20));
  const wrap = (text: string) => {
    const chars = Array.from(text);
    const lines: string[] = [];
    for (let i = 0; i < chars.length; i += maxCharacters) lines.push(chars.slice(i, i + maxCharacters).join(""));
    return lines;
  };
  const lines = ["CG PLACEHOLDER", ...wrap(assetId), ...wrap(description || "正式 CG 尚未提供")];
  const top = Math.max(25, height * 0.2);
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#243747"/>${lines.map((line, i) => `<text x="50%" y="${top + i * 32}" text-anchor="middle" fill="#f7ecd3" font-family="sans-serif" font-size="${i === 0 ? 28 : 20}">${escape(line)}</text>`).join("")}</svg>`);
}
