import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  TemplateRef,
  ViewChild,
  inject
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatCheckbox } from '@angular/material/checkbox';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { from, of } from 'rxjs';

import { catchError, debounceTime, distinctUntilChanged, finalize, map, mergeMap, tap } from 'rxjs/operators';

import { OrganizationService } from '../organization.service';
import { PopoverService } from '../../configuration-wizard/popover/popover.service';
import { ConfigurationWizardService } from '../../configuration-wizard/configuration-wizard.service';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { DateFormatPipe } from '../../pipes/date-format.pipe';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';
import { ConfirmationDialogComponent } from '../../shared/confirmation-dialog/confirmation-dialog.component';
import { HolidayAutoImportDialogComponent } from './holiday-auto-import-dialog/holiday-auto-import-dialog.component';
import { HolidayCalendarComponent } from './holiday-calendar/holiday-calendar.component';
import { Holiday, sameDay, startOfDay, startOfMonth, toDate } from './holiday-utils';

interface HolidayGroup {
  label: string;
  items: Holiday[];
}

/** Egypt-conventional Saturday-first display in the calendar. */
const WEEK_STARTS_ON = 6;

@Component({
  selector: 'mifosx-holidays',
  templateUrl: './holidays.component.html',
  styleUrls: ['./holidays.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    CommonModule,
    FaIconComponent,
    DateFormatPipe,
    HolidayCalendarComponent,
    MatCheckbox
  ]
})
export class HolidaysComponent implements OnInit, AfterViewInit {
  private organizationService = inject(OrganizationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private configurationWizardService = inject(ConfigurationWizardService);
  private popoverService = inject(PopoverService);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);

  /** Office selector. */
  officeSelector = new UntypedFormControl();
  /** List-view filter. */
  filterControl = new UntypedFormControl('');

  /** All holidays for the selected office (excluding deleted). */
  holidaysData: Holiday[] = [];
  /** Filtered subset shown in the list view. */
  filteredHolidays: Holiday[] = [];
  /** List view rows grouped by month label. */
  groupedHolidays: HolidayGroup[] = [];

  /** Memoized counts; updated only when data reloads. */
  totalCount = 0;
  activeCount = 0;
  upcomingCount = 0;

  /** Offices data. */
  officeData: { id: number; name: string }[] = [];

  /** Active view tab. */
  view: 'month' | 'list' = 'month';
  /** Current month displayed by the calendar. */
  currentMonth = startOfMonth(new Date());
  /** Saturday-first week display in the calendar. */
  readonly weekStartsOn = WEEK_STARTS_ON;

  /** IDs selected for bulk activation in the list view. */
  selectedIds = new Set<number>();
  /** Bulk-activation progress + state. */
  activating = false;
  activationProgress = { done: 0, total: 0 };
  /** True when the list view's derived state needs recompute on next access. */
  private listViewDirty = true;

  /* Reference of create holiday button (configuration wizard). */
  @ViewChild('buttonCreateHoliday') buttonCreateHoliday: ElementRef<any>;
  @ViewChild('templateButtonCreateHoliday') templateButtonCreateHoliday: TemplateRef<any>;
  @ViewChild('filterRef') filterRef: ElementRef<any>;
  @ViewChild('templateFilterRef') templateFilterRef: TemplateRef<any>;

  constructor() {
    this.route.data.subscribe((data: { offices: any }) => {
      this.officeData = data.offices ?? [];
    });
  }

  ngOnInit(): void {
    this.officeSelector.valueChanges.subscribe((officeId) => {
      this.loadHolidays(officeId);
    });
    // Debounce list filter so typing doesn't iterate the array on every keystroke.
    this.filterControl.valueChanges.pipe(debounceTime(150), distinctUntilChanged()).subscribe(() => {
      this.listViewDirty = true;
      if (this.view === 'list') this.recomputeListView();
      this.cdr.markForCheck();
    });
    // Auto-select the first office so the page lands on data instead of an empty state.
    if (this.officeData.length > 0 && this.officeSelector.value == null) {
      this.officeSelector.setValue(this.officeData[0].id);
    }
  }

  /** Fetch holidays and recompute all derived state in one pass. */
  loadHolidays(officeId: number | string | null | undefined): void {
    if (officeId == null) {
      this.holidaysData = [];
      this.selectedIds = new Set();
      this.recomputeAll();
      this.cdr.markForCheck();
      return;
    }
    this.organizationService.getHolidays(officeId as string).subscribe((holidays: Holiday[] | null) => {
      this.holidaysData = (holidays ?? []).filter((h) => h?.status?.value !== 'Deleted');
      // Drop any selections that no longer exist in the refreshed data set.
      const existing = new Set(this.holidaysData.map((h) => h.id));
      this.selectedIds = new Set([...this.selectedIds].filter((id) => existing.has(id)));
      this.recomputeAll();
      this.cdr.markForCheck();
    });
  }

