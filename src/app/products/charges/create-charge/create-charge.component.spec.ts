import { DatePipe } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { CreateChargeComponent } from './create-charge.component';
import { ProductsService } from '../../products.service';
import { SettingsService } from 'app/settings/settings.service';
import { AuthenticationService } from 'app/core/authentication/authentication.service';

describe('CreateChargeComponent', () => {
  let component: CreateChargeComponent;
  let fixture: ComponentFixture<CreateChargeComponent>;

  const mockChargesTemplate: any = {
    chargeAppliesToOptions: [
      { id: 1, value: 'Loan' }],
    currencyOptions: [
      { code: 'USD', name: 'US Dollar', decimalPlaces: 2 }],
    loanChargeTimeTypeOptions: [
      { id: 9, code: 'chargeTimeType.overdueInstallment', value: 'Overdue Installment' },
      { id: 12, code: 'chargeTimeType.trancheDisbursement', value: 'Tranche Disbursement' },
      { id: 17, code: 'chargeTimeType.loanPeriodic', value: 'Periodic Loan Charge' }
    ],
    savingsChargeTimeTypeOptions: [],
    clientChargeTimeTypeOptions: [],
    shareChargeTimeTypeOptions: [],
    loanChargeCalculationTypeOptions: [
      { id: 1, value: 'Flat' },
      { id: 5, value: '% of disbursement amount' }
    ],
    savingsChargeCalculationTypeOptions: [],
    clientChargeCalculationTypeOptions: [],
    shareChargeCalculationTypeOptions: [],
    chargePaymetModeOptions: [
      { id: 0, value: 'Regular' }],
    feeFrequencyOptions: [
      { id: 0, code: 'DAYS', value: 'Days' },
      { id: 1, code: 'WEEKS', value: 'Weeks' },
      { id: 2, code: 'MONTHS', value: 'Months' },
      { id: 3, code: 'YEARS', value: 'Years' }
    ],
    taxGroupOptions: [],
    incomeOrLiabilityAccountOptions: {
      incomeAccountOptions: [],
      liabilityAccountOptions: []
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CreateChargeComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ chargesTemplate: mockChargesTemplate })
          }
        },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: ProductsService, useValue: { createCharge: jest.fn(() => of({})) } },
        {
          provide: SettingsService,
          useValue: {
            language: { code: 'en' }
          }
        },
        {
          provide: AuthenticationService,
          useValue: {
            getCredentials: () => ({ permissions: ['ALL_FUNCTIONS'] })
          }
        },
        DatePipe,
        provideNativeDateAdapter(),
        provideAnimationsAsync()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CreateChargeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('adds required periodic recurrence controls when periodic loan charge is selected', () => {
    component.chargeForm.patchValue({
      chargeAppliesTo: 1,
      chargeTimeType: 17
    });

    expect(component.chargeForm.contains('feeFrequency')).toBe(true);
    expect(component.chargeForm.contains('feeInterval')).toBe(true);
    expect(component.chargeForm.controls.feeFrequency.hasError('required')).toBe(true);
    expect(component.chargeForm.controls.feeInterval.hasError('required')).toBe(true);
  });

  it('does not add feeOnMonthDay when periodic loan charge is selected', () => {
    component.chargeForm.patchValue({
      chargeAppliesTo: 1,
      chargeTimeType: 17
    });

    expect(component.chargeForm.contains('feeOnMonthDay')).toBe(false);
  });

  it('filters periodic charge frequency options down to weeks, months, and years', () => {
    expect(component.periodicFeeFrequencyOptions.map((option) => option.code)).toEqual([
      'WEEKS',
      'MONTHS',
      'YEARS'
    ]);
  });

  it('keeps disbursement-percentage calculation unavailable for periodic loan charges', () => {
    component.chargeForm.patchValue({
      chargeAppliesTo: 1,
      chargeTimeType: 17
    });

    expect(component.filteredChargeCalculationType()).toEqual([{ id: 1, value: 'Flat' }]);
  });
});
