/** Angular Imports */
import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest } from '@angular/common/http';

/** rxjs Imports */
import { Observable } from 'rxjs';

/** Custom Imports */
import { environment } from '../../../environments/environment';
import { SettingsService } from 'app/settings/settings.service';
import { tokenService } from './authentication.service';

/** Http request (default) options headers. */
const httpOptions: { headers: { [key: string]: string } } = {
  headers: {
    'Fineract-Platform-TenantId': environment.fineractPlatformTenantId
  }
};

/** Authorization header. */
const authorizationHeader = 'Authorization';
const authorizationTenantHeader = 'Fineract-Platform-TenantId';
/** Two factor access token header. */
const twoFactorAccessTokenHeader = 'Fineract-Platform-TFA-Token';

/**
 * Http Request interceptor to set the request headers.
 */
@Injectable()
export class AuthenticationInterceptor implements HttpInterceptor {
  constructor(private settingsService: SettingsService) {}

  /**
   * Intercepts a Http request and sets the request headers.
   */
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let headers: { [key: string]: string } = { ...httpOptions.headers };

    // Set tenant identifier
    if (this.settingsService.tenantIdentifier) {
      headers['Fineract-Platform-TenantId'] = this.settingsService.tenantIdentifier;
    }

    // Set authorization header if token is available
    const authHeader = tokenService.getAuthorizationHeader();
    if (authHeader) {
      headers[authorizationHeader] = authHeader;
    }

    request = request.clone({ setHeaders: headers });
    return next.handle(request);
  }

  /**
   * Sets the basic/oauth authorization header depending on the configuration.
   * @param {string} authenticationKey Authentication key.
   * @deprecated Use tokenService.setToken() instead
   */
  setAuthorizationToken(authenticationKey: string) {
    if (environment.oauth.enabled) {
      tokenService.setToken(authenticationKey, 'Bearer');
    } else {
      tokenService.setToken(authenticationKey, 'Basic');
    }
  }

  /**
   * Sets the two factor access token header.
   * @param {string} twoFactorAccessToken Two factor access token.
   */
  setTwoFactorAccessToken(twoFactorAccessToken: string) {
    httpOptions.headers[twoFactorAccessTokenHeader] = twoFactorAccessToken;
  }

  /**
   * Removes the authorization header.
   * @deprecated Use tokenService.clearToken() instead
   */
  removeAuthorization() {
    tokenService.clearToken();
  }

  /**
   * Removes the authorization header.
   * @deprecated Use tokenService.clearToken() instead
   */
  removeAuthorizationTenant() {
    tokenService.clearToken();
    delete httpOptions.headers[authorizationTenantHeader];
  }

  /**
   * Removes the two factor access token header.
   */
  removeTwoFactorAuthorization() {
    delete httpOptions.headers[twoFactorAccessTokenHeader];
  }
}
