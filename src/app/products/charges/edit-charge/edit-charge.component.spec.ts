import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { EditChargeComponent } from './edit-charge.component';
import { ProductsService } from 'app/products/products.service';
import { SettingsService } from 'app/settings/settings.service';
import { AuthenticationService } from 'app/core/authentication/authentication.service';

describe('EditChargeComponent', () => {
  let component: EditChargeComponent;
  let fixture: ComponentFixture<EditChargeComponent>;

  const mockChargeTemplate: any = {
    id: 42,
    name: 'Insurance Fee',
    active: true,
    penalty: false,
    amount: 25,
    currency: { code: 'USD', name: 'US Dollar' },
    chargeAppliesTo: { id: 1, value: 'Loan' },
    chargeTimeType: { id: 17, code: 'chargeTimeType.loanPeriodic', value: 'Periodic Loan Charge' },
    chargeCalculationType: { id: 1, value: 'Flat' },
    chargePaymentMode: { id: 0, value: 'Regular' },
    feeInterval: 1,
    feeFrequency: { id: 3, code: 'YEARS', value: 'Years' },
    taxGroupOptions: [],
    loanChargeTimeTypeOptions: [
      { id: 9, code: 'chargeTimeType.overdueInstallment', value: 'Overdue Installment' },
      { id: 12, code: 'chargeTimeType.trancheDisbursement', value: 'Tranche Disbursement' },
      { id: 17, code: 'chargeTimeType.loanPeriodic', value: 'Periodic Loan Charge' }
    ],
    loanChargeCalculationTypeOptions: [
      { id: 1, value: 'Flat' },
      { id: 5, value: '% of disbursement amount' }
    ],
    feeFrequencyOptions: [
      { id: 0, code: 'DAYS', value: 'Days' },
      { id: 1, code: 'WEEKS', value: 'Weeks' },
      { id: 2, code: 'MONTHS', value: 'Months' },
      { id: 3, code: 'YEARS', value: 'Years' }
    ],
    currencyOptions: [
      { code: 'USD', name: 'US Dollar' }]
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        EditChargeComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ chargesTemplate: mockChargeTemplate })
          }
        },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: ProductsService, useValue: { updateCharge: jest.fn(() => of({})) } },
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
        provideAnimationsAsync()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EditChargeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows periodic recurrence controls for periodic loan charges', () => {
    expect(component.isPeriodicChargeTimeSelected()).toBe(true);
    expect(component.showFeeOptions).toBe(true);
    expect(component.addFeeFrequency).toBe(false);
    expect(component.chargeForm.controls.feeInterval.value).toBe(1);
    expect(component.chargeForm.controls.feeFrequency.value).toBe(3);
  });

  it('filters periodic frequency options to supported recurrence units only', () => {
    expect(component.periodicFeeFrequencyOptions.map((option) => option.code)).toEqual([
      'WEEKS',
      'MONTHS',
      'YEARS'
    ]);
  });

  it('keeps disbursement-percentage calculation unavailable for periodic loan charges', () => {
    expect(component.filteredChargeCalculationType()).toEqual([{ id: 1, value: 'Flat' }]);
  });
});
