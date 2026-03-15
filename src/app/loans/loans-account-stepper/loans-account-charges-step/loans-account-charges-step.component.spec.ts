import { DecimalPipe } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { CdkStepper } from '@angular/cdk/stepper';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import * as solidIcons from '@fortawesome/free-solid-svg-icons';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { LoansAccountChargesStepComponent } from './loans-account-charges-step.component';
import { Dates } from 'app/core/utils/dates';
import { SettingsService } from 'app/settings/settings.service';

describe('LoansAccountChargesStepComponent', () => {
  let component: LoansAccountChargesStepComponent;
  let fixture: ComponentFixture<LoansAccountChargesStepComponent>;

  const periodicCharge = {
    id: 17,
    chargeId: 17,
    name: 'Insurance Fee',
    amount: 20,
    currency: { displaySymbol: '$' },
    chargeCalculationType: { value: 'Flat' },
    chargeTimeType: { id: 17, code: 'chargeTimeType.loanPeriodic', value: 'Periodic Loan Charge' },
    feeInterval: 1,
    feeFrequency: { id: 3, code: 'YEARS', value: 'Years' }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        LoansAccountChargesStepComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} } } },
        {
          provide: MatDialog,
          useValue: {
            open: jest.fn(() => ({ afterClosed: () => ({ subscribe: jest.fn() }) }))
          }
        },
        {
          provide: Dates,
          useValue: {
            formatDate: jest.fn((value) => value)
          }
        },
        {
          provide: SettingsService,
          useValue: {
            dateFormat: 'dd MMMM yyyy',
            language: { code: 'en' },
            decimals: 2
          }
        },
        { provide: CdkStepper, useValue: {} },
        DecimalPipe,
        provideAnimationsAsync()
      ]
    }).compileComponents();

    const faIconLibrary = TestBed.inject(FaIconLibrary);
    const iconList = Object.keys(solidIcons)
      .filter((key) => key !== 'fas' && key !== 'prefix' && key.startsWith('fa'))
      .map((icon) => (solidIcons as any)[icon]);
    faIconLibrary.addIcons(...iconList);

    fixture = TestBed.createComponent(LoansAccountChargesStepComponent);
    component = fixture.componentInstance;
    component.loansAccountTemplate = { charges: [periodicCharge] };
    component.loansAccountProductTemplate = {
      chargeOptions: [periodicCharge],
      charges: [periodicCharge],
      overdueCharges: [],
      loanPurposeOptions: []
    };
    component.loansAccountFormValid = true;
    component.activeClientMembers = [];
    component.ngOnChanges();
    fixture.detectChanges();
  });

  it('renders a recurrence summary for periodic loan charges before materialization', () => {
    expect(fixture.nativeElement.textContent).toContain('Every 1 year, starts on first repayment date');
  });

  it('does not allow date editing for periodic loan charges', () => {
    expect(component.canEditChargeDate(periodicCharge)).toBe(false);
  });
});
