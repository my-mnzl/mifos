import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';
import { Holiday, allocateLanes, hashHue, hashString, sameDay, startOfDay, toDate } from '../holiday-utils';

interface DayCell {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

interface EventBar {
  holiday: Holiday;
  startCol: number;
  endCol: number;
  lane: number;
  startsHere: boolean;
  endsHere: boolean;
  hue: number;
}

interface WeekRow {
  days: DayCell[];
  bars: EventBar[];
  laneCount: number;
}

const MS_PER_DAY = 86_400_000;
const MAX_VISIBLE_LANES = 3;

/** Day-of-week offset, 0 = Sunday … 6 = Saturday. */
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

@Component({
  selector: 'mifosx-holiday-calendar',
  standalone: true,
  templateUrl: './holiday-calendar.component.html',
  styleUrls: ['./holiday-calendar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    CommonModule,
    FaIconComponent,
    RouterLink
  ]
})
export class HolidayCalendarComponent implements OnChanges {
  private router = inject(Router);

  @Input() holidays: Holiday[] = [];
  @Input() month: Date = new Date();
  @Input() weekStartsOn: DayOfWeek = 0;

  @Output() monthChange = new EventEmitter<Date>();
  @Output() dayClick = new EventEmitter<Date>();

  weekDayLabels: string[] = [];
  weeks: WeekRow[] = [];
  monthLabel = '';
  readonly maxVisibleLanes = MAX_VISIBLE_LANES;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['weekStartsOn'] || !this.weekDayLabels.length) {
      this.weekDayLabels = this.computeWeekDayLabels();
    }
    if (changes['month'] || changes['holidays'] || changes['weekStartsOn']) {
      this.rebuild();
    }
  }

  prevMonth(): void {
    const d = new Date(this.month.getFullYear(), this.month.getMonth() - 1, 1);
    this.monthChange.emit(d);
  }

  nextMonth(): void {
    const d = new Date(this.month.getFullYear(), this.month.getMonth() + 1, 1);
    this.monthChange.emit(d);
  }

  goToday(): void {
    const today = new Date();
    this.monthChange.emit(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  trackWeek(_: number, w: WeekRow): number {
    return w.days[0].date.getTime();
  }

  trackDay(_: number, d: DayCell): number {
    return d.date.getTime();
  }

  trackBar(_: number, b: EventBar): number {
    return b.holiday.id * 1000 + b.lane;
  }

  openHoliday(h: Holiday, ev: Event): void {
    ev.stopPropagation();
    this.router.navigate([
      '/organization/holidays',
      h.id
    ]);
  }

  /**
   * Builds the visible weeks for the current `month` plus event bars per week.
   * Multi-day holidays that span week boundaries are split into one bar per week,
   * with rounded corners only at the true start/end of the holiday.
   */
  private rebuild(): void {
    if (!this.month) return;
    const year = this.month.getFullYear();
    const monthIdx = this.month.getMonth();
    this.monthLabel = this.month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const today = startOfDay(new Date());
    const firstOfMonth = new Date(year, monthIdx, 1);
    const offset = (firstOfMonth.getDay() - this.weekStartsOn + 7) % 7;
    const gridStart = new Date(year, monthIdx, 1 - offset);

    // Always render 6 weeks so the layout doesn't jump between months.
    const weeks: WeekRow[] = [];
    for (let w = 0; w < 6; w++) {
      const days: DayCell[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + w * 7 + d);
        days.push({
          date,
          inMonth: date.getMonth() === monthIdx,
          isToday: sameDay(date, today),
          isWeekend: date.getDay() === 0 || date.getDay() === 6
        });
      }
      weeks.push({ days, bars: [], laneCount: 0 });
    }

    interface Seg {
      holiday: Holiday;
      weekIdx: number;
      startCol: number;
      endCol: number;
      startsHere: boolean;
      endsHere: boolean;
      length: number;
      absoluteStart: number;
      hue: number;
    }
    const segs: Seg[] = [];
    for (const h of this.holidays) {
      const start = startOfDayOrNull(toDate(h.fromDate));
      const endRaw = startOfDayOrNull(toDate(h.toDate));
      if (!start || !endRaw) continue;
      const end = endRaw.getTime() < start.getTime() ? start : endRaw;
      const hue = hashHue(h.id ?? hashString(h.name));

      for (let w = 0; w < 6; w++) {
        const week = weeks[w];
        const wStart = startOfDay(week.days[0].date);
        const wEnd = startOfDay(week.days[6].date);
        if (end < wStart || start > wEnd) continue;
        const segStart = start > wStart ? start : wStart;
        const segEnd = end < wEnd ? end : wEnd;
        const startCol = Math.round((segStart.getTime() - wStart.getTime()) / MS_PER_DAY);
        const endCol = Math.round((segEnd.getTime() - wStart.getTime()) / MS_PER_DAY);
        segs.push({
          holiday: h,
          weekIdx: w,
          startCol,
          endCol,
          startsHere: sameDay(segStart, start),
          endsHere: sameDay(segEnd, end),
          length: endCol - startCol + 1,
          absoluteStart: start.getTime(),
          hue
        });
      }
    }

    for (let w = 0; w < 6; w++) {
      const weekSegs = segs
        .filter((s) => s.weekIdx === w)
        .map((s) => ({
          ...s,
          weight: s.length,
          tieBreaker: s.absoluteStart
        }));
      const { placements, laneCount } = allocateLanes(weekSegs);
      weeks[w].bars = placements.map(({ item, lane }) => ({
        holiday: item.holiday,
        startCol: item.startCol,
        endCol: item.endCol,
        lane,
        startsHere: item.startsHere,
        endsHere: item.endsHere,
        hue: item.hue
      }));
      weeks[w].laneCount = laneCount;
    }

    this.weeks = weeks;
  }

  private computeWeekDayLabels(): string[] {
    const labels: string[] = [];
    // Pick a known Sunday (2024-01-07) as the anchor and offset.
    const anchor = new Date(2024, 0, 7);
    for (let i = 0; i < 7; i++) {
      const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + ((i + this.weekStartsOn) % 7));
      labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
    }
    return labels;
  }
}

function startOfDayOrNull(d: Date | null): Date | null {
  return d ? startOfDay(d) : null;
}
