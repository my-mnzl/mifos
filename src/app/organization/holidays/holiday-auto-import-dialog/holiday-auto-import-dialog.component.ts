import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { UntypedFormBuilder, UntypedFormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatProgressBar } from '@angular/material/progress-bar';
import { TranslateService } from '@ngx-translate/core';
import { from, of } from 'rxjs';
import { catchError, finalize, map, mergeMap, tap } from 'rxjs/operators';

import { OrganizationService } from '../../organization.service';
import { SettingsService } from 'app/settings/settings.service';
import { Dates } from 'app/core/utils/dates';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';
import { parseICalEvents, ParsedICalEvent } from './ical-parser';

interface DialogData {
  offices: Array<{ id: number; name: string }>;
  defaultOfficeId: number | null;
}

interface PreviewRow extends ParsedICalEvent {
  selected: boolean;
}

/** Shape of the payload we POST to /holidays. Matches what create-holiday sends. */
interface HolidayCreatePayload {
  name: string;
  fromDate: string;
  toDate: string;
  reschedulingType: number;
  description: string;
  offices: Array<{ officeId: number }>;
  dateFormat: string;
  locale: string;
  repaymentsRescheduledTo?: string;
}

const HOLIDAY_CALENDAR_ID = 'en.eg.official#holiday@group.v.calendar.google.com';
const IMPORT_CONCURRENCY = 3;

/**
 * Public iCal feed for the calendar. Google's iCal endpoint does not return CORS
 * headers, so the request is routed through corsproxy.io.
 */
function buildIcsUrl(): string {
  const encodedId = encodeURIComponent(HOLIDAY_CALENDAR_ID);
  const target = `https://calendar.google.com/calendar/ical/${encodedId}/public/basic.ics`;
  return `https://corsproxy.io/?${encodeURIComponent(target)}`;
}

