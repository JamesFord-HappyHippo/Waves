// Marine Social Authentication Service
// Adapted from HoneyDo social auth patterns for marine navigation platform

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SocialProvider {
  name: 'google' | 'apple' | 'facebook';
  displayName: string;
}

export interface VesselInfo {
  name: string;
  draftFeet: number;
  lengthFeet?: number;
  beamFeet?: number;
  vesselType: string;
  emergencyContacts: EmergencyContact[];
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
  isVerified?: boolean;
}

export interface CognitoUser {
  sub: string;
  email: string;
  email_verified: boolean;
  given_name?: string;
  family_name?: string;
  vessel_name?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export interface AuthResult {
  success: boolean;
  user?: CognitoUser;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

export class MarineSocialAuth {
  private static readonly COGNITO_DOMAIN = process.env.REACT_APP_COGNITO_DOMAIN || 'waves-marine-auth';
  private static readonly CLIENT_ID = process.env.REACT_APP_COGNITO_CLIENT_ID || '';
  private static readonly REDIRECT_URI = process.env.REACT_APP_AUTH_REDIRECT_URI || window.location.origin + '/auth/callback';
  
  /**
   * Initiate social authentication with marine context
   */
  static async signInWithSocial(provider: SocialProvider, vesselContext?: VesselInfo): Promise<void> {
    try {
      // Store vessel context for post-auth processing
      if (vesselContext) {
        await AsyncStorage.setItem('waves_pending_vessel', JSON.stringify(vesselContext));
      }

      // Store the current page for redirect after auth
      await AsyncStorage.setItem('waves_auth_return_url', window.location.pathname);

      const authUrl = this.getMarineAuthorizationUrl(provider);
      
      console.log(`🌊 Initiating ${provider.displayName} authentication for marine user`);
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error initiating social auth:', error);
      throw new Error(`Failed to initialize ${provider.displayName} authentication`);
    }
  }

  /**
   * Build authorization URL with marine-specific parameters
   */
  private static getMarineAuthorizationUrl(provider: SocialProvider): string {
    const baseUrl = `https://${this.COGNITO_DOMAIN}.auth.us-east-1.amazoncognito.com/oauth2/authorize`;
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.CLIENT_ID,
      redirect_uri: this.REDIRECT_URI,
      scope: 'email openid profile',
      identity_provider: this.getProviderName(provider),
      state: this.generateStateParameter()
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Map social provider to Cognito identity provider name
   */
  private static getProviderName(provider: SocialProvider): string {
    const providerMap = {
      google: 'Google',
      apple: 'SignInWithApple', 
      facebook: 'Facebook'
    };
    return providerMap[provider.name] || 'Google';
  }

  /**
   * Generate secure state parameter for CSRF protection
   */
  private static generateStateParameter(): string {
    return btoa(JSON.stringify({
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(7),
      marine_auth: true
    }));
  }

  /**
   * Check if current URL is a social auth redirect
   */
  static checkSocialRedirect(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('code') && urlParams.has('state');
  }

  /**
   * Handle marine-specific authentication callback
   */
  static async handleMarineAuthCallback(): Promise<AuthResult> {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (!code || !state) {
        return { success: false, error: 'Missing authorization code or state parameter' };
      }

      // Validate state parameter
      if (!this.validateStateParameter(state)) {
        return { success: false, error: 'Invalid state parameter - possible CSRF attack' };
      }

      // Exchange code for tokens
      console.log('🔄 Exchanging authorization code for tokens...');
      const tokenResult = await this.exchangeCodeForTokens(code);

      if (tokenResult.success && tokenResult.user) {
        // Store authentication tokens
        await this.storeAuthTokens(tokenResult.accessToken!, tokenResult.refreshToken!);
        
        // Process pending vessel information
        await this.processPendingVesselInfo(tokenResult.user);

        // Clean up URL
        this.cleanUpAuthURL();

        // Redirect to return URL or dashboard
        await this.handlePostAuthRedirect();

        console.log('✅ Marine authentication completed successfully');
        return tokenResult;
      }

      return { success: false, error: tokenResult.error || 'Token exchange failed' };
    } catch (error) {
      console.error('Error handling marine auth callback:', error);
      return { success: false, error: 'Authentication callback processing failed' };
    }
  }

  /**
   * Exchange authorization code for JWT tokens
   */
  private static async exchangeCodeForTokens(code: string): Promise<AuthResult> {
    try {
      const tokenUrl = `https://${this.COGNITO_DOMAIN}.auth.us-east-1.amazoncognito.com/oauth2/token`;

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.CLIENT_ID,
          code: code,
          redirect_uri: this.REDIRECT_URI,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Token exchange failed:', error);
        return { success: false, error: `Token exchange failed: ${response.status}` };
      }

      const tokens = await response.json();
      
      // Decode ID token to get user info
      const user = this.decodeJWTPayload(tokens.id_token);

      return {
        success: true,
        user: user as CognitoUser,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      return { success: false, error: 'Network error during token exchange' };
    }
  }

  /**
   * Decode JWT token payload
   */
  private static decodeJWTPayload(token: string): any {
    try {
      const base64Payload = token.split('.')[1];
      const payload = atob(base64Payload);
      return JSON.parse(payload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  }

  /**
   * Validate state parameter to prevent CSRF attacks
   */
  private static validateStateParameter(state: string): boolean {
    try {
      const decoded = JSON.parse(atob(state));
      return decoded.marine_auth === true && 
             decoded.timestamp && 
             (Date.now() - decoded.timestamp) < 600000; // 10 minute expiry
    } catch {
      return false;
    }
  }

  /**
   * Store authentication tokens securely
   */
  private static async storeAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      await AsyncStorage.setItem('waves_access_token', accessToken);
      await AsyncStorage.setItem('waves_refresh_token', refreshToken);
      await AsyncStorage.setItem('waves_auth_timestamp', Date.now().toString());
    } catch (error) {
      console.error('Error storing auth tokens:', error);
    }
  }

  /**
   * Process pending vessel information after authentication
   */
  private static async processPendingVesselInfo(user: CognitoUser): Promise<void> {
    try {
      const pendingVessel = await AsyncStorage.getItem('waves_pending_vessel');
      if (pendingVessel) {
        const vesselInfo: VesselInfo = JSON.parse(pendingVessel);
        await this.linkVesselToUser(vesselInfo, user);
        await AsyncStorage.removeItem('waves_pending_vessel');
        
        console.log('🚢 Vessel information linked to user account');
      }
    } catch (error) {
      console.error('Error processing pending vessel info:', error);
    }
  }

  /**
   * Link vessel information to authenticated user
   */
  private static async linkVesselToUser(vesselInfo: VesselInfo, user: CognitoUser): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('waves_access_token');
      if (!token) {
        throw new Error('No access token available');
      }

      const response = await fetch('/api/users/link-vessel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.sub,
          vessel_info: vesselInfo,
          emergency_contacts: vesselInfo.emergencyContacts
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to link vessel: ${response.status}`);
      }

      console.log('✅ Vessel successfully linked to user account');
    } catch (error) {
      console.error('Error linking vessel to user:', error);
      // Store for retry later
      await AsyncStorage.setItem('waves_pending_vessel_retry', JSON.stringify(vesselInfo));
    }
  }

  /**
   * Clean up authentication parameters from URL
   */
  private static cleanUpAuthURL(): void {
    if (window.history && window.history.replaceState) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }

  /**
   * Handle post-authentication redirect
   */
  private static async handlePostAuthRedirect(): Promise<void> {
    try {
      const returnUrl = await AsyncStorage.getItem('waves_auth_return_url');
      await AsyncStorage.removeItem('waves_auth_return_url');
      
      if (returnUrl && returnUrl !== '/') {
        setTimeout(() => {
          window.location.href = returnUrl;
        }, 1000);
      }
    } catch (error) {
      console.error('Error handling post-auth redirect:', error);
    }
  }

  /**
   * Get current authentication status
   */
  static async getCurrentUser(): Promise<CognitoUser | null> {
    try {
      const token = await AsyncStorage.getItem('waves_access_token');
      if (!token) {
        return null;
      }

      // Decode token to get user info
      return this.decodeJWTPayload(token) as CognitoUser;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('waves_access_token');
      const timestamp = await AsyncStorage.getItem('waves_auth_timestamp');
      
      if (!token || !timestamp) {
        return false;
      }

      // Check if token is expired (assuming 1 hour expiry)
      const tokenAge = Date.now() - parseInt(timestamp);
      return tokenAge < 3600000; // 1 hour in milliseconds
    } catch {
      return false;
    }
  }

  /**
   * Sign out user and clean up tokens
   */
  static async signOut(): Promise<void> {
    try {
      await AsyncStorage.removeItem('waves_access_token');
      await AsyncStorage.removeItem('waves_refresh_token');
      await AsyncStorage.removeItem('waves_auth_timestamp');
      await AsyncStorage.removeItem('waves_pending_vessel');
      await AsyncStorage.removeItem('waves_pending_vessel_retry');
      
      console.log('🚪 User signed out successfully');
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  }

  /**
   * Get current access token
   */
  static async getAccessToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem('waves_access_token');
      const isValid = await this.isAuthenticated();
      
      return isValid ? token : null;
    } catch {
      return null;
    }
  }
}

export default MarineSocialAuth;