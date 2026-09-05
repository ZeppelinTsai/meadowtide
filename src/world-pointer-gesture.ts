// Pure gesture state shared by mouse, touch and pen world input.
export const WORLD_DRAG_THRESHOLD = 9;
export const PHOTO_HOLD_MS = 600;
type Point = { x: number; y: number };
export class WorldPointerGesture {
  private press: { id: number; start: Point; last: Point; time: number;
    photo: boolean; dragged: boolean; consumed: boolean } | null = null;
  get active() { return this.press !== null; }
  begin(id: number, x: number, y: number, time: number, photo: boolean) {
    this.press = { id, start: { x, y }, last: { x, y }, time,
      photo, dragged: false, consumed: false };
  }
  move(id: number, x: number, y: number): Point | null {
    const p = this.press;
    if (!p || p.id !== id) return null;
    const previous = p.last;
    p.last = { x, y };
    if (Math.hypot(x - p.start.x, y - p.start.y) > WORLD_DRAG_THRESHOLD)
      p.dragged = true;
    return p.dragged ? { x: x - previous.x, y: y - previous.y } : null;
  }
  takeLongPress(time: number) {
    const p = this.press;
    if (!p || !p.photo || p.dragged || p.consumed || time - p.time < PHOTO_HOLD_MS)
      return false;
    p.consumed = true;
    return true;
  }
  end(id: number, x: number, y: number): Point | null {
    const p = this.press;
    if (!p || p.id !== id) return null;
    this.move(id, x, y);
    this.press = null;
    return p.dragged || p.consumed ? null : { x, y };
  }
  cancel() { this.press = null; }
}
