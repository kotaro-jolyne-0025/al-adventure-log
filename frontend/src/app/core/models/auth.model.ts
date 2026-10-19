export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface AuthResponse {
  registrationRequired?: false;
  user: User;
  session: AuthSession;
}

export interface AuthSession {
  id: string;
  issuedAt: string;
  expiresAt: string;
}

export interface AuthStateResponse {
  user: User;
  session: AuthSession;
}

export interface OAuthRegistrationRequired {
  registrationRequired: true;
  registrationToken: string;
}

export type OAuthLoginResponse = AuthResponse | OAuthRegistrationRequired;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  displayName: string;
}

export interface OAuthLoginRequest {
  provider: 'GOOGLE' | 'DISCORD';
  tokenOrCode: string;
  redirectUri?: string;
}
