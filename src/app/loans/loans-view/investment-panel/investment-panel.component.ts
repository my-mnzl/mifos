import { Component, DestroyRef, inject, Input, OnChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { TranslateModule } from '@ngx-translate/core';
import { finalize, Subscription } from 'rxjs';
import { InvestmentService, NativeInvestment } from './investment.service';

@Component({
  selector: 'mifosx-investment-panel',
  templateUrl: './investment-panel.component.html',
  styleUrls: ['./investment-panel.component.scss'],
  imports: [
    MatButtonModule,
    MatExpansionModule,
    TranslateModule,
    PercentPipe,
    DecimalPipe
  ]
})
export class InvestmentPanelComponent implements OnChanges {
  @Input({ required: true }) loanId: number;
  private service = inject(InvestmentService);
  private destroyRef = inject(DestroyRef);
  private request?: Subscription;
  expanded = false;
  loading = false;
  loaded = false;
  notApplicable = false;
  errorKey = '';
  investment?: NativeInvestment;

  ngOnChanges() {
    this.request?.unsubscribe();
    this.investment = undefined;
    this.loaded = false;
    this.notApplicable = false;
    this.errorKey = '';
    if (this.expanded) this.load();
  }

  open() {
    this.expanded = true;
    if (!this.loaded && !this.loading) this.load();
  }

  load(includeProjections = false) {
    if (this.loading) return;
    this.loading = true;
    this.errorKey = '';
    this.request = this.service
      .read(this.loanId, includeProjections)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: (response) => {
          this.loaded = true;
          this.notApplicable = !response.applicable;
          this.investment = response.applicable ? response : undefined;
        },
        error: (error: HttpErrorResponse) => {
          this.errorKey =
            error.status === 401 || error.status === 403
              ? 'investment.permissionError'
              : error.status === 404
                ? 'investment.unavailableError'
                : 'investment.loadError';
        }
      });
  }

  get digitsInfo(): string {
    const places = this.investment.currency.decimalPlaces;
    return `1.${places}-${places}`;
  }

  amount(minor: string): number {
    return Number(minor) / 10 ** this.investment.currency.decimalPlaces;
  }
}
