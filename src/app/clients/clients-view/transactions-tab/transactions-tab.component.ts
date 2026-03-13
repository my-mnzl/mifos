import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import {
  MatTableDataSource,
  MatTable,
  MatColumnDef,
  MatHeaderCellDef,
  MatHeaderCell,
  MatCellDef,
  MatCell,
  MatHeaderRowDef,
  MatHeaderRow,
  MatRowDef,
  MatRow
} from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { NgClass } from '@angular/common';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatIconButton } from '@angular/material/button';
import { ExternalIdentifierComponent } from '../../../shared/external-identifier/external-identifier.component';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { MatIcon } from '@angular/material/icon';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { DateFormatPipe } from '../../../pipes/date-format.pipe';
import { FormatNumberPipe } from '../../../pipes/format-number.pipe';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';
import { ClientsService } from 'app/clients/clients.service';
import { LoansService } from 'app/loans/loans.service';
import { LoanTransaction } from 'app/products/loan-products/models/loan-account.model';
import { LoanTransactionType } from 'app/loans/models/loan-transaction-type.model';

@Component({
  selector: 'mifosx-client-transactions-tab',
  templateUrl: './transactions-tab.component.html',
  styleUrls: ['./transactions-tab.component.scss'],
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    MatCheckbox,
    MatTable,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    NgClass,
    ExternalIdentifierComponent,
    MatIconButton,
    MatMenuTrigger,
    MatIcon,
    MatMenu,
    MatMenuItem,
    FaIconComponent,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    MatPaginator,
    DateFormatPipe,
    FormatNumberPipe
  ]
})
export class ClientTransactionsTabComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private clientsService = inject(ClientsService);
  private loansService = inject(LoansService);

  transactionsData: LoanTransaction[] = [];
  hideAccrualsParam = new UntypedFormControl(false);
  hideReversedParam = new UntypedFormControl(false);
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
  dataSource = new MatTableDataSource<LoanTransaction>([]);
  accountWithTransactions = false;
  clientId = Number(this.route.parent?.snapshot.params['clientId']);

  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  ngOnInit() {
    this.loadTransactions();
  }

  loadTransactions(): void {
    this.clientsService.getClientAccountData(this.clientId.toString()).subscribe((accounts: any) => {
      const loanAccounts = accounts.loanAccounts || [];

      if (loanAccounts.length === 0) {
        this.setTransactions([]);
        return;
      }

      const transactionRequests = loanAccounts.map((loan: any) =>
        this.loansService
          .getLoanAccountAssociationDetails(loan.id.toString())
          .pipe(map((loanDetails: any) => loanDetails.transactions ?? []))
      );

      forkJoin(transactionRequests).subscribe((results: LoanTransaction[][]) => {
        const transactions = results
          .reduce(
            (combined: LoanTransaction[], current: LoanTransaction[]) => [
              ...combined,
              ...current
            ],
            []
          )
          .sort((left: LoanTransaction, right: LoanTransaction) => right.id - left.id);

        this.transactionsData = transactions;
        this.setTransactions(transactions);
      });
    });
  }

  setTransactions(transactions: LoanTransaction[] = this.transactionsData): void {
    this.dataSource = new MatTableDataSource(transactions);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.accountWithTransactions = transactions.length > 0;
  }

  hideAccruals(): void {
    this.filterTransactions(!!this.hideReversedParam.value, !this.hideAccrualsParam.value);
  }

  hideReversed(): void {
    this.filterTransactions(!this.hideReversedParam.value, !!this.hideAccrualsParam.value);
  }

  filterTransactions(hideReversed: boolean, hideAccrual: boolean): void {
    if (!hideAccrual && !hideReversed) {
      this.setTransactions(this.transactionsData);
      return;
    }

    const filteredTransactions = this.transactionsData.filter((transaction: LoanTransaction) => {
      return !(hideReversed && transaction.manuallyReversed) && !(hideAccrual && transaction.type.accrual);
    });

    this.setTransactions(filteredTransactions);
  }

  loanTransactionColor(transaction: LoanTransaction): string {
    if (transaction.manuallyReversed) {
      return 'strike';
    }
    if (transaction.type.accrual) {
      return 'accrual';
    }
    if (transaction.type.chargeoff) {
      return 'chargeoff';
    }
    if (transaction.type.downPayment) {
      return 'down-payment';
    }
    if (transaction.type.goodwillCredit) {
      return 'goodwill-credit';
    }
    if (transaction.type.interestPaymentWaiver) {
      return 'interest-payment-waiver';
    }
    if (transaction.type.merchantIssuedRefund) {
      return 'merchant-issued-refund';
    }
    if (transaction.type.payoutRefund) {
      return 'payout-refund';
    }
    if (transaction.type.creditBalanceRefund) {
      return 'credit-balance-refund';
    }
    if (transaction.type.chargeAdjustment) {
      return 'charge-adjustment';
    }
    if (transaction.type.chargeback) {
      return 'chargeback';
    }
    if (transaction.type.chargePayment) {
      return 'charge-payment';
    }
    if (transaction.type.chargeRefund) {
      return 'charge-refund';
    }
    if (transaction.type.chargeWaiver) {
      return 'charge-waiver';
    }
    return '';
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

  getRowClass(row: LoanTransaction): string {
    return this.canShowDetails(row) ? 'select-row' : '';
  }

  showTransactions(transaction: LoanTransaction): void {
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

  displaySubMenu(transaction: LoanTransaction): boolean {
    if (this.isReAgeOrReAmortize(transaction.type) && transaction.manuallyReversed) {
      return false;
    }
    return true;
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
}
