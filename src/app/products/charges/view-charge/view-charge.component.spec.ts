import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { ViewChargeComponent } from './view-charge.component';
import { ProductsService } from 'app/products/products.service';
import { AuthenticationService } from 'app/core/authentication/authentication.service';

describe('ViewChargeComponent', () => {
  let component: ViewChargeComponent;
  let fixture: ComponentFixture<ViewChargeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ViewChargeComponent,
        TranslateModule.forRoot()
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({
              charge: {
                id: 9,
                chargeTimeType: { id: 17, code: 'chargeTimeType.loanPeriodic', value: 'Periodic Loan Charge' },
                feeInterval: 1,
                feeFrequency: { id: 3, code: 'YEARS', value: 'Years' }
              }
            })
          }
        },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: MatDialog, useValue: { open: jest.fn() } },
        { provide: ProductsService, useValue: { deleteCharge: jest.fn(() => of({})) } },
        {
          provide: AuthenticationService,
          useValue: {
            getCredentials: () => ({ permissions: ['ALL_FUNCTIONS'] })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ViewChargeComponent);
    component = fixture.componentInstance;
  });

  it('shows recurring fee details for periodic loan charges', () => {
    expect(component.showRecurringFeeDetails()).toBe(true);
  });

  it('does not show recurring fee details for non-recurring charge times', () => {
    component.chargeData = {
      chargeTimeType: { id: 1, code: 'chargeTimeType.disbursement', value: 'Disbursement' }
    };

    expect(component.showRecurringFeeDetails()).toBe(false);
  });
});
