import { allocateLanes, hashHue, sameDay, startOfDay, startOfMonth, toDate } from './holiday-utils';

describe('holiday-utils — date helpers', () => {
  it('toDate parses Mifos [yyyy, mm, dd] arrays', () => {
    const d = toDate([
      2026,
      1,
      7
    ]);
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(0);
    expect(d!.getDate()).toBe(7);
  });

  it('toDate accepts Date instances', () => {
    const original = new Date(2026, 4, 15);
    expect(toDate(original)).toBe(original);
  });

  it('toDate accepts ISO strings', () => {
    expect(toDate('2026-01-07')!.getFullYear()).toBe(2026);
  });

  it('toDate returns null for null, empty string, or unparseable input', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate('')).toBeNull();
    expect(toDate('not a date')).toBeNull();
    expect(toDate(new Date('invalid'))).toBeNull();
  });

  it('startOfDay strips time component', () => {
    const d = new Date(2026, 0, 7, 14, 35, 22);
    const s = startOfDay(d);
    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
    expect(s.getDate()).toBe(7);
  });

  it('startOfMonth returns the first day of the month', () => {
    const d = new Date(2026, 5, 23);
    expect(startOfMonth(d).getDate()).toBe(1);
    expect(startOfMonth(d).getMonth()).toBe(5);
  });

  it('sameDay handles nulls and date equality', () => {
    expect(sameDay(null, null)).toBe(false);
    expect(sameDay(new Date(2026, 0, 7), null)).toBe(false);
    expect(sameDay(new Date(2026, 0, 7), new Date(2026, 0, 7, 23, 59))).toBe(true);
    expect(sameDay(new Date(2026, 0, 7), new Date(2026, 0, 8))).toBe(false);
  });
});

describe('holiday-utils — allocateLanes', () => {
  it('places non-overlapping items on the same lane', () => {
    const { placements, laneCount } = allocateLanes([
      { startCol: 0, endCol: 1 },
      { startCol: 3, endCol: 4 }
    ]);
    expect(laneCount).toBe(1);
    expect(placements.every((p) => p.lane === 0)).toBe(true);
  });

  it('stacks overlapping items on separate lanes', () => {
    const { placements, laneCount } = allocateLanes([
      { startCol: 0, endCol: 3 },
      { startCol: 2, endCol: 5 },
      { startCol: 4, endCol: 6 }
    ]);
    expect(laneCount).toBe(2);
    // Longest item should land on the bottom (lane 0).
    const bottom = placements.find((p) => p.item.startCol === 0 && p.item.endCol === 3)!;
    expect(bottom.lane).toBe(0);
  });

  it('considers two items adjacent (a.endCol === b.startCol) as overlapping', () => {
    // The greedy check `laneEnds[lane] >= startCol` enforces a 1-cell gap; this
    // is intentional so visually-touching bars don't render in the same lane.
    const { laneCount } = allocateLanes([
      { startCol: 0, endCol: 2 },
      { startCol: 2, endCol: 4 }
    ]);
    expect(laneCount).toBe(2);
  });

  it('respects weight — heavier items get bottom lane regardless of length', () => {
    const { placements } = allocateLanes([
      { startCol: 0, endCol: 6, weight: 1 },
      { startCol: 2, endCol: 3, weight: 100 }
    ]);
    const heavy = placements.find((p) => p.item.weight === 100)!;
    expect(heavy.lane).toBe(0);
  });

  it('uses tieBreaker as secondary sort when weights tie', () => {
    const { placements } = allocateLanes([
      { startCol: 0, endCol: 2, weight: 5, tieBreaker: 200 },
      { startCol: 4, endCol: 6, weight: 5, tieBreaker: 100 }
    ]);
    // Lower tieBreaker placed first, but since they don't overlap they share lane 0.
    expect(placements.every((p) => p.lane === 0)).toBe(true);
  });

  it('returns laneCount=0 for empty input', () => {
    const { placements, laneCount } = allocateLanes([]);
    expect(placements).toEqual([]);
    expect(laneCount).toBe(0);
  });

  it('does not mutate the input array', () => {
    const input = [
      { startCol: 4, endCol: 6 },
      { startCol: 0, endCol: 3 }
    ];
    const before = JSON.stringify(input);
    allocateLanes(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('holiday-utils — hashHue', () => {
  it('always returns a hue in the 200°–340° brand band', () => {
    for (let i = 0; i < 200; i++) {
      const h = hashHue(i);
      expect(h).toBeGreaterThanOrEqual(200);
      expect(h).toBeLessThan(340);
    }
  });

  it('is stable for the same seed', () => {
    expect(hashHue(42)).toBe(hashHue(42));
  });
});
