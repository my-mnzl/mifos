import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntypedFormControl } from '@angular/forms';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Dates } from 'app/core/utils/dates';
import { ClientsService } from 'app/clients/clients.service';
import { LoansService } from 'app/loans/loans.service';
import { MatDialog } from '@angular/material/dialog';
import { SettingsService } from 'app/settings/settings.service';
import { TranslateService } from '@ngx-translate/core';
import { LoanTransaction } from 'app/products/loan-products/models/loan-account.model';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoanTransactionType } from 'app/loans/models/loan-transaction-type.model';

@Component({
  selector: 'mifosx-client-transactions-tab',
  templateUrl: './transactions-tab.component.html',
  styleUrls: ['./transactions-tab.component.scss']
})
export class ClientTransactionsTabComponent implements OnInit {
  /** Loan Details Data */
  transactionsData: LoanTransaction[] = [];
  /** Form control to handle accural parameter */
  hideAccrualsParam: UntypedFormControl;
  hideReversedParam: UntypedFormControl;
  /** Columns to be displayed in original schedule table. */
  displayedColumns: string[] = [
    'row',
    'id',
    'loanId',
    'office',
    'externalId',
    'date',
    'transactionType',
    'amount',
    'principal',
    'interest',
    'fee',
    'penalties',
    'loanBalance',
    'actions'
  ];
  displayedHeader1Columns: string[] = [
    'h1-row',
    'h1-id',
    'h1-loan-id',
    'h1-office',
    'h1-external-id',
    'h1-transaction-date',
    'h1-transaction-type',
    'h1-space',
    'h1-breakdown',
    'h1-loan-balance',
    'h1-actions'
  ];
  displayedHeader2Columns: string[] = [
    'h2-space',
    'h2-amount',
    'h2-principal',
    'h2-interest',
    'h2-fees',
    'h2-penalties',
    'h2-action'
  ];

  dataSource: MatTableDataSource<any>;
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  clientId: number;

  constructor(
    private route: ActivatedRoute,
    private dateUtils: Dates,
    private router: Router,
    private dialog: MatDialog,
    private clientsService: ClientsService,
    private loansService: LoansService,
    private translateService: TranslateService,
    private settingsService: SettingsService
  ) {
    this.clientId = this.route.parent.snapshot.params['clientId'];
  }

  ngOnInit() {
    this.hideAccrualsParam = new UntypedFormControl(false);
    this.hideReversedParam = new UntypedFormControl(false);
    this.loadTransactions();
  }

  loadTransactions() {
    this.clientsService.getClientAccountData(this.clientId.toString()).subscribe((accounts: any) => {
      const loanAccounts = accounts.loanAccounts || [];

      if (loanAccounts.length === 0) {
        this.setTransactions();
        return;
      }

      const transactionRequests = loanAccounts.map((loan: any) => {
        return this.loansService
          .getLoanAccountAssociationDetails(loan.id.toString())
          .pipe(map((loanDetails: any) => loanDetails.transactions ?? []));
      });

      forkJoin(transactionRequests).subscribe((results: any[]) => {
        this.transactionsData = results
          .reduce(
            (acc: any[], curr: any[]) => [
              ...acc,
              ...curr
            ],
            []
          )
          .sort((a: any, b: any) => b.id - a.id);
        this.setTransactions();
      });
    });
  }

