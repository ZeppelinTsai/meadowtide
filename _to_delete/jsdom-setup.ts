import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
});
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
(globalThis as any).HTMLCanvasElement = dom.window.HTMLCanvasElement;
(globalThis as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 16);
(globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
