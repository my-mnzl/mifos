/** Angular Imports */
import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';

/** RxJS */
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

/** App Services */
import { HttpService } from '../http/http.service';
import { AlertService } from '../alert/alert.service';

/** Environment */
import { environment } from '../../../environments/environment';

/** Types */
import { OAuth2Token, OAuth2UserProfile, OAuth2Credentials } from './o-auth2-token.model';

// Token management service
class TokenService {
  private currentToken: string | null = null;
  private currentTokenType: 'Bearer' | 'Basic' = 'Bearer';

  setToken(token: string, type: 'Bearer' | 'Basic' = 'Bearer') {
    this.currentToken = token;
    this.currentTokenType = type;
  }

  getToken(): string | null {
    return this.currentToken;
  }

  getTokenType(): 'Bearer' | 'Basic' {
    return this.currentTokenType;
  }

  clearToken() {
    this.currentToken = null;
  }

  getAuthorizationHeader(): string | null {
    if (!this.currentToken) return null;
    const header = `${this.currentTokenType} ${this.currentToken}`;
    return header;
  }
}

// Global token service instance
export const tokenService = new TokenService();

export interface LoginContext {
  username?: string;
  password?: string;
  remember: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private storage: Storage = localStorage;
  private rememberMe = false;
  private userLoggedIn = false;

  private authorizationEndpoint?: string;
  private tokenEndpoint?: string;
  private userinfoEndpoint?: string;
  private endSessionEndpoint?: string;

  constructor(
    private readonly http: HttpService,
    private readonly alertService: AlertService
  ) {}

  getUserLoggedIn(): boolean {
    return this.userLoggedIn;
  }

  login(loginContext: LoginContext): Observable<boolean> {
    this.alertService.alert({ type: 'Authentication Start', message: 'Redirecting to sign in…' });
    this.rememberMe = !!loginContext.remember;
    this.storage = this.rememberMe ? localStorage : sessionStorage;

    if (!environment?.oauth?.enabled) {
      // Legacy fallback - this should be removed in favor of OAuth2
      return this.http
        .post('/authentication', { username: loginContext.username, password: loginContext.password })
        .pipe(
          map((credentials: any) => {
            this.onLoginSuccess(credentials);
            return true;
          })
        );
    }

    const issuer = this.requireIssuer();
    const scope = environment.oauth.scope || 'openid profile email offline_access';
    const clientId = environment.oauth.clientId;
    const redirectUri = environment.oauth.redirectUri;

    if (!clientId || !redirectUri) {
      return throwError(() => new Error('OAuth configuration missing client_id or redirectUri.'));
    }

    return this.discover(issuer).pipe(
      switchMap(() => this.startPkceLogin(issuer, clientId, redirectUri, scope)),
      map(() => true)
    );
  }

