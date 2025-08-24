/**
 * OAuth2 token model for Authorization Code flow with PKCE.
 */
export interface OAuth2Token {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

/**
 * OAuth2 configuration interface.
 */
export interface OAuth2Config {
  enabled: boolean;
  serverUrl: string;
  appId: string;
  issuer: string;
  redirectUri: string;
  scope: string;
  postLogoutRedirectUri: string;
}

/**
 * User profile information from OAuth2 provider.
 */
export interface OAuth2UserProfile {
  sub: string;
  username?: string;
  preferred_username?: string;
  name?: string;
  email?: string;
  groups?: string[];
  permissions?: string[];
}

/**
 * Credentials returned after successful OAuth2 authentication.
 */
export interface OAuth2Credentials {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  user: OAuth2UserProfile;
  groups: string[];
  permissions: string[];
  remember: boolean;
}
