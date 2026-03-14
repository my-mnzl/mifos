import {
  formatPeriodicLoanChargeSummary,
  isPeriodicLoanChargeTime,
  isSpecifiedDueDateChargeTime
} from './charge-time-type';

describe('charge-time-type utils', () => {
  it('detects periodic loan charges by code', () => {
    expect(
      isPeriodicLoanChargeTime({
        code: 'chargeTimeType.loanPeriodic',
        id: 999,
        value: 'Something else'
      })
    ).toBe(true);
  });

  it('detects periodic loan charges by id', () => {
    expect(isPeriodicLoanChargeTime(17)).toBe(true);
  });

  it('detects specified due date charges by code', () => {
    expect(isSpecifiedDueDateChargeTime({ code: 'chargeTimeType.specifiedDueDate' })).toBe(true);
  });

  it('formats yearly periodic recurrence summaries', () => {
    expect(
      formatPeriodicLoanChargeSummary({
        feeInterval: 1,
        feeFrequency: { code: 'YEARS', value: 'Years' }
      })
    ).toBe('Every 1 year, starts on first repayment date');
  });

  it('pluralizes periodic recurrence summaries when interval is greater than one', () => {
    expect(
      formatPeriodicLoanChargeSummary({
        feeInterval: 2,
        feeFrequency: { code: 'MONTHS', value: 'Months' }
      })
    ).toBe('Every 2 months, starts on first repayment date');
  });

  it('falls back safely when periodic recurrence fields are incomplete', () => {
    expect(formatPeriodicLoanChargeSummary({ feeInterval: null, feeFrequency: null })).toBe(
      'Starts on first repayment date'
    );
  });
});
