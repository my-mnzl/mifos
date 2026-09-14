import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { InvestmentPanelComponent } from './investment-panel.component';
import { NativeInvestment } from './investment.service';
import translations from '../../../../assets/translations/en-US.json';

const investment: NativeInvestment = {
  applicable: true,
  externalReceivableId: 'receivable-1',
  currency: { code: 'EGP', decimalPlaces: 2 },
  position: {
    businessDate: '2026-09-06',
    boundarySide: 'AFTER_EVENTS',
    eventWatermark: '17',
    contractualOutstandingMinor: '391000000',
    grossPurchaseBasisMinor: '246313030',
    deferredDiscountMinor: '144686970',
    deferredIntegralFeeMinor: '2463130',
    amortizedCostMinor: '243849900',
    lossAllowanceMinor: '0',
    netCarryingMinor: '243849900',
    grossYield: '0.22099999932335326',
    netEir: '0.22609420697037464',
    riskAssessmentStatus: 'PENDING',
    stage: null
  }
};

describe('InvestmentPanelComponent', () => {
  let fixture: ComponentFixture<InvestmentPanelComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        InvestmentPanelComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot()
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();
    TestBed.inject(TranslateService).setTranslation('en', translations);
    TestBed.inject(TranslateService).use('en');
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InvestmentPanelComponent);
    fixture.componentRef.setInput('loanId', 102269);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function respond(data = investment, projections = false) {
    const request = http.expectOne(`/loans/102269/mnzl-investment?includeProjections=${projections}`);
    request.flush(data);
    fixture.detectChanges();
  }

  it('loads position only after opening and projections only after requesting them', () => {
    http.expectNone(() => true);
    fixture.componentInstance.open();
    respond();
    fixture.componentInstance.open();
    http.expectNone(() => true);
    fixture.componentInstance.load(true);
    respond(
      {
        ...investment,
        projection: {
          fromDate: '2026-09-06',
          rows: [
            {
              date: '2027-07-30',
              openingCarryingMinor: '243849900',
              cashReceiptMinor: '112000000',
              investmentRecoveryMinor: '60000000',
              eirIncomeMinor: '52000000',
              closingCarryingMinor: '183849900'
            }
          ]
        }
      },
      true
    );
    expect(fixture.nativeElement.textContent).toContain('600,000.00');
    expect(fixture.nativeElement.textContent).toContain('520,000.00');
    expect(fixture.nativeElement.textContent).toContain('1,838,499.00');
  });

  it('does not present an unassessed zero allowance as assessed zero', () => {
    fixture.componentInstance.open();
    respond();
    const amounts = fixture.nativeElement.querySelectorAll('dd');
    expect(amounts[5].textContent).toContain('Risk assessment pending');
    expect(amounts[6].textContent).toContain('Risk assessment pending');
    fixture.componentInstance.load();
    respond({ ...investment, position: { ...investment.position, riskAssessmentStatus: 'ASSESSED' } });
    expect(amounts[5].textContent).toContain('0.00');
    expect(amounts[6].textContent).toContain('2,438,499.00');
  });

  it.each([
    403,
    404,
    0,
    500
  ])('keeps HTTP %s failures distinct from non-applicability and allows retry', (status) => {
    fixture.componentInstance.open();
    http
      .expectOne('/loans/102269/mnzl-investment?includeProjections=false')
      .flush({}, { status, statusText: 'Failed' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.componentInstance.notApplicable).toBe(false);
    fixture.componentInstance.load();
    http.expectOne('/loans/102269/mnzl-investment?includeProjections=false').flush({ applicable: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('not linked to a native purchased receivable');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('cancels the previous loan request when navigating to another loan', () => {
    fixture.componentInstance.open();
    const previous = http.expectOne('/loans/102269/mnzl-investment?includeProjections=false');
    fixture.componentRef.setInput('loanId', 102270);
    fixture.detectChanges();
    expect(previous.cancelled).toBe(true);
    http.expectOne('/loans/102270/mnzl-investment?includeProjections=false').flush({ applicable: false });
    expect(fixture.componentInstance.investment).toBeUndefined();
  });

  it('explains why overdue cashflows cannot be projected', () => {
    fixture.componentInstance.open();
    respond({
      ...investment,
      projection: { fromDate: '2026-09-06', rows: [], unavailableReason: 'OVERDUE_CASHFLOWS' }
    });
    expect(fixture.nativeElement.textContent).toContain('future collection dates are unknown');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });
});
