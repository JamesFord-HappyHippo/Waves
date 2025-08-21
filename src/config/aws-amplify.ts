/**
 * AWS Amplify Configuration for Waves Marine Navigation
 * Connects to real AWS Cognito and API Gateway
 */

import { Amplify } from '@aws-amplify/core';
import { Auth } from '@aws-amplify/auth';

export interface AmplifyConfig {
  region: string;
  userPoolId: string;
  userPoolWebClientId: string;
  apiGatewayUrl: string;
  identityPoolId?: string;
  storage?: {
    bucketName: string;
    region: string;
  };
}

// Environment-specific configurations
const configs: Record<string, AmplifyConfig> = {
  development: {
    region: 'us-east-1',
    userPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID || 'us-east-1_DEV123456',
    userPoolWebClientId: process.env.REACT_APP_COGNITO_CLIENT_ID || 'dev-client-id',
    apiGatewayUrl: process.env.REACT_APP_API_URL || 'https://api-dev.seawater.io',
    identityPoolId: process.env.REACT_APP_COGNITO_IDENTITY_POOL_ID,
    storage: {
      bucketName: process.env.REACT_APP_S3_BUCKET || 'waves-dev-storage',
      region: 'us-east-1',
    },
  },
  staging: {
    region: 'us-east-1',
    userPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID || 'us-east-1_STG123456',
    userPoolWebClientId: process.env.REACT_APP_COGNITO_CLIENT_ID || 'staging-client-id',
    apiGatewayUrl: process.env.REACT_APP_API_URL || 'https://api-staging.seawater.io',
    identityPoolId: process.env.REACT_APP_COGNITO_IDENTITY_POOL_ID,
    storage: {
      bucketName: process.env.REACT_APP_S3_BUCKET || 'waves-staging-storage',
      region: 'us-east-1',
    },
  },
  production: {
    region: 'us-east-1',
    userPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID || 'us-east-1_PROD123456',
    userPoolWebClientId: process.env.REACT_APP_COGNITO_CLIENT_ID || 'production-client-id',
    apiGatewayUrl: process.env.REACT_APP_API_URL || 'https://api.seawater.io',
    identityPoolId: process.env.REACT_APP_COGNITO_IDENTITY_POOL_ID,
    storage: {
      bucketName: process.env.REACT_APP_S3_BUCKET || 'waves-production-storage',
      region: 'us-east-1',
    },
  },
};

/**
 * Initialize AWS Amplify with environment-specific configuration
 */
export const initializeAmplify = (): void => {
  const environment = process.env.NODE_ENV || 'development';
  const config = configs[environment];

  if (!config) {
    throw new Error(`No Amplify configuration found for environment: ${environment}`);
  }

  console.log(`Initializing Amplify for environment: ${environment}`);
  console.log(`API Gateway URL: ${config.apiGatewayUrl}`);
  console.log(`Cognito User Pool: ${config.userPoolId}`);

  const amplifyConfig = {
    Auth: {
      region: config.region,
      userPoolId: config.userPoolId,
      userPoolWebClientId: config.userPoolWebClientId,
      mandatorySignIn: true,
      authenticationFlowType: 'USER_SRP_AUTH',
      ...(config.identityPoolId && { identityPoolId: config.identityPoolId }),
    },
    API: {
      endpoints: [
        {
          name: 'WavesAPI',
          endpoint: config.apiGatewayUrl,
          region: config.region,
          custom_header: async () => {
            try {
              const session = await Auth.currentSession();
              return {
                Authorization: `Bearer ${session.getIdToken().getJwtToken()}`,
              };
            } catch (error) {
              console.error('Failed to get auth token for API call:', error);
              return {};
            }
          },
        },
      ],
    },
    ...(config.storage && {
      Storage: {
        AWSS3: {
          bucket: config.storage.bucketName,
          region: config.storage.region,
        },
      },
    }),
  };

  Amplify.configure(amplifyConfig);
};

/**
 * Get current Amplify configuration
 */
export const getCurrentConfig = (): AmplifyConfig => {
  const environment = process.env.NODE_ENV || 'development';
  const config = configs[environment];

  if (!config) {
    throw new Error(`No Amplify configuration found for environment: ${environment}`);
  }

  return config;
};

/**
 * Test Amplify authentication
 */
export const testAuthentication = async (): Promise<{
  isAuthenticated: boolean;
  user?: any;
  error?: string;
}> => {
  try {
    const user = await Auth.currentAuthenticatedUser();
    return {
      isAuthenticated: true,
      user: {
        username: user.username,
        email: user.attributes?.email,
        sub: user.attributes?.sub,
      },
    };
  } catch (error) {
    return {
      isAuthenticated: false,
      error: error.message,
    };
  }
};

/**
 * Sign in with email and password
 */
export const signIn = async (email: string, password: string): Promise<any> => {
  try {
    const user = await Auth.signIn(email, password);
    console.log('User signed in successfully:', user.username);
    return user;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
};

/**
 * Sign up new user
 */
export const signUp = async (
  email: string,
  password: string,
  attributes: { name?: string; phone_number?: string } = {}
): Promise<any> => {
  try {
    const user = await Auth.signUp({
      username: email,
      password,
      attributes: {
        email,
        ...attributes,
      },
    });
    console.log('User signed up successfully:', user.userSub);
    return user;
  } catch (error) {
    console.error('Sign up error:', error);
    throw error;
  }
};

/**
 * Confirm sign up with verification code
 */
export const confirmSignUp = async (email: string, code: string): Promise<any> => {
  try {
    const result = await Auth.confirmSignUp(email, code);
    console.log('Sign up confirmed successfully');
    return result;
  } catch (error) {
    console.error('Confirm sign up error:', error);
    throw error;
  }
};

/**
 * Sign out current user
 */
export const signOut = async (): Promise<void> => {
  try {
    await Auth.signOut();
    console.log('User signed out successfully');
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

/**
 * Reset password
 */
export const resetPassword = async (email: string): Promise<any> => {
  try {
    const result = await Auth.forgotPassword(email);
    console.log('Password reset initiated');
    return result;
  } catch (error) {
    console.error('Reset password error:', error);
    throw error;
  }
};

/**
 * Confirm password reset with code
 */
export const confirmResetPassword = async (
  email: string,
  code: string,
  newPassword: string
): Promise<any> => {
  try {
    const result = await Auth.forgotPasswordSubmit(email, code, newPassword);
    console.log('Password reset confirmed');
    return result;
  } catch (error) {
    console.error('Confirm reset password error:', error);
    throw error;
  }
};

// Initialize Amplify when this module is imported
initializeAmplify();