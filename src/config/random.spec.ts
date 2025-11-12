import { describe, expect, test } from 'bun:test';

describe('config/random', () => {
  describe('development mode flags', () => {
    test('should export IS_DEV_NATIVE', async () => {
      const { IS_DEV_NATIVE } = await import('./random');

      expect(typeof IS_DEV_NATIVE).toBe('boolean');
    });

    test('should export IS_DEV_BIN', async () => {
      const { IS_DEV_BIN } = await import('./random');

      expect(typeof IS_DEV_BIN).toBe('boolean');
    });

    test('should export IS_DEV', async () => {
      const { IS_DEV } = await import('./random');

      expect(typeof IS_DEV).toBe('boolean');
    });

    test('IS_DEV should be true if either IS_DEV_NATIVE or IS_DEV_BIN is true', async () => {
      const { IS_DEV, IS_DEV_NATIVE, IS_DEV_BIN } = await import('./random');

      if (IS_DEV_NATIVE || IS_DEV_BIN) {
        expect(IS_DEV).toBe(true);
      }
    });
  });

  describe('valid config paths', () => {
    test('should export VALID_CONFIG_PATHS array', async () => {
      const { VALID_CONFIG_PATHS } = await import('./random');

      expect(Array.isArray(VALID_CONFIG_PATHS)).toBe(true);
      expect(VALID_CONFIG_PATHS.length).toBeGreaterThan(0);
    });

    test('should include YAML config paths', async () => {
      const { VALID_CONFIG_PATHS } = await import('./random');

      expect(VALID_CONFIG_PATHS).toContain('stacktape.yaml');
      expect(VALID_CONFIG_PATHS).toContain('stacktape.yml');
    });

    test('should include TypeScript and JavaScript paths', async () => {
      const { VALID_CONFIG_PATHS } = await import('./random');

      expect(VALID_CONFIG_PATHS).toContain('stacktape.ts');
      expect(VALID_CONFIG_PATHS).toContain('stacktape.js');
    });

    test('all paths should start with stacktape', async () => {
      const { VALID_CONFIG_PATHS } = await import('./random');

      VALID_CONFIG_PATHS.forEach((path) => {
        expect(path.startsWith('stacktape.')).toBe(true);
      });
    });
  });

  describe('endpoint configurations', () => {
    test('should export ANNOUNCEMENTS_ENDPOINT', async () => {
      const { ANNOUNCEMENTS_ENDPOINT } = await import('./random');

      expect(typeof ANNOUNCEMENTS_ENDPOINT).toBe('string');
      expect(ANNOUNCEMENTS_ENDPOINT).toMatch(/^https:\/\//);
    });

    test('should export SENTRY_DSN', async () => {
      const { SENTRY_DSN } = await import('./random');

      expect(typeof SENTRY_DSN).toBe('string');
      expect(SENTRY_DSN).toContain('sentry.io');
    });

    test('should export STACKTAPE_TRPC_API_ENDPOINT', async () => {
      const { STACKTAPE_TRPC_API_ENDPOINT } = await import('./random');

      expect(typeof STACKTAPE_TRPC_API_ENDPOINT).toBe('string');
      expect(STACKTAPE_TRPC_API_ENDPOINT).toMatch(/^https:\/\//);
      expect(STACKTAPE_TRPC_API_ENDPOINT).toContain('stacktape.com');
    });
  });

  describe('bucket names', () => {
    test('should export SCHEMAS_BUCKET_NAME', async () => {
      const { SCHEMAS_BUCKET_NAME } = await import('./random');

      expect(typeof SCHEMAS_BUCKET_NAME).toBe('string');
      expect(SCHEMAS_BUCKET_NAME.length).toBeGreaterThan(0);
    });

    test('should export INSTALL_SCRIPTS_BUCKET_NAME', async () => {
      const { INSTALL_SCRIPTS_BUCKET_NAME } = await import('./random');

      expect(typeof INSTALL_SCRIPTS_BUCKET_NAME).toBe('string');
      expect(INSTALL_SCRIPTS_BUCKET_NAME.length).toBeGreaterThan(0);
    });

    test('should export INSTALL_SCRIPTS_PREVIEW_BUCKET_NAME', async () => {
      const { INSTALL_SCRIPTS_PREVIEW_BUCKET_NAME } = await import('./random');

      expect(typeof INSTALL_SCRIPTS_PREVIEW_BUCKET_NAME).toBe('string');
      expect(INSTALL_SCRIPTS_PREVIEW_BUCKET_NAME.length).toBeGreaterThan(0);
    });
  });

  describe('tokens and constants', () => {
    test('should export MIXPANEL_TOKEN', async () => {
      const { MIXPANEL_TOKEN } = await import('./random');

      expect(typeof MIXPANEL_TOKEN).toBe('string');
      expect(MIXPANEL_TOKEN.length).toBeGreaterThan(0);
    });

    test('should export DEFAULT_STARTER_PROJECT_TARGET_DIRECTORY', async () => {
      const { DEFAULT_STARTER_PROJECT_TARGET_DIRECTORY } = await import('./random');

      expect(typeof DEFAULT_STARTER_PROJECT_TARGET_DIRECTORY).toBe('string');
      expect(DEFAULT_STARTER_PROJECT_TARGET_DIRECTORY.length).toBeGreaterThan(0);
    });

    test('should export IS_TELEMETRY_DISABLED', async () => {
      const { IS_TELEMETRY_DISABLED } = await import('./random');

      expect(typeof IS_TELEMETRY_DISABLED).toBe('boolean');
    });
  });

  describe('language extensions', () => {
    test('should export possiblySupportedLangExtensions', async () => {
      const { possiblySupportedLangExtensions } = await import('./random');

      expect(Array.isArray(possiblySupportedLangExtensions)).toBe(true);
      expect(possiblySupportedLangExtensions.length).toBeGreaterThan(0);
    });

    test('should include common programming language extensions', async () => {
      const { possiblySupportedLangExtensions } = await import('./random');

      expect(possiblySupportedLangExtensions).toContain('js');
      expect(possiblySupportedLangExtensions).toContain('ts');
      expect(possiblySupportedLangExtensions).toContain('py');
    });

    test('should include modern JavaScript extensions', async () => {
      const { possiblySupportedLangExtensions } = await import('./random');

      expect(possiblySupportedLangExtensions).toContain('jsx');
      expect(possiblySupportedLangExtensions).toContain('tsx');
      expect(possiblySupportedLangExtensions).toContain('mjs');
      expect(possiblySupportedLangExtensions).toContain('mts');
    });
  });

  describe('lambda runtimes mapping', () => {
    test('should export lambdaRuntimesForFileExtension', async () => {
      const { lambdaRuntimesForFileExtension } = await import('./random');

      expect(typeof lambdaRuntimesForFileExtension).toBe('object');
      expect(Object.keys(lambdaRuntimesForFileExtension).length).toBeGreaterThan(0);
    });

    test('should have Node.js runtimes for JavaScript extensions', async () => {
      const { lambdaRuntimesForFileExtension } = await import('./random');

      expect(Array.isArray(lambdaRuntimesForFileExtension.js)).toBe(true);
      expect(lambdaRuntimesForFileExtension.js.some((rt) => rt.startsWith('nodejs'))).toBe(true);
    });

    test('should have Node.js runtimes for TypeScript extensions', async () => {
      const { lambdaRuntimesForFileExtension } = await import('./random');

      expect(Array.isArray(lambdaRuntimesForFileExtension.ts)).toBe(true);
      expect(lambdaRuntimesForFileExtension.ts.some((rt) => rt.startsWith('nodejs'))).toBe(true);
    });

    test('should have Python runtimes for Python extension', async () => {
      const { lambdaRuntimesForFileExtension } = await import('./random');

      expect(Array.isArray(lambdaRuntimesForFileExtension.py)).toBe(true);
      expect(lambdaRuntimesForFileExtension.py.some((rt) => rt.startsWith('python'))).toBe(true);
    });

    test('all runtime arrays should contain valid runtime strings', async () => {
      const { lambdaRuntimesForFileExtension } = await import('./random');

      Object.values(lambdaRuntimesForFileExtension).forEach((runtimes: string[]) => {
        expect(Array.isArray(runtimes)).toBe(true);
        runtimes.forEach((runtime) => {
          expect(typeof runtime).toBe('string');
          expect(runtime.length).toBeGreaterThan(0);
        });
      });
    });

    test('should map all supported extensions to runtimes', async () => {
      const { lambdaRuntimesForFileExtension, possiblySupportedLangExtensions } = await import('./random');

      possiblySupportedLangExtensions.forEach((ext) => {
        expect(lambdaRuntimesForFileExtension[ext]).toBeDefined();
      });
    });
  });
});
