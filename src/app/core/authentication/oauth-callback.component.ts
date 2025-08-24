/** Angular Imports */
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

/** Angular Material Imports */
import { MatProgressSpinner } from '@angular/material/progress-spinner';

/** Custom Services */
import { AuthenticationService } from './authentication.service';
import { AlertService } from '../alert/alert.service';
import { Logger } from '../logger/logger.service';

const log = new Logger('OAuthCallbackComponent');

/**
 * OAuth2 Callback Component
 *
 * Handles the OAuth2 authorization code callback from the identity provider.
 * This component processes the authorization code and exchanges it for tokens.
 */
@Component({
  selector: 'mifosx-oauth-callback',
  template: `
    <div class="oauth-callback-container">
      <div class="spinner-container">
        <mat-spinner diameter="50"></mat-spinner>
        <p>Processing authentication...</p>
      </div>
    </div>
  `,
  styles: [
    `
      .oauth-callback-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background-color: #f5f5f5;
      }

      .spinner-container {
        text-align: center;
      }

      .spinner-container p {
        margin-top: 20px;
        color: #666;
        font-size: 16px;
      }
    `

  ],
  imports: [MatProgressSpinner],
  standalone: true
})
export class OAuthCallbackComponent implements OnInit {
  constructor(
    private authenticationService: AuthenticationService,
    private router: Router,
    private location: Location,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.handleOAuthCallback();
  }

  private handleOAuthCallback(): void {
    // Check if user is already authenticated
    if (this.authenticationService.isAuthenticated()) {
      // User is already authenticated, redirect to main application
      this.router.navigate(['/home'], { replaceUrl: true });
      return;
    }

    this.authenticationService.handleRedirectCallback().subscribe({
      next: (success: boolean) => {
        if (success) {
          // Redirect to the main application
          this.router.navigate(['/home'], { replaceUrl: true });
        }
      },
      error: (error: any) => {
        log.error('OAuth callback error:', error);
        this.alertService.alert({
          type: 'Authentication Error',
          message: 'Authentication failed. Please try again.'
        });

        // Clear OAuth state and redirect back to login
        this.authenticationService.clearOAuthState();
        this.router.navigate(['/login'], { replaceUrl: true });
      }
    });
  }
}