  handleRedirectCallback(): Observable<boolean> {
    if (!environment?.oauth?.enabled) {
      return of(false);
    }

    // If user is already authenticated, return true
    if (this.isAuthenticated()) {
      return of(true);
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code) {
      return throwError(() => new Error('No authorization code found on callback URL.'));
    }

    const expectedState = this.storage.getItem('oauth_state');
    if (!state || state !== expectedState) {
      return throwError(() => new Error('OAuth state mismatch.'));
    }

    const clientId = environment.oauth.clientId;
    const redirectUri = environment.oauth.redirectUri;
    const codeVerifier = this.storage.getItem('pkce_verifier') || '';
    const tokenEndpoint = this.storage.getItem('token_endpoint') || this.tokenEndpoint;

    if (!tokenEndpoint) {
      return throwError(() => new Error('Token endpoint not available. Did discovery run?'));
    }

    const body = new HttpParams()
      .set('grant_type', 'authorization_code')
      .set('code', code)
      .set('redirect_uri', redirectUri)
      .set('client_id', clientId)
      .set('code_verifier', codeVerifier);

    const headers = new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });

    return this.http
      .disableApiPrefix()
      .post(tokenEndpoint, body.toString(), { headers })
      .pipe(
        switchMap((tokens: OAuth2Token) => {
          this.persistTokens(tokens);
          return this.getUserDetails(tokens).pipe(map(() => true));
        }),
        catchError((err) => {
          this.alertService.alert({ type: 'Authentication Error', message: 'Token exchange failed.' });
          return throwError(() => err);
        }),
        map((ok) => {
          this.clearAuthQueryParams();
          return ok;
        })
      );
  }

  logout(): Observable<void> {
    const idToken = this.storage.getItem('id_token');
    const endSession = this.endSessionEndpoint || this.storage.getItem('end_session_endpoint') || '';
    const postLogoutRedirect = environment.oauth.postLogoutRedirectUri || environment.oauth.redirectUri;

    this.clearTokens();
    tokenService.clearToken();
    this.userLoggedIn = false;

    if (endSession && idToken) {
      const url = new URL(endSession);
      url.searchParams.set('id_token_hint', idToken);
      if (postLogoutRedirect) {
        url.searchParams.set('post_logout_redirect_uri', postLogoutRedirect);
      }
      window.location.assign(url.toString());
    }

    return of(void 0);
  }

  /**
   * Check if the current access token is expired
   */
  isTokenExpired(): boolean {
    const expiresAt = this.storage.getItem('expires_at');
    if (!expiresAt) return true;

    const expirationTime = parseInt(expiresAt, 10);
    const currentTime = Date.now();

    // Consider token expired if it expires within the next 30 seconds
    return currentTime >= expirationTime - 30000;
  }

  /**
   * Get the current access token
   */
  getAccessToken(): string | null {
    return this.storage.getItem('access_token');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    return !!token && !this.isTokenExpired() && this.userLoggedIn;
  }

  /**
   * Check if the current URL is an OAuth callback URL
   */
  isOAuthCallback(): boolean {
    return window.location.pathname?.includes('/auth/callback');
  }

  /**
   * Check if the current URL has OAuth callback parameters
   */
  hasOAuthCallbackParams(): boolean {
    const params = new URLSearchParams(window.location.search);
    return !!params.get('code') && !!params.get('state');
  }

  /**
   * Initialize OAuth authentication if callback parameters are present
   */
  initializeOAuthIfNeeded(): Observable<boolean> {
    if (this.hasOAuthCallbackParams()) {
      return this.handleRedirectCallback();
    }
    return of(false);
  }

  /**
   * Check and refresh tokens if needed
   */
  checkAndRefreshTokens(): Observable<boolean> {
    if (!this.isTokenExpired()) {
      return of(true);
    }

    const refreshToken = this.storage.getItem('refresh_token');
    if (!refreshToken) {
      // No refresh token available, user needs to re-authenticate
      this.clearTokens();
      this.userLoggedIn = false;
      return of(false);
    }

    // Try to refresh the tokens
    return this.refreshTokens().pipe(
      map(() => true),
      catchError((err) => {
        // Refresh failed, clear tokens and user needs to re-authenticate
        this.clearTokens();
        this.userLoggedIn = false;
        return of(false);
      })
    );
  }

  /**
   * Clear OAuth state and redirect to login
   */
  clearOAuthState(): void {
    this.clearTokens();
    this.userLoggedIn = false;
    // Clear any OAuth-related query parameters
    this.clearAuthQueryParams();
  }

  /**
   * Get user credentials (for backward compatibility)
   */
  getCredentials(): any {
    if (environment.oauth.enabled) {
      // For OAuth, return OAuth credentials
      const accessToken = this.getAccessToken();
      const idToken = this.storage.getItem('id_token');
      const refreshToken = this.storage.getItem('refresh_token');
      const userInfoString = this.storage.getItem('user_info');
      const userInfo = userInfoString ? JSON.parse(userInfoString) : {};
      const { user, groups, permissions } = userInfo;

      if (accessToken) {
        return {
          accessToken,
          idToken,
          refreshToken,
          user,
          groups,
          permissions
        };
      }
    }

    return null;
  }

  /**
   * Reset password (for backward compatibility)
   */
  resetPassword(resetPasswordData: any): Observable<any> {
    // This method is not applicable for OAuth
    // Return error or redirect to appropriate flow
    return throwError(() => new Error('Password reset not available with OAuth authentication.'));
  }

  /**
   * Get delivery methods for 2FA (for backward compatibility)
   */
  getDeliveryMethods(): Observable<any> {
    // This method is not applicable for OAuth
    return throwError(() => new Error('Two-factor authentication not available with OAuth authentication.'));
  }

  /**
   * Request OTP for 2FA (for backward compatibility)
   */
  requestOTP(deliveryMethod: any): Observable<any> {
    // This method is not applicable for OAuth
    return throwError(() => new Error('Two-factor authentication not available with OAuth authentication.'));
  }

  /**
   * Validate OTP for 2FA (for backward compatibility)
   */
  validateOTP(otp: string): Observable<any> {
    // This method is not applicable for OAuth
    return throwError(() => new Error('Two-factor authentication not available with OAuth authentication.'));
  }

  /**
   * Change password (for backward compatibility)
   */
  changePassword(userId: string, changePasswordData: any): Observable<any> {
    // This method is not applicable for OAuth
    return throwError(() => new Error('Password change not available with OAuth authentication.'));
  }

  /**
   * Check if dialog has been shown (for backward compatibility)
   */
  hasDialogBeenShown(): boolean {
    // This method is not applicable for OAuth
    return false;
  }

  /**
   * Show dialog (for backward compatibility)
   */
  showDialog(): void {
    // This method is not applicable for OAuth
    // No-op for OAuth authentication
  }

  private discover(issuer: string): Observable<void> {
    const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
    return this.http
      .disableApiPrefix()
      .get(discoveryUrl)
      .pipe(
        map((doc: any) => {
          this.authorizationEndpoint = doc.authorization_endpoint;
          this.tokenEndpoint = doc.token_endpoint;
          this.userinfoEndpoint = doc.userinfo_endpoint;
          this.endSessionEndpoint = doc.end_session_endpoint;

          // Store endpoints in storage for later use
          if (this.tokenEndpoint) {
            this.storage.setItem('token_endpoint', this.tokenEndpoint);
          }
          if (this.userinfoEndpoint) {
            this.storage.setItem('userinfo_endpoint', this.userinfoEndpoint);
          }
          if (this.endSessionEndpoint) {
            this.storage.setItem('end_session_endpoint', this.endSessionEndpoint);
          }
        }),
        catchError((err) => {
          this.alertService.alert({
            type: 'Discovery Error',
            message: 'Failed to discover OAuth2 endpoints. Please check your issuer URL.'
          });
          return throwError(() => err);
        })
      );
  }

  private startPkceLogin(issuer: string, clientId: string, redirectUri: string, scope: string): Observable<void> {
    const authorize = this.authorizationEndpoint;
    if (!authorize) {
      return throwError(() => new Error('Authorization endpoint not available. Did discovery run?'));
    }

    const state = crypto.randomUUID();
    this.storage.setItem('oauth_state', state);

    return this.createCodeChallenge().pipe(
      map(({ codeVerifier, codeChallenge }) => {
        this.storage.setItem('pkce_verifier', codeVerifier);

        const url = new URL(authorize);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('client_id', clientId);
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('scope', scope);
        url.searchParams.set('state', state);
        url.searchParams.set('code_challenge_method', 'S256');
        url.searchParams.set('code_challenge', codeChallenge);

        window.location.assign(url.toString());
      })
    );
  }

  private createCodeChallenge(): Observable<{ codeVerifier: string; codeChallenge: string }> {
    const verifierBytes = new Uint8Array(32);
    crypto.getRandomValues(verifierBytes);
    const codeVerifier = this.base64url(verifierBytes);

    return new Observable((observer) => {
      crypto.subtle
        .digest('SHA-256', new TextEncoder().encode(codeVerifier))
        .then((digest) => {
          const codeChallenge = this.base64url(new Uint8Array(digest));
          observer.next({ codeVerifier, codeChallenge });
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  }

  private base64url(bytes: Uint8Array): string {
    let s = '';
    for (let i = 0; i < bytes.length; i++) {
      s += String.fromCharCode(bytes[i]);
    }
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  private persistTokens(tokens: OAuth2Token): void {
    if (tokens.access_token) {
      this.storage.setItem('access_token', tokens.access_token);
    }
    if (tokens.id_token) {
      this.storage.setItem('id_token', tokens.id_token);
    }
    if (tokens.refresh_token) {
      this.storage.setItem('refresh_token', tokens.refresh_token);
    }
    if (tokens.expires_in) {
      const expiresAt = (Date.now() + tokens.expires_in * 1000).toString();
      this.storage.setItem('expires_at', expiresAt);
    }
  }

  private clearTokens(): void {
    this.storage.removeItem('access_token');
    this.storage.removeItem('id_token');
    this.storage.removeItem('refresh_token');
    this.storage.removeItem('expires_at');
    this.storage.removeItem('pkce_verifier');
    this.storage.removeItem('oauth_state');
    this.storage.removeItem('token_endpoint');
    this.storage.removeItem('userinfo_endpoint');
    this.storage.removeItem('end_session_endpoint');
  }

  private clearAuthQueryParams(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    window.history.replaceState({}, document.title, url.toString());
  }

  private requireIssuer(): string {
    const issuer = environment.oauth.issuerUrl;
    if (!issuer) {
      throw new Error('Missing environment.oauth.issuer (should be the provider URL with slug).');
    }
    return issuer.replace(/\/+$/, '');
  }

  private getUserDetails(tokens: OAuth2Token): Observable<any> {
    const userinfo = this.storage.getItem('userinfo_endpoint') || this.userinfoEndpoint;
    if (!userinfo || !tokens?.access_token) {
      this.onLoginSuccess({ accessToken: tokens.access_token });
      return of(null);
    }

    const headers = new HttpHeaders({ Authorization: `Bearer ${tokens.access_token}` });
    return this.http
      .disableApiPrefix()
      .get(userinfo, { headers })
      .pipe(
        map((profile: OAuth2UserProfile) => {
          const credentials: OAuth2Credentials = {
            accessToken: tokens.access_token,
            idToken: tokens.id_token,
            refreshToken: tokens.refresh_token,
            user: {
              sub: profile.sub,
              username: profile.preferred_username || profile.sub,
              name: profile.name || profile.preferred_username || profile.sub,
              email: profile.email
            },
            groups: profile.groups,
            permissions: profile.permissions,
            remember: this.rememberMe
          };
          this.onLoginSuccess(credentials);
          return credentials;
        }),
        catchError((err) => {
          // If userinfo fails, still proceed with login using available token data
          this.alertService.alert({
            type: 'Warning',
            message: 'Could not fetch user profile, proceeding with available information.'
          });
          const credentials: OAuth2Credentials = {
            accessToken: tokens.access_token,
            idToken: tokens.id_token,
            refreshToken: tokens.refresh_token,
            user: {
              sub: 'unknown',
              username: 'unknown',
              name: 'Unknown User',
              email: undefined
            },
            groups: [],
            permissions: [],
            remember: this.rememberMe
          };
          this.onLoginSuccess(credentials);
          return of(credentials);
        })
      );
  }

  private onLoginSuccess(credentials: any): void {
    this.userLoggedIn = true;

    // Store the authentication token
    if (credentials.accessToken) {
      if (environment.oauth.enabled) {
        tokenService.setToken(credentials.accessToken, 'Bearer');
      } else {
        // For legacy Basic auth, the token should be base64 encoded username:password
        tokenService.setToken(credentials.base64EncodedAuthenticationKey || credentials.accessToken, 'Basic');
      }
    }

    this.storage.setItem('user_info', JSON.stringify(credentials));

    this.alertService.alert({ type: 'Authentication Success', message: 'Signed in successfully.' });
  }

  /**
   * Exchanges a refresh_token for new tokens
   */
  refreshTokens(): Observable<OAuth2Token> {
    const tokenEndpoint = this.storage.getItem('token_endpoint') || this.tokenEndpoint;
    const refresh = this.storage.getItem('refresh_token');
    const clientId = environment.oauth.clientId;

    if (!tokenEndpoint || !refresh || !clientId) {
      return throwError(() => new Error('Refresh not possible: missing endpoint, token, or client_id.'));
    }

    const body = new HttpParams()
      .set('grant_type', 'refresh_token')
      .set('refresh_token', refresh)
      .set('client_id', clientId);

    const headers = new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });

    return this.http
      .disableApiPrefix()
      .post(tokenEndpoint, body.toString(), { headers })
      .pipe(
        map((tokens: OAuth2Token) => {
          this.persistTokens(tokens);
          return tokens;
        }),
        catchError((err) => {
          // If refresh fails, clear tokens and redirect to login
          this.clearTokens();
          this.userLoggedIn = false;
          this.alertService.alert({
            type: 'Authentication Error',
            message: 'Session expired. Please log in again.'
          });
          return throwError(() => err);
        })
      );
  }
}
