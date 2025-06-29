export interface User {
  id: string;
  email: string;
  name: string;
  tier: 'free' | 'premium' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
  emailVerified: boolean;
  apiKey?: string;
  webhookUrl?: string;
  emailAlerts: boolean;
  alertFrequency: 'instant' | 'daily' | 'weekly';
  customWatchlists: string[];
  usage: {
    apiCalls: number;
    analysisCount: number;
    lastReset: Date;
  };
}

export interface Session {
  userId: string;
  expiresAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}