export interface MapPoint {
  x: number;
  z: number;
}

export interface TransitionSide {
  map: string;
  count?: number;
  triggerAt: (index: number) => MapPoint;
  arrivalAt: (index: number) => MapPoint;
  skipIndex?: (index: number) => boolean;
}

export interface TransitionLink {
  id: string;
  a: TransitionSide;
  b: TransitionSide;
}

export interface TransitionEvent {
  readonly map: string;
  readonly x: number;
  readonly z: number;
  readonly trigger: "touch";
  action: () => void;
}

export function createTransitionEvents(
  links: TransitionLink[],
  navigate: (map: string, arrival: MapPoint) => void,
): TransitionEvent[] {
  const events: TransitionEvent[] = [];
  const addDirection = (from: TransitionSide, to: TransitionSide) => {
    const count = from.count ?? 1;
    for (let index = 0; index < count; index++) {
      if (from.skipIndex?.(index)) continue;
      events.push({
        map: from.map,
        get x() {
          return from.triggerAt(index).x;
        },
        get z() {
          return from.triggerAt(index).z;
        },
        trigger: "touch",
        action: () => navigate(to.map, to.arrivalAt(index)),
      });
    }
  };
  for (const link of links) {
    addDirection(link.a, link.b);
    addDirection(link.b, link.a);
  }
  return events;
}
