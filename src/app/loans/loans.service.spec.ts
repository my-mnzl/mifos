import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { LoansService } from './loans.service';
import { Dates } from 'app/core/utils/dates';
import { SettingsService } from 'app/settings/settings.service';

describe('LoansService', () => {
  let service: LoansService;
  let mockDateUtils: { formatDate: jest.Mock };

  beforeEach(() => {
    mockDateUtils = {
      formatDate: jest.fn((value: any) => `formatted:${value}`)
    };

    TestBed.configureTestingModule({
      providers: [
        LoansService,
        { provide: HttpClient, useValue: {} },
        { provide: Dates, useValue: mockDateUtils },
        {
          provide: SettingsService,
          useValue: {
            dateFormat: 'dd MMMM yyyy',
            language: { code: 'en' },
            businessDate: '2026-03-15'
          }
        }
      ]
    });

    service = TestBed.inject(LoansService);
  });

  it('forwards all manual loan charges including periodic charges', () => {
    const periodicCharge = {
      chargeId: 21,
      amount: 10,
      chargeTimeType: {
        id: 17,
        code: 'chargeTimeType.loanPeriodic',
        value: 'Periodic Loan Charge'
      }
    };
    const disbursementCharge = {
      chargeId: 13,
      amount: 1.99,
      chargeTimeType: {
        id: 1,
        code: 'chargeTimeType.disbursement',
        value: 'Disbursement'
      }
    };

    expect(
      service.filterManualLoanCharges([
        disbursementCharge,
        periodicCharge
      ])
    ).toEqual([
      disbursementCharge,
      periodicCharge
    ]);
  });

  it('forwards periodic loan charges when building the loan request payload', () => {
    const payload = service.buildLoanRequestPayload(
      {
        charges: [
          {
            chargeId: 13,
            amount: 1.99,
            dueDate: '2026-03-20',
            chargeTimeType: {
              id: 2,
              code: 'chargeTimeType.specifiedDueDate',
              value: 'Specified due date'
            }
          },
          {
            chargeId: 21,
            amount: 10,
            dueDate: '2026-04-15',
            chargeTimeType: {
              id: 17,
              code: 'chargeTimeType.loanPeriodic',
              value: 'Periodic Loan Charge'
            }
          }
        ],
        disbursementData: [],
        interestChargedFromDate: '2026-03-15',
        repaymentsStartingFromDate: '2026-04-15',
        submittedOnDate: '2026-03-15',
        expectedDisbursementDate: '2026-03-15',
        principalAmount: 1000,
        interestCalculationPeriodType: 1,
        allowPartialPeriodInterestCalculation: true,
        multiDisburseLoan: false
      },
      { clientId: 1 },
      [],
      'en',
      'dd MMMM yyyy'
    );

    expect(payload.charges).toEqual([
      {
        chargeId: 13,
        amount: 1.99,
        dueDate: 'formatted:2026-03-20'
      },
      {
        chargeId: 21,
        amount: 10,
        dueDate: 'formatted:2026-04-15'
      }
    ]);
  });
});
