import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface InvestmentPosition {
  businessDate: string;
  boundarySide: string;
  eventWatermark: string;
  contractualOutstandingMinor: string;
  grossPurchaseBasisMinor: string;
  deferredDiscountMinor: string;
  deferredIntegralFeeMinor: string;
  amortizedCostMinor: string;
  lossAllowanceMinor: string;
  netCarryingMinor: string;
  grossYield: string;
  netEir: string;
  riskAssessmentStatus: 'PENDING' | 'ASSESSED';
  stage: string | null;
}

export interface InvestmentProjection {
  fromDate: string;
  unavailableReason?: 'OVERDUE_CASHFLOWS' | 'ACCOUNT_NOT_ACTIVE' | null;
  rows: {
    date: string;
    openingCarryingMinor: string;
    cashReceiptMinor: string;
    investmentRecoveryMinor: string;
    eirIncomeMinor: string;
    closingCarryingMinor: string;
  }[];
}

export interface NativeInvestment {
  applicable: true;
  externalReceivableId: string;
  currency: { code: string; decimalPlaces: number };
  position: InvestmentPosition;
  projection?: InvestmentProjection;
}

export type InvestmentResponse = { applicable: false } | NativeInvestment;

@Injectable({ providedIn: 'root' })
export class InvestmentService {
  private http = inject(HttpClient);

  read(loanId: number, includeProjections = false) {
    return this.http.get<InvestmentResponse>(`/loans/${loanId}/mnzl-investment`, {
      params: { includeProjections }
    });
  }
}
