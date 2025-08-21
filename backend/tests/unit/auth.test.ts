// Authentication Service Unit Tests
// Test JWT token management and user authentication

import { AuthService, PasswordManager, SessionManager, TokenManager } from '../../src/middleware/auth';
import { testHelper } from '../setup';
import { v4 as uuidv4 } from 'uuid';

describe('Authentication Service', () => {
  describe('PasswordManager', () => {
    test('should hash and verify passwords correctly', async () => {
      const password = process.env.TEST_PASSWORD || 'testPassword123';
      
      // Hash password
      const hash = await PasswordManager.hash(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);

      // Verify correct password
      const isValid = await PasswordManager.verify(password, hash);
      expect(isValid).toBe(true);

      // Verify incorrect password
      const isInvalid = await PasswordManager.verify('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });

    test('should generate different hashes for same password', async () => {
      const password = process.env.TEST_PASSWORD || 'testPassword123';
      
      const hash1 = await PasswordManager.hash(password);
      const hash2 = await PasswordManager.hash(password);
      
      expect(hash1).not.toBe(hash2);
      
      // Both should verify correctly
      expect(await PasswordManager.verify(password, hash1)).toBe(true);
      expect(await PasswordManager.verify(password, hash2)).toBe(true);
    });
  });

  describe('AuthService', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await testHelper.createTestUser({
        email: 'auth.test@example.com'
      });
    });

    test('should authenticate user with correct credentials', async () => {
      const authenticatedUser = await AuthService.authenticateUser(
        'auth.test@example.com',
        'test123' // This matches the default hashed password in test setup
      );

      expect(authenticatedUser).toBeDefined();
      expect(authenticatedUser.id).toBe(testUser.id);
      expect(authenticatedUser.email).toBe('auth.test@example.com');
      expect(authenticatedUser).not.toHaveProperty('password_hash');
    });

    test('should return null for incorrect password', async () => {
      const result = await AuthService.authenticateUser(
        'auth.test@example.com',
        'wrongPassword'
      );

      expect(result).toBeNull();
    });

    test('should return null for non-existent user', async () => {
      const result = await AuthService.authenticateUser(
        'nonexistent@example.com',
        'anyPassword'
      );

      expect(result).toBeNull();
    });

    test('should check if email exists', async () => {
      const exists = await AuthService.emailExists('auth.test@example.com');
      expect(exists).toBe(true);

      const notExists = await AuthService.emailExists('nonexistent@example.com');
      expect(notExists).toBe(false);
    });

    test('should create new user', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: process.env.TEST_PASSWORD || 'newPassword123',
        firstName: 'New',
        lastName: 'User'
      };

      const newUser = await AuthService.createUser(userData);

      expect(newUser).toBeDefined();
      expect(newUser.email).toBe('newuser@example.com');
      expect(newUser.firstName).toBe('New');
      expect(newUser.lastName).toBe('User');
      expect(newUser.role).toBe('user');
      expect(newUser.isVerified).toBe(false);
      expect(newUser).not.toHaveProperty('password_hash');

      // Verify user can authenticate with new password
      const authenticatedUser = await AuthService.authenticateUser(
        'newuser@example.com',
        'newPassword123'
      );
      expect(authenticatedUser).toBeDefined();
      expect(authenticatedUser.id).toBe(newUser.id);
    });

    test('should throw error when creating user with existing email', async () => {
      const userData = {
        email: 'auth.test@example.com', // Already exists
        password: process.env.TEST_PASSWORD || 'password123'
      };

      await expect(AuthService.createUser(userData)).rejects.toThrow('Email already exists');
    });
  });

  describe('SessionManager', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await testHelper.createTestUser({
        email: 'session.test@example.com'
      });
    });

    test('should create new session', async () => {
      const deviceInfo = { userAgent: 'Test Browser', platform: 'test' };
      const ipAddress = '127.0.0.1';
      const userAgent = 'Test User Agent';

      const { sessionId, refreshToken } = await SessionManager.createSession(
        testUser.id,
        deviceInfo,
        ipAddress,
        userAgent
      );

      expect(sessionId).toBeDefined();
      expect(refreshToken).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(typeof refreshToken).toBe('string');
      expect(sessionId.length).toBeGreaterThan(30);
      expect(refreshToken.length).toBeGreaterThan(30);
    });

    test('should refresh valid session', async () => {
      const { sessionId, refreshToken } = await SessionManager.createSession(testUser.id);

      const refreshResult = await SessionManager.refreshSession(
        testUser.id,
        sessionId,
        refreshToken
      );

      expect(refreshResult.valid).toBe(true);
      expect(refreshResult.newSessionId).toBeDefined();
      expect(refreshResult.newRefreshToken).toBeDefined();
      expect(refreshResult.newSessionId).not.toBe(sessionId);
      expect(refreshResult.newRefreshToken).not.toBe(refreshToken);
    });

    test('should reject invalid refresh token', async () => {
      const { sessionId } = await SessionManager.createSession(testUser.id);

      const refreshResult = await SessionManager.refreshSession(
        testUser.id,
        sessionId,
        'invalid-refresh-token'
      );

      expect(refreshResult.valid).toBe(false);
      expect(refreshResult.newSessionId).toBeUndefined();
      expect(refreshResult.newRefreshToken).toBeUndefined();
    });

    test('should invalidate session', async () => {
      const { sessionId, refreshToken } = await SessionManager.createSession(testUser.id);

      // Verify session is valid initially
      const refreshResult1 = await SessionManager.refreshSession(
        testUser.id,
        sessionId,
        refreshToken
      );
      expect(refreshResult1.valid).toBe(true);

      // Invalidate session
      await SessionManager.invalidateSession(sessionId);

      // Verify session is no longer valid
      const refreshResult2 = await SessionManager.refreshSession(
        testUser.id,
        sessionId,
        refreshToken
      );
      expect(refreshResult2.valid).toBe(false);
    });

    test('should invalidate all user sessions', async () => {
      // Create multiple sessions
      const session1 = await SessionManager.createSession(testUser.id);
      const session2 = await SessionManager.createSession(testUser.id);

      // Verify both sessions are valid
      const refresh1 = await SessionManager.refreshSession(
        testUser.id,
        session1.sessionId,
        session1.refreshToken
      );
      const refresh2 = await SessionManager.refreshSession(
        testUser.id,
        session2.sessionId,
        session2.refreshToken
      );
      expect(refresh1.valid).toBe(true);
      expect(refresh2.valid).toBe(true);

      // Invalidate all sessions
      await SessionManager.invalidateAllUserSessions(testUser.id);

      // Verify both sessions are no longer valid
      const refresh1After = await SessionManager.refreshSession(
        testUser.id,
        session1.sessionId,
        session1.refreshToken
      );
      const refresh2After = await SessionManager.refreshSession(
        testUser.id,
        session2.sessionId,
        session2.refreshToken
      );
      expect(refresh1After.valid).toBe(false);
      expect(refresh2After.valid).toBe(false);
    });
  });

  describe('TokenManager', () => {
    test('should decode token without verification', () => {
      const payload = {
        userId: 'test-user-id',
        sessionId: 'test-session-id',
        iat: Math.floor(Date.now() / 1000)
      };

      // Create a simple base64 encoded token (not a real JWT)
      const fakeToken = `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.signature`;
      
      const decoded = TokenManager.decodeToken(fakeToken);
      
      expect(decoded).toEqual(payload);
    });

    test('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.format';
      const decoded = TokenManager.decodeToken(invalidToken);
      expect(decoded).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    test('should complete full authentication flow', async () => {
      // 1. Create user
      const userData = {
        email: 'integration@example.com',
        password: process.env.TEST_PASSWORD || 'integrationTest123',
        firstName: 'Integration',
        lastName: 'Test'
      };

      const user = await AuthService.createUser(userData);
      expect(user).toBeDefined();

      // 2. Authenticate user
      const authenticatedUser = await AuthService.authenticateUser(
        userData.email,
        userData.password
      );
      expect(authenticatedUser).toBeDefined();
      expect(authenticatedUser.id).toBe(user.id);

      // 3. Create session
      const { sessionId, refreshToken } = await SessionManager.createSession(user.id);
      expect(sessionId).toBeDefined();
      expect(refreshToken).toBeDefined();

      // 4. Refresh session
      const refreshResult = await SessionManager.refreshSession(
        user.id,
        sessionId,
        refreshToken
      );
      expect(refreshResult.valid).toBe(true);
      expect(refreshResult.newSessionId).toBeDefined();

      // 5. Invalidate session
      await SessionManager.invalidateSession(refreshResult.newSessionId!);

      // 6. Verify session is invalidated
      const finalRefresh = await SessionManager.refreshSession(
        user.id,
        refreshResult.newSessionId!,
        refreshResult.newRefreshToken!
      );
      expect(finalRefresh.valid).toBe(false);
    });
  });
});