  setTransactions() {
    this.dataSource = new MatTableDataSource(this.transactionsData);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  hideAccruals() {
    this.filterTransactions(this.hideReversedParam.value, !this.hideAccrualsParam.value);
  }

  hideReversed() {
    this.filterTransactions(!this.hideReversedParam.value, this.hideAccrualsParam.value);
  }

  filterTransactions(hideReversed: boolean, hideAccrual: boolean): void {
    let transactions: LoanTransaction[] = this.transactionsData;

    if (hideAccrual || hideReversed) {
      transactions = this.transactionsData.filter((t: LoanTransaction) => {
        return !(hideReversed && t.manuallyReversed) && !(hideAccrual && t.type.accrual);
      });
    }
    this.dataSource = new MatTableDataSource(transactions);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loanTransactionColor(transaction: any): string {
    if (transaction.manuallyReversed) {
      return 'strike';
    }
    if (this.isAccrual(transaction)) {
      return 'accrual';
    }
    if (this.isChargeOff(transaction)) {
      return 'charge-off';
    }
    if (this.isDownPayment(transaction)) {
      return 'down-payment';
    }
    if (this.isGoodwillCredit(transaction)) {
      return 'goodwill-credit';
    }
    if (this.isInterestPaymentWaiver(transaction)) {
      return 'interest-payment-waiver';
    }
    if (this.isMerchantIssuedRefund(transaction)) {
      return 'merchant-issued-refund';
    }
    if (this.isPayoutRefund(transaction)) {
      return 'payout-refund';
    }
    if (this.isCreditBalanceRefund(transaction)) {
      return 'credit-balance-refund';
    }
    if (this.isChargeAdjustment(transaction)) {
      return 'charge-adjustment';
    }
    if (this.isChargeback(transaction)) {
      return 'chargeback';
    }
    if (this.isChargePayment(transaction)) {
      return 'charge-payment';
    }
    if (this.isChargeRefund(transaction)) {
      return 'charge-refund';
    }
    if (this.isChargeWaiver(transaction)) {
      return 'charge-waiver';
    }
    return '';
  }

  private isAccrual(transaction: any): boolean {
    return transaction.type.accrual;
  }

  private isChargeOff(transaction: any): boolean {
    return transaction.type.chargeoff;
  }

  private isDownPayment(transaction: any): boolean {
    return transaction.type.downPayment;
  }

  private isGoodwillCredit(transaction: any): boolean {
    return transaction.type.goodwillCredit;
  }

  private isInterestPaymentWaiver(transaction: any): boolean {
    return transaction.type.interestPaymentWaiver;
  }

  private isMerchantIssuedRefund(transaction: any): boolean {
    return transaction.type.merchantIssuedRefund;
  }

  private isPayoutRefund(transaction: any): boolean {
    return transaction.type.payoutRefund;
  }

  private isCreditBalanceRefund(transaction: any): boolean {
    return transaction.type.creditBalanceRefund;
  }

  private isChargeAdjustment(transaction: any): boolean {
    return transaction.type.chargeAdjustment;
  }

  private isChargeback(transaction: any): boolean {
    return transaction.type.chargeback;
  }

  private isChargePayment(transaction: any): boolean {
    return transaction.type.chargePayment;
  }

  private isChargeRefund(transaction: any): boolean {
    return transaction.type.chargeRefund;
  }

  private isChargeWaiver(transaction: any): boolean {
    return transaction.type.chargeWaiver;
  }

  canShowDetails(transaction: LoanTransaction): boolean {
    return [
      1,
      2,
      4,
      9,
      20,
      21,
      22,
      23,
      26,
      28,
      29,
      30,
      31,
      33
    ].includes(transaction.type.id);
  }

  getRowClass(row: any) {
    return this.canShowDetails(row) ? 'select-row' : '';
  }

  showTransactions(transaction: LoanTransaction) {
    if (this.canShowDetails(transaction)) {
      this.router.navigate([
        '/clients',
        this.clientId,
        'loans-accounts',
        transaction.loanId,
        'transactions',
        transaction.id
      ]);
    }
  }

  private isReAge(transactionType: LoanTransactionType): boolean {
    return transactionType.reAge || transactionType.code === 'loanTransactionType.reAge';
  }

  private isReAmortize(transactionType: LoanTransactionType): boolean {
    return transactionType.reAmortize || transactionType.code === 'loanTransactionType.reAmortize';
  }

  private isReAgeOrReAmortize(transactionType: LoanTransactionType): boolean {
    return this.isReAmortize(transactionType) || this.isReAge(transactionType);
  }

  displaySubMenu(transaction: LoanTransaction): boolean {
    if (this.isReAgeOrReAmortize(transaction.type) && transaction.manuallyReversed) {
      return false;
    }
    return true;
  }
}
