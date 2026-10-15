export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface AuthResponse {
  registrationRequired?: false;
  token: string;
  tokenType: string;
  user: User;
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
