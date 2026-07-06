import { CdkStepper } from '@angular/cdk/stepper';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import * as solidIcons from '@fortawesome/free-solid-svg-icons';
import { TranslateModule } from '@ngx-translate/core';

import { LoanProductTermsStepComponent } from './loan-product-terms-step.component';

describe('LoanProductTermsStepComponent', () => {
  let fixture: ComponentFixture<LoanProductTermsStepComponent>;
  let component: LoanProductTermsStepComponent;

  const loanProductsTemplate: any = {
    minPrincipal: 100,
    principal: 500,
    maxPrincipal: 1000,
    minNumberOfRepayments: 1,
    numberOfRepayments: 12,
    maxNumberOfRepayments: 24,
    isLinkedToFloatingInterestRates: false,
    minInterestRatePerPeriod: 1,
    interestRatePerPeriod: 5,
    maxInterestRatePerPeriod: 10,
    interestRateFrequencyType: { id: 2, value: 'Per year' },
    floatingRateId: 7,
    interestRateDifferential: 0,
    isFloatingInterestRateCalculationAllowed: false,
    allowApprovedDisbursedAmountsOverApplied: false,
    minDifferentialLendingRate: 1,
    defaultDifferentialLendingRate: 5,
    maxDifferentialLendingRate: 10,
    useBorrowerCycle: false,
    repaymentEvery: 1,
    repaymentFrequencyType: { id: 2, value: 'Months' },
    minimumDaysBetweenDisbursalAndFirstRepayment: 0,
    repaymentStartDateType: { id: 1, value: 'Disbursement date' },
    interestRecognitionOnDisbursementDate: false,
    principalVariationsForBorrowerCycle: [],
    numberOfRepaymentVariationsForBorrowerCycle: [],
    interestRateVariationsForBorrowerCycle: [],
    valueConditionTypeOptions: [{ id: 1, value: 'Equal' }],
    floatingRateOptions: [{ id: 7, name: 'Base Lending Rate' }],
    interestRateFrequencyTypeOptions: [{ id: 2, value: 'Per year' }],
    repaymentFrequencyTypeOptions: [{ id: 2, value: 'Months' }],
    repaymentStartDateTypeOptions: [{ id: 1, value: 'Disbursement date' }]
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        LoanProductTermsStepComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        { provide: MatDialog, useValue: { open: jest.fn() } },
        { provide: CdkStepper, useValue: {} },
        provideAnimationsAsync()
      ]
    }).compileComponents();

    const faIconLibrary = TestBed.inject(FaIconLibrary);
    const iconList = Object.keys(solidIcons)
      .filter((key) => key !== 'fas' && key !== 'prefix' && key.startsWith('fa'))
      .map((icon) => (solidIcons as any)[icon]);
    faIconLibrary.addIcons(...iconList);
  });

  function createComponent(templateOverrides: any = {}) {
    fixture = TestBed.createComponent(LoanProductTermsStepComponent);
    component = fixture.componentInstance;
    component.loanProductsTemplate = {
      ...loanProductsTemplate,
      ...templateOverrides
    };
    fixture.detectChanges();
  }

  it('accepts negative fixed nominal interest rates', () => {
    createComponent();

    component.loanProductTermsForm.patchValue({
      minInterestRatePerPeriod: -5,
      interestRatePerPeriod: -3,
      maxInterestRatePerPeriod: -1
    });
    fixture.detectChanges();

    expect(component.loanProductTermsForm.get('minInterestRatePerPeriod').hasError('min')).toBe(false);
    expect(component.loanProductTermsForm.get('maxInterestRatePerPeriod').hasError('min')).toBe(false);
    expect(component.loanProductTermsForm.valid).toBe(true);
    expect(component.loanProductTerms).toMatchObject({
      minInterestRatePerPeriod: -5,
      interestRatePerPeriod: -3,
      maxInterestRatePerPeriod: -1
    });
  });

  it('accepts negative floating interest rate values', () => {
    createComponent({
      isLinkedToFloatingInterestRates: true,
      interestRateDifferential: -0.25,
      minDifferentialLendingRate: -5,
      defaultDifferentialLendingRate: -3,
      maxDifferentialLendingRate: -1
    });

    expect(component.loanProductTermsForm.get('minDifferentialLendingRate').hasError('min')).toBe(false);
    expect(component.loanProductTermsForm.valid).toBe(true);
    expect(component.loanProductTerms).toMatchObject({
      floatingRatesId: 7,
      interestRateDifferential: -0.25,
      minDifferentialLendingRate: -5,
      defaultDifferentialLendingRate: -3,
      maxDifferentialLendingRate: -1
    });
  });

  it('keeps zero interest controls set to zero and disabled', () => {
    createComponent();

    component.zeroInterest.setValue(true);
    fixture.detectChanges();

    expect(component.loanProductTermsForm.get('minInterestRatePerPeriod').value).toBe(0);
    expect(component.loanProductTermsForm.get('interestRatePerPeriod').value).toBe(0);
    expect(component.loanProductTermsForm.get('maxInterestRatePerPeriod').value).toBe(0);
    expect(component.loanProductTermsForm.get('minInterestRatePerPeriod').disabled).toBe(true);
    expect(component.loanProductTermsForm.get('interestRatePerPeriod').disabled).toBe(true);
    expect(component.loanProductTermsForm.get('maxInterestRatePerPeriod').disabled).toBe(true);
    expect(component.loanProductTerms).toMatchObject({
      minInterestRatePerPeriod: 0,
      interestRatePerPeriod: 0,
      maxInterestRatePerPeriod: 0
    });
  });
});
