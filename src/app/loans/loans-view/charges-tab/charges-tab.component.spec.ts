import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ChargesTabComponent } from './charges-tab.component';
import { LoansService } from 'app/loans/loans.service';
import { SettingsService } from 'app/settings/settings.service';
import { Dates } from 'app/core/utils/dates';
import { SystemService } from 'app/system/system.service';
import { ProductsService } from 'app/products/products.service';

describe('ChargesTabComponent', () => {
  let component: ChargesTabComponent;
  let fixture: ComponentFixture<ChargesTabComponent>;

  const loanDetailsData = {
    id: 16998,
    clientId: 46614,
    loanProductId: 81,
    currency: { code: 'USD' },
    status: { value: 'Active' },
    charges: [
      {
        id: 13,
        chargeId: 13,
        name: 'Admin Fees - 1.9%',
        penalty: false,
        paid: false,
        waived: false,
        chargePayable: false,
        amount: 1.99,
        amountPaid: 0,
        amountWaived: 0,
        amountOutstanding: 1.99,
        currency: { code: 'USD' },
        dueDate: '2026-03-15',
        submittedOnDate: '2026-03-15',
        chargeTimeType: { id: 1, code: 'chargeTimeType.disbursement', value: 'Disbursement' },
        chargeCalculationType: { value: 'Percentage amount' }
      }
    ]
  };

  const periodicCharge = {
    id: 21,
    name: 'Insurance Fee',
    amount: 10,
    currency: { code: 'USD' },
    chargeTimeType: { id: 17, code: 'chargeTimeType.loanPeriodic', value: 'Periodic Loan Charge' },
    chargeCalculationType: { value: 'Flat' },
    feeInterval: 2,
    feeFrequency: { id: 2, code: 'MONTHS', value: 'Months' }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChargesTabComponent,
        TranslateModule.forRoot()
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            parent: {
              data: of({ loanDetailsData })
            },
            snapshot: { params: {} }
          }
        },
        {
          provide: Router,
          useValue: {
            url: '/clients/46614/loans-accounts/16998/charges',
            navigate: jest.fn(),
            navigateByUrl: jest.fn(() => Promise.resolve(true))
          }
        },
        { provide: MatDialog, useValue: { open: jest.fn() } },
        { provide: LoansService, useValue: {} },
        {
          provide: SettingsService,
          useValue: {
            dateFormat: 'dd MMMM yyyy',
            language: { code: 'en-US' }
          }
        },
        {
          provide: Dates,
          useValue: {
            parseDate: jest.fn((value: string) => new Date(value)),
            formatDate: jest.fn((value: string) => value)
          }
        },
        {
          provide: SystemService,
          useValue: {
            getConfigurationByName: jest.fn(() => of({ stringValue: 'due-date' }))
          }
        },
        {
          provide: ProductsService,
          useValue: {
            getLoanProduct: jest.fn(() =>
              of({
                charges: [
                  periodicCharge,
                  {
                    id: 9,
                    name: 'Admin Fees - 1.9%',
                    chargeTimeType: { id: 1, code: 'chargeTimeType.disbursement', value: 'Disbursement' }
                  }
                ]
              })
            )
          }
        },
        provideAnimationsAsync()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChargesTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows product periodic charges that are not yet materialized on the loan', () => {
    expect(component.productPeriodicCharges).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Product periodic charges');
    expect(fixture.nativeElement.textContent).toContain('Insurance Fee');
    expect(fixture.nativeElement.textContent).toContain('Every 2 months, starts on first repayment date');
    expect(fixture.nativeElement.textContent).toContain(
      'These charges are configured on the loan product and materialize on the loan when due.'
    );
  });
});
