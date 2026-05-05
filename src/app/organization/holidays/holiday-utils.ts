/**
 * Shared utilities for the holidays feature.
 *
 * Consolidates date helpers and the calendar's lane-allocation algorithm so
 * both the page component and the calendar component agree on parsing rules
 * (especially the Mifos `[year, month, day]` array form returned by the API).
 */

export interface HolidayStatus {
  id?: number;
  code?: string;
  value?: string;
}

export interface Holiday {
  id: number;
  name: string;
  fromDate: unknown;
  toDate: unknown;
  repaymentsRescheduledTo?: unknown;
  reschedulingType?: number;
  status?: HolidayStatus;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Coerce a value to a `Date`. Mifos returns dates as `[yyyy, MM, dd]` arrays in
 * many places; honour that first. Returns `null` for missing or unparseable input.
 */
export function toDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (Array.isArray(value) && value.length >= 3) {
    const [
      y,
      m,
      d
    ] = value as [number, number, number];
    return new Date(y, m - 1, d);
  }
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? null : d;
}

/* ------------------------------------------------------------------------- */

/** Input shape for `allocateLanes`. `startCol`/`endCol` are inclusive 0-based positions. */
export interface LaneCandidate {
  startCol: number;
  endCol: number;
  /** Higher weights are placed first. Defaults to span length when omitted. */
  weight?: number;
  /** Sub-sort applied after weight; lower goes first. Useful for stable ordering. */
  tieBreaker?: number;
}

/** Result returned by `allocateLanes`. */
export interface LanePlacement<T extends LaneCandidate> {
  item: T;
  lane: number;
}

/**
 * Greedily pack candidate spans into the minimum number of lanes such that no
 * two items in the same lane overlap.
 *
 * Items are processed longest-first (or by explicit `weight` desc) so big spans
 * snag the bottom lane and short ones fill the gaps above. Each lane tracks all
 * its placed intervals (not just the last `endCol`) so a short span at col 0
 * can still slot in below an already-placed span at cols 4–6 on the same lane.
 *
 * Two spans are considered overlapping when their inclusive ranges share *or*
 * touch (`a.endCol >= b.startCol - 0` is overlap; we keep a one-cell gap rule —
 * see the spec — to avoid visually-touching bars on the same lane).
 *
 * Pure function — easy to unit test without instantiating Angular components.
 */
export function allocateLanes<T extends LaneCandidate>(
  items: T[]
): { placements: LanePlacement<T>[]; laneCount: number } {
  const sorted = [...items].sort((a, b) => {
    const wa = a.weight ?? a.endCol - a.startCol;
    const wb = b.weight ?? b.endCol - b.startCol;
    return wb - wa || (a.tieBreaker ?? 0) - (b.tieBreaker ?? 0) || a.startCol - b.startCol;
  });

  // For each lane, the list of [startCol, endCol] pairs already placed there.
  const lanes: Array<Array<[number, number]>> = [];
  const placements: LanePlacement<T>[] = [];

  const overlapsAny = (lane: Array<[number, number]>, s: number, e: number): boolean => {
    for (const [
      ls,
      le
    ] of lane) {
      // Inclusive ranges that share or touch are considered overlapping.
      if (!(e < ls || s > le)) return true;
    }
    return false;
  };

  for (const item of sorted) {
    let laneIdx = 0;
    while (laneIdx < lanes.length && overlapsAny(lanes[laneIdx], item.startCol, item.endCol)) {
      laneIdx++;
    }
    if (laneIdx === lanes.length) lanes.push([]);
    lanes[laneIdx].push([
      item.startCol,
      item.endCol
    ]);
    placements.push({ item, lane: laneIdx });
  }

  placements.sort((a, b) => a.lane - b.lane || a.item.startCol - b.item.startCol);
  return { placements, laneCount: lanes.length };
}

/**
 * Stable seed → hue (degrees) for color-coding events.
 * Maps into the 200°–340° band so all colors stay brand-adjacent (blues → magentas)
 * and avoid muddy yellow/green territory.
 */
export function hashHue(seed: number): number {
  const span = 140;
  const start = 200;
  return start + (Math.abs(seed) % span);
}

/** Cheap deterministic string hash. Used as a fallback seed when an entity has no id. */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
