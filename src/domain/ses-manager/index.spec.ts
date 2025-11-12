import { describe, expect, test, beforeEach, mock } from 'bun:test';

const mockGetSesAccountDetail = mock(() => ({
  ProductionAccessEnabled: true
}));
const mockGetSesIdentitiesStatus = mock(() => ({}));
const mockStartEvent = mock(async () => {});
const mockFinishEvent = mock(async () => {});
const mockGetAllParentDomains = mock((domain) => {
  const parts = domain.split('.');
  const parents: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    parents.push(parts.slice(i).join('.'));
  }
  return parents;
});
const mockIsEmailValid = mock(() => true);

const mockGlobalStateManager = {
  region: 'us-east-1'
};

const mockStpErrors = {
  e55: mock(({ invalidEmail }) => new Error(`Invalid email: ${invalidEmail}`)),
  e56: mock(({ email, region }) => new Error(`Sender email ${email} not verified in ${region}`)),
  e57: mock(({ email, region }) => new Error(`Recipient email ${email} not verified in ${region}`))
};

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    getSesAccountDetail: mockGetSesAccountDetail,
    getSesIdentitiesStatus: mockGetSesIdentitiesStatus
  }
}));

mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mockStartEvent,
    finishEvent: mockFinishEvent
  }
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: mockGlobalStateManager
}));

mock.module('@utils/domains', () => ({
  getAllParentDomains: mockGetAllParentDomains
}));

mock.module('@shared/utils/validation', () => ({
  isEmailValid: mockIsEmailValid
}));

mock.module('@errors', () => ({
  stpErrors: mockStpErrors
}));