  /** Whether a holiday can be activated (status is "Pending for activation"). */
  canActivate(h: Holiday): boolean {
    const v = (h?.status?.value ?? '').toString().toLowerCase();
    return v === 'pending for activation' || v === 'pending';
  }

  /** True if every row in the current filtered view is selected. */
  get allSelected(): boolean {
    return this.filteredHolidays.length > 0 && this.filteredHolidays.every((h) => this.selectedIds.has(h.id));
  }

  /** True if some — but not all — rows in the filtered view are selected. */
  get someSelected(): boolean {
    return this.selectedIds.size > 0 && !this.allSelected;
  }

  /** Count of currently-selected rows whose status is "Pending for activation". */
  get selectedPendingCount(): number {
    let n = 0;
    for (const h of this.filteredHolidays) {
      if (this.selectedIds.has(h.id) && this.canActivate(h)) n++;
    }
    return n;
  }

  isSelected(id: number): boolean {
    return this.selectedIds.has(id);
  }

  toggleSelect(id: number): void {
    // Build a new Set so OnPush change detection picks up the identity change.
    const next = new Set(this.selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIds = next;
  }

  toggleSelectAll(checked: boolean): void {
    this.selectedIds = checked ? new Set(this.filteredHolidays.map((h) => h.id)) : new Set();
  }

  clearSelection(): void {
    this.selectedIds = new Set();
  }

  /**
   * Activate every selected holiday whose status is "Pending for activation".
   * Active/already-activated rows in the selection are skipped (the API would
   * reject them); the confirmation dialog tells the user when that's happening
   * so they're not surprised by a "4 of 10" outcome.
   */
  activateSelected(): void {
    if (this.activating) return;
    const ids = this.filteredHolidays.filter((h) => this.selectedIds.has(h.id) && this.canActivate(h)).map((h) => h.id);
    if (ids.length === 0) return;
    const skipped = this.selectedIds.size - ids.length;

    let dialogContext =
      this.translate.instant('labels.dialogContext.Are you sure you want to activate') +
      ` ${ids.length} ` +
      this.translate.instant('labels.dialogContext.holiday');
    if (skipped > 0) {
      dialogContext += '. ' + skipped + ' ' + this.translate.instant('labels.text.already-active rows will be skipped');
    }

    const ref = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        heading: this.translate.instant('labels.heading.Holidays'),
        dialogContext
      }
    });

    ref.afterClosed().subscribe((result: { confirm?: boolean } | undefined) => {
      if (!result?.confirm) return;
      this.runBulk(ids, 'activate');
    });
  }

  /** Delete every selected holiday. Confirmation required. */
  deleteSelected(): void {
    if (this.activating) return;
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) return;

    const ref = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        heading: this.translate.instant('labels.heading.Holidays'),
        dialogContext:
          this.translate.instant('labels.dialogContext.Are you sure you want to delete') +
          ` ${ids.length} ` +
          this.translate.instant('labels.dialogContext.holiday'),
        type: 'danger'
      }
    });

    ref.afterClosed().subscribe((result: { confirm?: boolean } | undefined) => {
      if (!result?.confirm) return;
      this.runBulk(ids, 'delete');
    });
  }

  private runBulk(ids: number[], action: 'activate' | 'delete'): void {
    this.activating = true;
    this.activationProgress = { done: 0, total: ids.length };
    let success = 0;
    let failed = 0;

    const op = (id: number) =>
      action === 'activate'
        ? this.organizationService.activateHoliday(String(id))
        : this.organizationService.deleteHoliday(String(id));

    from(ids)
      .pipe(
        mergeMap(
          (id) =>
            op(id).pipe(
              map(() => true),
              catchError(() => of(false))
            ),
          3
        ),
        tap((ok) => {
          if (ok) success++;
          else failed++;
          this.activationProgress = { done: success + failed, total: ids.length };
          this.cdr.markForCheck();
        }),
        finalize(() => {
          this.activating = false;
          this.clearSelection();
          if (this.officeSelector.value != null) {
            this.loadHolidays(this.officeSelector.value);
          } else {
            this.cdr.markForCheck();
          }
        })
      )
      .subscribe();
  }

  /** Single recompute for counts + list view. Called only on data change. */
  private recomputeAll(): void {
    const today = startOfDay(new Date());
    let active = 0;
    let upcoming = 0;
    for (const h of this.holidaysData) {
      if (h?.status?.value === 'Active') active++;
      const start = toDate(h?.fromDate);
      if (start && startOfDay(start).getTime() >= today.getTime()) upcoming++;
    }
    this.totalCount = this.holidaysData.length;
    this.activeCount = active;
    this.upcomingCount = upcoming;
    this.recomputeListView();
  }

  private recomputeListView(): void {
    const filter = (this.filterControl.value ?? '').toString().trim().toLowerCase();
    const filtered = filter
      ? this.holidaysData.filter((h) => (h?.name ?? '').toString().toLowerCase().includes(filter))
      : this.holidaysData.slice();
    // Sort newest-first by start date for list view.
    filtered.sort((a, b) => {
      const da = toDate(a?.fromDate)?.getTime() ?? 0;
      const db = toDate(b?.fromDate)?.getTime() ?? 0;
      return db - da;
    });
    this.filteredHolidays = filtered;

    const groups = new Map<string, any[]>();
    for (const h of filtered) {
      const d = toDate(h?.fromDate);
      const label = d ? d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Unknown';
      const list = groups.get(label) ?? [];
      list.push(h);
      groups.set(label, list);
    }
    this.groupedHolidays = Array.from(groups.entries()).map(
      ([
        label,
        items
      ]) => ({ label, items })
    );
  }

  setView(view: 'month' | 'list'): void {
    this.view = view;
    if (view === 'list' && this.listViewDirty) {
      this.recomputeListView();
    }
  }

  statusChipClass(value: string | undefined): string {
    if (!value) return '';
    const v = value.toLowerCase();
    if (v === 'active') return 'is-active';
    if (v === 'pending for activation' || v === 'pending') return 'is-pending';
    if (v === 'deleted') return 'is-deleted';
    return '';
  }

  formatDay(value: unknown): string {
    const d = toDate(value);
    return d ? String(d.getDate()) : '';
  }

  formatMonth(value: unknown): string {
    const d = toDate(value);
    return d ? d.toLocaleDateString(undefined, { month: 'short' }) : '';
  }

  formatRange(from: unknown, to: unknown): string {
    const start = toDate(from);
    const end = toDate(to);
    if (!start) return '';
    const fmt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    if (!end || sameDay(start, end)) {
      return start.toLocaleDateString(undefined, fmt);
    }
    return `${start.toLocaleDateString(undefined, fmt)} – ${end.toLocaleDateString(undefined, fmt)}`;
  }

  /** Opens the Google Calendar holiday auto-import dialog. */
  openAutoImport(): void {
    const ref = this.dialog.open(HolidayAutoImportDialogComponent, {
      width: '720px',
      maxWidth: '95vw',
      data: {
        offices: this.officeData,
        defaultOfficeId: this.officeSelector.value
      }
    });
    ref.afterClosed().subscribe((result: { imported: boolean } | undefined) => {
      if (result?.imported && this.officeSelector.value) {
        this.loadHolidays(this.officeSelector.value);
      }
    });
  }

  /* ---------- Configuration wizard hooks (unchanged behaviour). ---------- */

  showPopover(
    template: TemplateRef<any>,
    target: HTMLElement | ElementRef<any>,
    position: string,
    backdrop: boolean
  ): void {
    setTimeout(() => this.popoverService.open(template, target, position, backdrop, {}), 200);
  }

  ngAfterViewInit(): void {
    if (this.configurationWizardService.showHolidayPage === true) {
      setTimeout(() => {
        this.showPopover(this.templateButtonCreateHoliday, this.buttonCreateHoliday?.nativeElement, 'bottom', true);
      });
    }
    if (this.configurationWizardService.showHolidayFilter === true) {
      setTimeout(() => {
        this.showPopover(this.templateFilterRef, this.filterRef?.nativeElement, 'bottom', true);
      });
    }
  }

  nextStep(): void {
    this.configurationWizardService.showHolidayPage = false;
    this.configurationWizardService.showHolidayFilter = false;
    this.configurationWizardService.showCreateEmployee = true;
    this.router.navigate(['/organization']);
  }

  previousStep(): void {
    this.configurationWizardService.showHolidayPage = false;
    this.configurationWizardService.showHolidayFilter = false;
    this.configurationWizardService.showCreateHoliday = true;
    this.router.navigate(['/organization']);
  }
}
