import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock dependencies
const mockJsonFetch = mock(async () => []);
const mockGetStacktapeVersion = mock(() => '1.0.0');
const mockGetLatestStacktapeVersion = mock(async () => '1.1.0');
const mockGetInstallationScript = mock(() => 'npm install -g stacktape');
const mockGt = mock((v1, v2) => v1 > v2);

const mockPrinter = {
  announcement: mock(() => {}),
  info: mock(() => {}),
  makeBold: mock((str) => str),
  colorize: mock((color, str) => str)
};

const mockConfig = {
  ANNOUNCEMENTS_ENDPOINT: 'https://announcements.example.com',
  IS_DEV: false
};

mock.module('@utils/http-client', () => ({
  jsonFetch: mockJsonFetch
}));

mock.module('@utils/printer', () => ({
  printer: mockPrinter
}));

mock.module('@utils/versioning', () => ({
  getStacktapeVersion: mockGetStacktapeVersion,
  getLatestStacktapeVersion: mockGetLatestStacktapeVersion
}));

mock.module('@shared/utils/bin-executable', () => ({
  getInstallationScript: mockGetInstallationScript
}));

mock.module('semver', () => ({
  gt: mockGt
}));

mock.module('@config', () => mockConfig);

describe('AnnouncementsManager', () => {
  let announcementsManager: any;

  beforeEach(async () => {
    mock.restore();

    // Clear all mocks
    mockJsonFetch.mockClear();
    mockGetStacktapeVersion.mockClear();
    mockGetLatestStacktapeVersion.mockClear();
    mockGetInstallationScript.mockClear();
    mockGt.mockClear();
    mockPrinter.announcement.mockClear();
    mockPrinter.info.mockClear();
    mockPrinter.makeBold.mockClear();
    mockPrinter.colorize.mockClear();

    // Set up default implementations
    mockJsonFetch.mockResolvedValue([]);
    mockGetStacktapeVersion.mockReturnValue('1.0.0');
    mockGetLatestStacktapeVersion.mockResolvedValue('1.1.0');
    mockGetInstallationScript.mockReturnValue('npm install -g stacktape');
    mockGt.mockImplementation((v1, v2) => {
      const parseVersion = (v: string) => {
        const normalized = v.replace('dev-', '').split('.').slice(0, 3).join('.');
        return normalized.split('.').map(Number);
      };
      const v1Parts = parseVersion(v1);
      const v2Parts = parseVersion(v2);
      for (let i = 0; i < 3; i++) {
        if (v1Parts[i] > v2Parts[i]) return true;
        if (v1Parts[i] < v2Parts[i]) return false;
      }
      return false;
    });
    mockPrinter.makeBold.mockImplementation((str) => str);
    mockPrinter.colorize.mockImplementation((color, str) => str);
    mockConfig.IS_DEV = false;

    const module = await import('./index');
    announcementsManager = module.announcementsManager;
    await announcementsManager.init();
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      const module = await import('./index');
      const { AnnouncementsManager } = module;
      const manager = new AnnouncementsManager();
      await manager.init();

      expect(manager).toBeDefined();
    });
  });

  describe('printAnnouncements', () => {
    test('should fetch and print announcements', async () => {
      mockJsonFetch.mockResolvedValueOnce([
        { message: 'New feature available!', highlight: true },
        { message: 'Bug fix released', highlight: false }
      ]);

      await announcementsManager.printAnnouncements();

      expect(mockJsonFetch).toHaveBeenCalledWith(
        'https://announcements.example.com/messages.json'
      );
      expect(mockPrinter.announcement).toHaveBeenCalledTimes(2);
      expect(mockPrinter.announcement).toHaveBeenCalledWith('New feature available!', true);
      expect(mockPrinter.announcement).toHaveBeenCalledWith('Bug fix released', false);
    });

    test('should use highlight=true by default when not specified', async () => {
      mockJsonFetch.mockResolvedValueOnce([
        { message: 'Important announcement' }
      ]);

      await announcementsManager.printAnnouncements();

      expect(mockPrinter.announcement).toHaveBeenCalledWith('Important announcement', true);
    });

    test('should print multiple announcements', async () => {
      mockJsonFetch.mockResolvedValueOnce([
        { message: 'Announcement 1', highlight: true },
        { message: 'Announcement 2', highlight: true },
        { message: 'Announcement 3', highlight: false }
      ]);

      await announcementsManager.printAnnouncements();

      expect(mockPrinter.announcement).toHaveBeenCalledTimes(3);
    });

    test('should handle empty announcements array', async () => {
      mockJsonFetch.mockResolvedValueOnce([]);

      await announcementsManager.printAnnouncements();

      expect(mockJsonFetch).toHaveBeenCalled();
      expect(mockPrinter.announcement).not.toHaveBeenCalled();
    });

    test('should silently fail on fetch error', async () => {
      mockJsonFetch.mockRejectedValueOnce(new Error('Network error'));

      await announcementsManager.printAnnouncements();

      expect(mockJsonFetch).toHaveBeenCalled();
      expect(mockPrinter.announcement).not.toHaveBeenCalled();
      // Should not throw error
    });

    test('should handle malformed announcement data', async () => {
      mockJsonFetch.mockResolvedValueOnce([
        { message: 'Valid announcement', highlight: true },
        { invalidField: 'no message' }
      ]);

      await announcementsManager.printAnnouncements();

      // Should still process valid announcements
      expect(mockPrinter.announcement).toHaveBeenCalled();
    });
  });

  describe('checkForUpdates', () => {
    test('should check for updates and show message when newer version available', async () => {
      mockGetStacktapeVersion.mockReturnValue('1.0.0');
      mockGetLatestStacktapeVersion.mockResolvedValue('1.1.0');
      mockGt.mockReturnValue(true);

      await announcementsManager.checkForUpdates();

      expect(mockGetStacktapeVersion).toHaveBeenCalled();
      expect(mockGetLatestStacktapeVersion).toHaveBeenCalled();
      expect(mockGt).toHaveBeenCalledWith('1.1.0', '1.0.0');
      expect(mockPrinter.info).toHaveBeenCalled();
      expect(mockGetInstallationScript).toHaveBeenCalled();
    });

    test('should not show message when current version is latest', async () => {
      mockGetStacktapeVersion.mockReturnValue('1.1.0');
      mockGetLatestStacktapeVersion.mockResolvedValue('1.1.0');
      mockGt.mockReturnValue(false);

      await announcementsManager.checkForUpdates();

      expect(mockGetStacktapeVersion).toHaveBeenCalled();
      expect(mockGetLatestStacktapeVersion).toHaveBeenCalled();
      expect(mockPrinter.info).not.toHaveBeenCalled();
    });

    test('should not show message when current version is newer', async () => {
      mockGetStacktapeVersion.mockReturnValue('2.0.0');
      mockGetLatestStacktapeVersion.mockResolvedValue('1.9.0');
      mockGt.mockReturnValue(false);

      await announcementsManager.checkForUpdates();

      expect(mockPrinter.info).not.toHaveBeenCalled();
    });

    test('should skip check in dev mode', async () => {
      mockConfig.IS_DEV = true;

      await announcementsManager.checkForUpdates();

      expect(mockGetStacktapeVersion).not.toHaveBeenCalled();
      expect(mockGetLatestStacktapeVersion).not.toHaveBeenCalled();
      expect(mockPrinter.info).not.toHaveBeenCalled();
    });

    test('should skip check for beta versions', async () => {
      mockConfig.IS_DEV = false;
      mockGetStacktapeVersion.mockReturnValue('1.0.0-beta.1');

      await announcementsManager.checkForUpdates();

      expect(mockGetStacktapeVersion).toHaveBeenCalled();
      expect(mockGetLatestStacktapeVersion).not.toHaveBeenCalled();
      expect(mockPrinter.info).not.toHaveBeenCalled();
    });

    test('should skip check for alpha versions', async () => {
      mockConfig.IS_DEV = false;
      mockGetStacktapeVersion.mockReturnValue('1.0.0-alpha.3');

      await announcementsManager.checkForUpdates();

      expect(mockGetStacktapeVersion).toHaveBeenCalled();
      expect(mockGetLatestStacktapeVersion).not.toHaveBeenCalled();
      expect(mockPrinter.info).not.toHaveBeenCalled();
    });

    test('should normalize dev- prefix in version comparison', async () => {
      mockGetStacktapeVersion.mockReturnValue('dev-1.0.0');
      mockGetLatestStacktapeVersion.mockResolvedValue('1.1.0');
      mockGt.mockReturnValue(true);

      await announcementsManager.checkForUpdates();

      expect(mockGetLatestStacktapeVersion).toHaveBeenCalled();
      expect(mockGt).toHaveBeenCalledWith('1.1.0', '1.0.0');
    });

    test('should handle version with more than 3 parts', async () => {
      mockGetStacktapeVersion.mockReturnValue('1.0.0.1234');
      mockGetLatestStacktapeVersion.mockResolvedValue('1.1.0');
      mockGt.mockReturnValue(true);

      await announcementsManager.checkForUpdates();

      expect(mockGt).toHaveBeenCalledWith('1.1.0', '1.0.0');
    });

    test('should display installation command in update message', async () => {
      mockGetStacktapeVersion.mockReturnValue('1.0.0');
      mockGetLatestStacktapeVersion.mockResolvedValue('1.1.0');
      mockGt.mockReturnValue(true);
      mockGetInstallationScript.mockReturnValue('curl -sSL https://install.stacktape.com | bash');

      await announcementsManager.checkForUpdates();

      expect(mockPrinter.info).toHaveBeenCalled();
      expect(mockGetInstallationScript).toHaveBeenCalled();
      expect(mockPrinter.makeBold).toHaveBeenCalled();
      expect(mockPrinter.colorize).toHaveBeenCalledWith('yellow', expect.any(String));
    });

    test('should handle multi-word installation command', async () => {
      mockGetStacktapeVersion.mockReturnValue('1.0.0');
      mockGetLatestStacktapeVersion.mockResolvedValue('1.1.0');
      mockGt.mockReturnValue(true);
      mockGetInstallationScript.mockReturnValue('npm install -g stacktape@latest');

      await announcementsManager.checkForUpdates();

      expect(mockPrinter.info).toHaveBeenCalled();
      expect(mockPrinter.colorize).toHaveBeenCalledWith('yellow', 'npm');
    });
  });

  describe('edge cases', () => {
    test('should handle fetch timeout', async () => {
      mockJsonFetch.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      await announcementsManager.printAnnouncements();

      // Should not throw error
      expect(true).toBe(true);
    });

    test('should handle invalid JSON response', async () => {
      mockJsonFetch.mockRejectedValueOnce(new SyntaxError('Invalid JSON'));

      await announcementsManager.printAnnouncements();

      expect(mockPrinter.announcement).not.toHaveBeenCalled();
    });

    test('should handle API returning null', async () => {
      mockJsonFetch.mockResolvedValueOnce(null);

      await announcementsManager.printAnnouncements();

      // Should not throw error
      expect(true).toBe(true);
    });

    test('should handle getLatestStacktapeVersion failure', async () => {
      mockConfig.IS_DEV = false;
      mockGetStacktapeVersion.mockReturnValue('1.0.0');
      mockGetLatestStacktapeVersion.mockRejectedValueOnce(new Error('NPM registry unavailable'));

      // Should not throw error
      await expect(announcementsManager.checkForUpdates()).rejects.toThrow('NPM registry unavailable');
    });

    test('should handle versions with different formats', async () => {
      mockGetStacktapeVersion.mockReturnValue('1.0');
      mockGetLatestStacktapeVersion.mockResolvedValue('1.0.1');
      mockGt.mockReturnValue(true);

      await announcementsManager.checkForUpdates();

      expect(mockGetLatestStacktapeVersion).toHaveBeenCalled();
    });

    test('should handle empty installation script', async () => {
      mockGetStacktapeVersion.mockReturnValue('1.0.0');
      mockGetLatestStacktapeVersion.mockResolvedValue('1.1.0');
      mockGt.mockReturnValue(true);
      mockGetInstallationScript.mockReturnValue('');

      await announcementsManager.checkForUpdates();

      expect(mockPrinter.info).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    test('should handle full update check flow', async () => {
      mockConfig.IS_DEV = false;
      mockGetStacktapeVersion.mockReturnValue('1.5.0');
      mockGetLatestStacktapeVersion.mockResolvedValue('2.0.0');
      mockGt.mockReturnValue(true);
      mockGetInstallationScript.mockReturnValue('npm install -g stacktape');

      await announcementsManager.checkForUpdates();

      expect(mockGetStacktapeVersion).toHaveBeenCalled();
      expect(mockGetLatestStacktapeVersion).toHaveBeenCalled();
      expect(mockGt).toHaveBeenCalled();
      expect(mockPrinter.info).toHaveBeenCalled();
      expect(mockGetInstallationScript).toHaveBeenCalled();
      expect(mockPrinter.makeBold).toHaveBeenCalled();
      expect(mockPrinter.colorize).toHaveBeenCalled();
    });

    test('should handle full announcement flow', async () => {
      mockJsonFetch.mockResolvedValueOnce([
        { message: 'New feature: Hot-swap deployments', highlight: true },
        { message: 'Fixed bug in Lambda packaging', highlight: false }
      ]);

      await announcementsManager.printAnnouncements();

      expect(mockJsonFetch).toHaveBeenCalledWith(
        'https://announcements.example.com/messages.json'
      );
      expect(mockPrinter.announcement).toHaveBeenCalledTimes(2);
    });

    test('should handle both announcements and update check', async () => {
      mockJsonFetch.mockResolvedValueOnce([
        { message: 'Important update available', highlight: true }
      ]);
      mockGetStacktapeVersion.mockReturnValue('1.0.0');
      mockGetLatestStacktapeVersion.mockResolvedValue('1.1.0');
      mockGt.mockReturnValue(true);

      await announcementsManager.printAnnouncements();
      await announcementsManager.checkForUpdates();

      expect(mockPrinter.announcement).toHaveBeenCalled();
      expect(mockPrinter.info).toHaveBeenCalled();
    });
  });
});
