/** Angular Imports */
import { Component, OnInit, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { SettingsService } from 'app/settings/settings.service';

/**
 * Floating Rate Period Dialog Component.
 */
@Component({
  selector: 'mifosx-floating-rate-period-dialog',
  templateUrl: './floating-rate-period-dialog.component.html',
  styleUrls: ['./floating-rate-period-dialog.component.scss']
})
export class FloatingRatePeriodDialogComponent implements OnInit {
  /** Floating Rate Period Form. */
  floatingRatePeriodForm: UntypedFormGroup;
  /** Minimum floating rate period date allowed. */
  minDate = new Date();

  /**
   * @param {MatDialogRef} dialogRef Component reference to dialog.
   * @param {FormBuilder} formBuilder Form Builder.
   * @param {any} data Provides values for the form (if available).
   */
  constructor(
    public dialogRef: MatDialogRef<FloatingRatePeriodDialogComponent>,
    public formBuilder: UntypedFormBuilder,
    private settingsService: SettingsService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  /**
   * Creates the floating rate period form.
   */
  ngOnInit() {
    this.minDate = this.settingsService.businessDate;
    let rowDisabled = false;

    // Check if this is an existing period with a past date
    if (this.data && this.data.fromDate) {
      const existingDate = new Date(this.data.fromDate);
      if (existingDate < this.minDate) {
        rowDisabled = true;
      }
    }

    this.floatingRatePeriodForm = this.formBuilder.group({
      fromDate: [
        { value: this.data ? new Date(this.data.fromDate) : '', disabled: rowDisabled },
        Validators.required
      ],
      interestRate: [
        { value: this.data ? this.data.interestRate : '', disabled: rowDisabled },
        Validators.required
      ],
      isDifferentialToBaseLendingRate: [
        { value: this.data ? this.data.isDifferentialToBaseLendingRate : false, disabled: rowDisabled }]
    });
  }

  /**
   * Closes the dialog and returns value of the form.
   */
  submit() {
    const formValue = this.floatingRatePeriodForm.value;

    // Validate that the selected date is not in the past
    if (formValue.fromDate && formValue.fromDate < this.minDate) {
      // This should not happen due to the minDate constraint, but adding as a safety check
      console.warn('Attempted to submit a past date for floating rate period');
      return;
    }

    this.dialogRef.close(formValue);
  }
}
