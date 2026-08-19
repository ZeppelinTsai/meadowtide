// 決定性亂數：同一組座標永遠得到同一個值，畫面重整/重建場景時同一格植被
// 不會每次都長得不一樣。
export function hash2(x: number, z: number): number {
  const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