describe('SesManager', () => {
  let sesManager: any;

  beforeEach(async () => {
    mock.restore();
    mockGetSesAccountDetail.mockClear();
    mockGetSesIdentitiesStatus.mockClear();
    mockStartEvent.mockClear();
    mockFinishEvent.mockClear();
    mockGetAllParentDomains.mockClear();
    mockIsEmailValid.mockClear();
    mockStpErrors.e55.mockClear();
    mockStpErrors.e56.mockClear();
    mockStpErrors.e57.mockClear();

    mockGetSesAccountDetail.mockResolvedValue({
      ProductionAccessEnabled: true
    });
    mockGetSesIdentitiesStatus.mockResolvedValue({});
    mockIsEmailValid.mockReturnValue(true);
    mockGetAllParentDomains.mockImplementation((domain) => {
      const parts = domain.split('.');
      const parents: string[] = [];
      for (let i = 1; i < parts.length; i++) {
        parents.push(parts.slice(i).join('.'));
      }
      return parents;
    });

    const module = await import('./index');
    sesManager = module.sesManager;
    await sesManager.init({ identities: [] });
  });

  describe('initialization', () => {
    test('should initialize successfully with empty identities', async () => {
      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: [] });
      expect(manager).toBeDefined();
    });

    test('should fetch SES info when identities provided', async () => {
      mockGetSesAccountDetail.mockResolvedValueOnce({
        ProductionAccessEnabled: true
      });
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({
        'user@example.com': {
          VerificationStatus: 'Success'
        },
        'example.com': {
          VerificationStatus: 'Success'
        }
      });

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: ['user@example.com'] });

      expect(mockStartEvent).toHaveBeenCalledWith({
        eventType: 'FETCH_MAIL_INFO',
        description: 'Fetching email info'
      });
      expect(mockGetSesAccountDetail).toHaveBeenCalled();
      expect(mockGetSesIdentitiesStatus).toHaveBeenCalled();
      expect(mockFinishEvent).toHaveBeenCalledWith({
        eventType: 'FETCH_MAIL_INFO'
      });
    });

    test('should skip fetching when no identities provided', async () => {
      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: [] });

      expect(mockStartEvent).not.toHaveBeenCalled();
      expect(mockGetSesAccountDetail).not.toHaveBeenCalled();
      expect(mockGetSesIdentitiesStatus).not.toHaveBeenCalled();
    });

    test('should check parent domains for email identities', async () => {
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({});

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: ['user@sub.example.com'] });

      expect(mockGetSesIdentitiesStatus).toHaveBeenCalledWith({
        identities: expect.arrayContaining([
          'user@sub.example.com',
          'sub.example.com',
          'example.com',
          'com'
        ])
      });
    });

    test('should check parent domains for domain identities', async () => {
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({});

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: ['sub.example.com'] });

      expect(mockGetSesIdentitiesStatus).toHaveBeenCalledWith({
        identities: expect.arrayContaining([
          'sub.example.com',
          'example.com',
          'com'
        ])
      });
    });
  });

  describe('isIdentityVerified', () => {
    test('should return true for verified identity', async () => {
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({
        'user@example.com': {
          VerificationStatus: 'Success'
        }
      });

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: ['user@example.com'] });

      const isVerified = manager.isIdentityVerified({ identity: 'user@example.com' });
      expect(isVerified).toBe(true);
    });

    test('should return false for unverified identity', async () => {
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({
        'user@example.com': {
          VerificationStatus: 'Pending'
        }
      });

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: ['user@example.com'] });

      const isVerified = manager.isIdentityVerified({ identity: 'user@example.com' });
      expect(isVerified).toBe(false);
    });

    test('should return false for non-existent identity', async () => {
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({});

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: ['other@example.com'] });

      const isVerified = manager.isIdentityVerified({ identity: 'user@example.com' });
      expect(isVerified).toBe(false);
    });
  });

  describe('getVerifiedIdentityForEmail', () => {
    test('should return verified email identity', async () => {
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({
        'user@example.com': {
          VerificationStatus: 'Success'
        }
      });

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: ['user@example.com'] });

      const verified = manager.getVerifiedIdentityForEmail({ email: 'user@example.com' });
      expect(verified).toBe('user@example.com');
    });

    test('should return verified parent domain', async () => {
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({
        'example.com': {
          VerificationStatus: 'Success'
        }
      });

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: ['example.com'] });

      const verified = manager.getVerifiedIdentityForEmail({ email: 'user@sub.example.com' });
      expect(verified).toBe('example.com');
    });

    test('should return undefined when no verified identity found', async () => {
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({});

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: [] });

      const verified = manager.getVerifiedIdentityForEmail({ email: 'user@example.com' });
      expect(verified).toBeUndefined();
    });

    test('should check identities in order (specific first)', async () => {
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({
        'user@example.com': {
          VerificationStatus: 'Success'
        },
        'example.com': {
          VerificationStatus: 'Success'
        }
      });

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: ['user@example.com', 'example.com'] });

      const verified = manager.getVerifiedIdentityForEmail({ email: 'user@example.com' });
      expect(verified).toBe('user@example.com');
    });
  });

  describe('verifyEmailUsability', () => {
    test('should pass for valid sender email with production access', async () => {
      mockGetSesAccountDetail.mockResolvedValueOnce({
        ProductionAccessEnabled: true
      });
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({
        'sender@example.com': {
          VerificationStatus: 'Success'
        }
      });

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: ['sender@example.com'] });

      const result = manager.verifyEmailUsability({
        email: 'sender@example.com',
        role: 'sender'
      });
      expect(result).toBe(true);
    });

    test('should pass for recipient email with production access and unverified recipient', async () => {
      mockGetSesAccountDetail.mockResolvedValueOnce({
        ProductionAccessEnabled: true
      });
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({});

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: [] });

      const result = manager.verifyEmailUsability({
        email: 'recipient@example.com',
        role: 'recipient'
      });
      expect(result).toBe(true);
    });

    test('should throw error for invalid email', async () => {
      mockIsEmailValid.mockReturnValueOnce(false);
      mockStpErrors.e55.mockReturnValueOnce(new Error('Invalid email'));

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: [] });

      expect(() =>
        manager.verifyEmailUsability({
          email: 'invalid-email',
          role: 'sender'
        })
      ).toThrow('Invalid email');
    });

    test('should throw error for unverified sender email', async () => {
      mockGetSesAccountDetail.mockResolvedValueOnce({
        ProductionAccessEnabled: true
      });
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({});
      mockStpErrors.e56.mockReturnValueOnce(new Error('Sender not verified'));

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: [] });

      expect(() =>
        manager.verifyEmailUsability({
          email: 'sender@example.com',
          role: 'sender'
        })
      ).toThrow('Sender not verified');
    });

    test('should throw error for unverified recipient in sandbox mode', async () => {
      mockGetSesAccountDetail.mockResolvedValueOnce({
        ProductionAccessEnabled: false
      });
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({});
      mockStpErrors.e57.mockReturnValueOnce(new Error('Recipient not verified in sandbox'));

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: [] });

      expect(() =>
        manager.verifyEmailUsability({
          email: 'recipient@example.com',
          role: 'recipient'
        })
      ).toThrow('Recipient not verified in sandbox');
    });

    test('should pass for verified recipient in sandbox mode', async () => {
      mockGetSesAccountDetail.mockResolvedValueOnce({
        ProductionAccessEnabled: false
      });
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({
        'recipient@example.com': {
          VerificationStatus: 'Success'
        }
      });

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: ['recipient@example.com'] });

      const result = manager.verifyEmailUsability({
        email: 'recipient@example.com',
        role: 'recipient'
      });
      expect(result).toBe(true);
    });

    test('should accept verified parent domain for sender', async () => {
      mockGetSesAccountDetail.mockResolvedValueOnce({
        ProductionAccessEnabled: true
      });
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({
        'example.com': {
          VerificationStatus: 'Success'
        }
      });

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: ['example.com'] });

      const result = manager.verifyEmailUsability({
        email: 'sender@example.com',
        role: 'sender'
      });
      expect(result).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('should handle multiple identity types', async () => {
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({
        'user@example.com': { VerificationStatus: 'Success' },
        'example.com': { VerificationStatus: 'Success' },
        'another.com': { VerificationStatus: 'Pending' }
      });

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({
        identities: ['user@example.com', 'example.com', 'another.com']
      });

      expect(manager.isIdentityVerified({ identity: 'user@example.com' })).toBe(true);
      expect(manager.isIdentityVerified({ identity: 'example.com' })).toBe(true);
      expect(manager.isIdentityVerified({ identity: 'another.com' })).toBe(false);
    });

    test('should handle API errors gracefully', async () => {
      mockGetSesAccountDetail.mockRejectedValueOnce(new Error('SES API Error'));

      const { SesManager } = await import('./index');
      const manager = new SesManager();

      await expect(
        manager.init({ identities: ['user@example.com'] })
      ).rejects.toThrow('SES API Error');
    });

    test('should handle empty verification status', async () => {
      mockGetSesIdentitiesStatus.mockResolvedValueOnce({
        'user@example.com': {}
      });

      const { SesManager } = await import('./index');
      const manager = new SesManager();
      await manager.init({ identities: ['user@example.com'] });

      const isVerified = manager.isIdentityVerified({ identity: 'user@example.com' });
      expect(isVerified).toBe(false);
    });
  });
});
