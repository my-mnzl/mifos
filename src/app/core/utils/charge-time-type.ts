import { OptionData } from 'app/shared/models/option-data.model';

export interface ChargeTimeTypeLike {
  id?: number | null;
  code?: string | null;
  value?: string | null;
}

export interface FeeFrequencyLike {
  id?: number | null;
  code?: string | null;
  value?: string | null;
}

type ChargeTimeTypeInput = ChargeTimeTypeLike | number | string | null | undefined;

export const ChargeTimeTypeId = {
  SpecifiedDueDate: 2,
  AnnualFee: 6,
  MonthlyFee: 7,
  OverdueInstallment: 9,
  WeeklyFee: 11,
  TrancheDisbursement: 12,
  LoanPeriodic: 17
} as const;

export const ChargeTimeTypeCode = {
  Disbursement: 'chargeTimeType.disbursement',
  SpecifiedDueDate: 'chargeTimeType.specifiedDueDate',
  AnnualFee: 'chargeTimeType.annualFee',
  MonthlyFee: 'chargeTimeType.monthlyFee',
  OverdueInstallment: 'chargeTimeType.overdueInstallment',
  WeeklyFee: 'chargeTimeType.weeklyFee',
  TrancheDisbursement: 'chargeTimeType.trancheDisbursement',
  LoanPeriodic: 'chargeTimeType.loanPeriodic'
} as const;

const ChargeTimeTypeValue = {
  Disbursement: 'Disbursement',
  SpecifiedDueDate: 'Specified due date',
  AnnualFee: 'Annual Fee',
  MonthlyFee: 'Monthly Fee',
  OverdueInstallment: 'Overdue Installment',
  WeeklyFee: 'Weekly Fee',
  TrancheDisbursement: 'Tranche Disbursement',
  LoanPeriodic: 'Periodic Loan Charge'
} as const;

function normalizeChargeTimeType(input: ChargeTimeTypeInput): ChargeTimeTypeLike {
  if (input == null) {
    return {};
  }

  if (typeof input === 'number') {
    return { id: input };
  }

  if (typeof input === 'string') {
    return input.startsWith('chargeTimeType.') ? { code: input } : { value: input };
  }

  return input;
}

function matchesChargeTimeType(
  input: ChargeTimeTypeInput,
  matcher: { id: number; code: string; value: string }
): boolean {
  const chargeTimeType = normalizeChargeTimeType(input);

  return (
    chargeTimeType.code === matcher.code || chargeTimeType.id === matcher.id || chargeTimeType.value === matcher.value
  );
}

export function isDisbursementChargeTime(input: ChargeTimeTypeInput): boolean {
  return matchesChargeTimeType(input, {
    id: 1,
    code: ChargeTimeTypeCode.Disbursement,
    value: ChargeTimeTypeValue.Disbursement
  });
}

export function isSpecifiedDueDateChargeTime(input: ChargeTimeTypeInput): boolean {
  return matchesChargeTimeType(input, {
    id: ChargeTimeTypeId.SpecifiedDueDate,
    code: ChargeTimeTypeCode.SpecifiedDueDate,
    value: ChargeTimeTypeValue.SpecifiedDueDate
  });
}

export function isAnnualFeeChargeTime(input: ChargeTimeTypeInput): boolean {
  return matchesChargeTimeType(input, {
    id: ChargeTimeTypeId.AnnualFee,
    code: ChargeTimeTypeCode.AnnualFee,
    value: ChargeTimeTypeValue.AnnualFee
  });
}

export function isMonthlyFeeChargeTime(input: ChargeTimeTypeInput): boolean {
  return matchesChargeTimeType(input, {
    id: ChargeTimeTypeId.MonthlyFee,
    code: ChargeTimeTypeCode.MonthlyFee,
    value: ChargeTimeTypeValue.MonthlyFee
  });
}

export function isOverdueInstallmentChargeTime(input: ChargeTimeTypeInput): boolean {
  return matchesChargeTimeType(input, {
    id: ChargeTimeTypeId.OverdueInstallment,
    code: ChargeTimeTypeCode.OverdueInstallment,
    value: ChargeTimeTypeValue.OverdueInstallment
  });
}

export function isWeeklyFeeChargeTime(input: ChargeTimeTypeInput): boolean {
  return matchesChargeTimeType(input, {
    id: ChargeTimeTypeId.WeeklyFee,
    code: ChargeTimeTypeCode.WeeklyFee,
    value: ChargeTimeTypeValue.WeeklyFee
  });
}

export function isTrancheDisbursementChargeTime(input: ChargeTimeTypeInput): boolean {
  return matchesChargeTimeType(input, {
    id: ChargeTimeTypeId.TrancheDisbursement,
    code: ChargeTimeTypeCode.TrancheDisbursement,
    value: ChargeTimeTypeValue.TrancheDisbursement
  });
}

export function isPeriodicLoanChargeTime(input: ChargeTimeTypeInput): boolean {
  return matchesChargeTimeType(input, {
    id: ChargeTimeTypeId.LoanPeriodic,
    code: ChargeTimeTypeCode.LoanPeriodic,
    value: ChargeTimeTypeValue.LoanPeriodic
  });
}

const periodicFeeFrequencyCodes = new Set([
  'WEEKS',
  'MONTHS',
  'YEARS'
]);
const periodicFeeFrequencyValues = new Set([
  'Weeks',
  'Months',
  'Years'
]);

export function isPeriodicFeeFrequencyOption(option: FeeFrequencyLike | null | undefined): boolean {
  if (!option) {
    return false;
  }

  return periodicFeeFrequencyCodes.has(option.code ?? '') || periodicFeeFrequencyValues.has(option.value ?? '');
}

export function filterPeriodicFeeFrequencyOptions<T extends FeeFrequencyLike>(options: T[] = []): T[] {
  return options.filter((option) => isPeriodicFeeFrequencyOption(option));
}

function getPeriodicFeeUnit(option: FeeFrequencyLike | null | undefined): string | null {
  if (!option) {
    return null;
  }

  const value = option.value?.toLowerCase();
  if (value && periodicFeeFrequencyValues.has(option.value ?? '')) {
    return value;
  }

  switch (option.code) {
    case 'WEEKS':
      return 'weeks';
    case 'MONTHS':
      return 'months';
    case 'YEARS':
      return 'years';
    default:
      return null;
  }
}

function singularize(unit: string): string {
  return unit.endsWith('s') ? unit.slice(0, -1) : unit;
}

export function formatPeriodicLoanChargeSummary(charge: {
  feeInterval?: number | string | null;
  feeFrequency?: FeeFrequencyLike | null;
}): string {
  const interval = Number(charge.feeInterval);
  const unit = getPeriodicFeeUnit(charge.feeFrequency);

  if (!Number.isFinite(interval) || interval < 1 || !unit) {
    return 'Starts on first repayment date';
  }

  const displayUnit = interval === 1 ? singularize(unit) : unit;
  return `Every ${interval} ${displayUnit}, starts on first repayment date`;
}

export function resolveChargeTimeTypeOption(
  options: OptionData[] | null | undefined,
  selectedChargeTimeType: number | null | undefined
): OptionData | undefined {
  return options?.find((option) => option.id === selectedChargeTimeType);
}