@Component({
  selector: 'mifosx-holiday-auto-import-dialog',
  standalone: true,
  templateUrl: './holiday-auto-import-dialog.component.html',
  styleUrls: ['./holiday-auto-import-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatButton,
    MatCheckbox,
    MatProgressBar
  ]
})
export class HolidayAutoImportDialogComponent implements OnInit {
  private fb = inject(UntypedFormBuilder);
  private http = inject(HttpClient);
  private organizationService = inject(OrganizationService);
  private settings = inject(SettingsService);
  private dateUtils = inject(Dates);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<HolidayAutoImportDialogComponent>);

  configForm: UntypedFormGroup;
  yearOptions: number[] = [];
  reschedulingOptions = [
    { id: 1, value: 'Reschedule to next repayment date' },
    { id: 2, value: 'Reschedule to a specific date' }
  ];

  loading = false;
  importing = false;
  errorMessage = '';
  preview: PreviewRow[] = [];
  importProgress = { done: 0, total: 0 };
  importResult: { success: number; failed: number } | null = null;

  data = inject<DialogData>(MAT_DIALOG_DATA);

  constructor() {
    const currentYear = new Date().getFullYear();
    this.yearOptions = [
      currentYear - 1,
      currentYear,
      currentYear + 1,
      currentYear + 2
    ];

    const defaultOffices: number[] = this.data.defaultOfficeId != null ? [this.data.defaultOfficeId] : [];
    this.configForm = this.fb.group({
      year: [
        currentYear,
        Validators.required
      ],
      reschedulingType: [
        1,
        Validators.required
      ],
      offices: [
        defaultOffices,
        Validators.required
      ]
    });
  }

  ngOnInit(): void {
    this.fetch();
  }

  fetch(): void {
    this.loading = true;
    this.errorMessage = '';
    this.preview = [];
    this.importResult = null;

    this.http.get(buildIcsUrl(), { responseType: 'text' }).subscribe({
      next: (ics) => {
        const events = parseICalEvents(ics);
        const year = this.configForm.value.year;
        this.preview = events
          .filter((e) => e.start.getFullYear() === year)
          .sort((a, b) => a.start.getTime() - b.start.getTime())
          .map((e) => ({ ...e, selected: true }));
        this.loading = false;
        if (this.preview.length === 0) {
          this.errorMessage = `No holidays found for ${year}.`;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = this.translate.instant(
          'labels.text.Could not load holidays from Google Calendar'
        ) as string;
        if (!this.errorMessage || this.errorMessage.startsWith('labels.')) {
          this.errorMessage =
            'Could not load holidays from Google Calendar. Check your network connection and try again.';
        }
        this.cdr.markForCheck();
      }
    });
  }

  toggleAll(checked: boolean): void {
    this.preview = this.preview.map((row) => ({ ...row, selected: checked }));
  }

  toggleRow(row: PreviewRow): void {
    row.selected = !row.selected;
    this.preview = [...this.preview];
  }

  get allSelected(): boolean {
    return this.preview.length > 0 && this.preview.every((r) => r.selected);
  }

  get someSelected(): boolean {
    return this.preview.some((r) => r.selected) && !this.allSelected;
  }

  get selectedCount(): number {
    return this.preview.filter((r) => r.selected).length;
  }

  get importPercent(): number {
    if (!this.importProgress.total) return 0;
    return Math.round((this.importProgress.done / this.importProgress.total) * 100);
  }

  toggleOffice(officeId: number): void {
    const current: number[] = this.configForm.value.offices ?? [];
    const next = current.includes(officeId) ? current.filter((id) => id !== officeId) : [
          ...current,
          officeId
        ];
    this.configForm.patchValue({ offices: next });
  }

  isOfficeSelected(officeId: number): boolean {
    return (this.configForm.value.offices ?? []).includes(officeId);
  }

  cancel(): void {
    this.dialogRef.close({ imported: false });
  }

  /**
   * Imports the selected holidays with limited concurrency so we don't stampede the
   * backend, and surfaces a per-item progress bar instead of an opaque spinner.
   */
  confirm(): void {
    const selected = this.preview.filter((r) => r.selected);
    const officeIds: number[] = this.configForm.value.offices ?? [];
    if (selected.length === 0 || officeIds.length === 0 || this.configForm.invalid) {
      return;
    }
    this.importing = true;
    this.importProgress = { done: 0, total: selected.length };

    // Send ISO dates with a fixed dateFormat / locale. The display-side DateFormatPipe
    // mutates moment's global locale on every render, so a localized format like
    // 'DD MMMM YYYY' would produce e.g. Arabic month names while the request claims
    // locale='en' — and the backend would reject the payload.
    const dateFormat = 'yyyy-MM-dd';
    const locale = 'en';
    const momentFormat = 'YYYY-MM-DD';
    const reschedulingType = this.configForm.value.reschedulingType;
    const offices = officeIds.map((id) => ({ officeId: id }));
    const description = this.translate.instant('labels.text.Imported from Google Calendar') as string;

    let success = 0;
    let failed = 0;
    from(selected)
      .pipe(
        mergeMap((row) => {
          const payload: HolidayCreatePayload = {
            name: row.summary,
            fromDate: this.dateUtils.formatDateAsString(row.start, momentFormat),
            toDate: this.dateUtils.formatDateAsString(row.end, momentFormat),
            reschedulingType,
            description: description.startsWith('labels.') ? 'Imported from Google Calendar' : description,
            offices,
            dateFormat,
            locale
          };
          if (reschedulingType === 2) {
            const next = new Date(row.end);
            next.setDate(next.getDate() + 1);
            payload.repaymentsRescheduledTo = this.dateUtils.formatDateAsString(next, momentFormat);
          }
          return this.organizationService.createHoliday(payload).pipe(
            map(() => true),
            catchError(() => of(false))
          );
        }, IMPORT_CONCURRENCY),
        tap((ok) => {
          if (ok) success++;
          else failed++;
          this.importProgress = { done: success + failed, total: selected.length };
          this.cdr.markForCheck();
        }),
        finalize(() => {
          this.importing = false;
          this.importResult = { success, failed };
          this.cdr.markForCheck();
          if (failed === 0) {
            setTimeout(() => this.dialogRef.close({ imported: true }), 700);
          }
        })
      )
      .subscribe();
  }

  finish(): void {
    this.dialogRef.close({ imported: !!this.importResult && this.importResult.success > 0 });
  }
}
