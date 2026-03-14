import { DecimalPipe } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CdkStepper } from '@angular/cdk/stepper';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import * as solidIcons from '@fortawesome/free-solid-svg-icons';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { LoansAccountPreviewStepComponent } from './loans-account-preview-step.component';
import { SettingsService } from 'app/settings/settings.service';

describe('LoansAccountPreviewStepComponent', () => {
  let component: LoansAccountPreviewStepComponent;
  let fixture: ComponentFixture<LoansAccountPreviewStepComponent>;

  const periodicCharge = {
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
        LoansAccountPreviewStepComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        {
          provide: SettingsService,
          useValue: {
            dateFormat: 'dd MMMM yyyy',
            language: { code: 'en' },
            decimals: 2
          }
        },
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} } } },
        { provide: Router, useValue: { navigate: jest.fn() } },
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

    fixture = TestBed.createComponent(LoansAccountPreviewStepComponent);
    component = fixture.componentInstance;
    component.loansAccountProductTemplate = {
      product: { enableDownPayment: false },
      currency: { code: 'USD' },
      overdueCharges: [],
      loanPurposeOptions: []
    };
    component.loansAccount = {
      principalAmount: 100,
      charges: [periodicCharge]
    };
    component.ngOnChanges({} as any);
    fixture.detectChanges();
  });

  it('renders a recurrence summary for periodic loan charges in the preview table', () => {
    expect(fixture.nativeElement.textContent).toContain('Every 1 year, starts on first repayment date');
  });
});
