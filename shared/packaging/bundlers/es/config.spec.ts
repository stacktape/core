import { describe, expect, test } from 'bun:test';
import {
  DEPENDENCIES_TO_EXCLUDE_FROM_BUNDLE,
  DEPENDENCIES_WITH_BINARIES,
  FILES_TO_INCLUDE_IN_DIGEST,
  IGNORED_EXTENSIONS,
  IGNORED_FILES,
  IGNORED_FOLDERS,
  IGNORED_MISSING_DEPENDENCIES,
  IGNORED_MODULES,
  IGNORED_OPTIONAL_PEER_DEPS_FROM_INSTALL_IN_DOCKER,
  SPECIAL_TREATMENT_PACKAGES
} from './config';

describe('bundlers/es/config', () => {
  describe('FILES_TO_INCLUDE_IN_DIGEST', () => {
    test('should export files to include in digest', () => {
      expect(Array.isArray(FILES_TO_INCLUDE_IN_DIGEST)).toBe(true);
      expect(FILES_TO_INCLUDE_IN_DIGEST.length).toBeGreaterThan(0);
    });

    test('should include lock files', () => {
      expect(FILES_TO_INCLUDE_IN_DIGEST).toContain('pnpm-lock.yaml');
      expect(FILES_TO_INCLUDE_IN_DIGEST).toContain('yarn.lock');
      expect(FILES_TO_INCLUDE_IN_DIGEST).toContain('package-lock.json');
    });

    test('should include tsconfig.json', () => {
      expect(FILES_TO_INCLUDE_IN_DIGEST).toContain('tsconfig.json');
    });
  });

  describe('IGNORED_MISSING_DEPENDENCIES', () => {
    test('should export ignored missing dependencies', () => {
      expect(Array.isArray(IGNORED_MISSING_DEPENDENCIES)).toBe(true);
    });

    test('should include .prisma', () => {
      expect(IGNORED_MISSING_DEPENDENCIES).toContain('.prisma');
    });
  });

  describe('SPECIAL_TREATMENT_PACKAGES', () => {
    test('should export special treatment packages', () => {
      expect(Array.isArray(SPECIAL_TREATMENT_PACKAGES)).toBe(true);
    });

    test('should include @prisma/client', () => {
      expect(SPECIAL_TREATMENT_PACKAGES).toContain('@prisma/client');
    });

    test('should include chrome-aws-lambda', () => {
      expect(SPECIAL_TREATMENT_PACKAGES).toContain('chrome-aws-lambda');
    });

    test('should include next', () => {
      expect(SPECIAL_TREATMENT_PACKAGES).toContain('next');
    });
  });

  describe('DEPENDENCIES_TO_EXCLUDE_FROM_BUNDLE', () => {
    test('should export dependencies to exclude', () => {
      expect(Array.isArray(DEPENDENCIES_TO_EXCLUDE_FROM_BUNDLE)).toBe(true);
    });

    test('should include next', () => {
      expect(DEPENDENCIES_TO_EXCLUDE_FROM_BUNDLE).toContain('next');
    });
  });

  describe('IGNORED_OPTIONAL_PEER_DEPS_FROM_INSTALL_IN_DOCKER', () => {
    test('should export ignored optional peer deps', () => {
      expect(Array.isArray(IGNORED_OPTIONAL_PEER_DEPS_FROM_INSTALL_IN_DOCKER)).toBe(true);
    });

    test('should include supports-color', () => {
      expect(IGNORED_OPTIONAL_PEER_DEPS_FROM_INSTALL_IN_DOCKER).toContain('supports-color');
    });

    test('should include debug', () => {
      expect(IGNORED_OPTIONAL_PEER_DEPS_FROM_INSTALL_IN_DOCKER).toContain('debug');
    });
  });

  describe('DEPENDENCIES_WITH_BINARIES', () => {
    test('should export dependencies with binaries', () => {
      expect(Array.isArray(DEPENDENCIES_WITH_BINARIES)).toBe(true);
      expect(DEPENDENCIES_WITH_BINARIES.length).toBeGreaterThan(0);
    });

    test('should include common binary dependencies', () => {
      expect(DEPENDENCIES_WITH_BINARIES).toContain('pg-native');
      expect(DEPENDENCIES_WITH_BINARIES).toContain('chrome-aws-lambda');
      expect(DEPENDENCIES_WITH_BINARIES).toContain('puppeteer');
      expect(DEPENDENCIES_WITH_BINARIES).toContain('sqlite3');
      expect(DEPENDENCIES_WITH_BINARIES).toContain('bcrypt');
    });

    test('should include canvas', () => {
      expect(DEPENDENCIES_WITH_BINARIES).toContain('canvas');
    });
  });

  describe('IGNORED_MODULES', () => {
    test('should export ignored modules', () => {
      expect(Array.isArray(IGNORED_MODULES)).toBe(true);
    });

    test('should include prisma modules', () => {
      expect(IGNORED_MODULES).toContain('@prisma/cli');
      expect(IGNORED_MODULES).toContain('@prisma/engines');
    });

    test('should include fsevents', () => {
      expect(IGNORED_MODULES).toContain('fsevents');
    });
  });

  describe('IGNORED_EXTENSIONS', () => {
    test('should export ignored extensions', () => {
      expect(Array.isArray(IGNORED_EXTENSIONS)).toBe(true);
      expect(IGNORED_EXTENSIONS.length).toBeGreaterThan(0);
    });

    test('should include source file extensions', () => {
      expect(IGNORED_EXTENSIONS).toContain('ts');
      expect(IGNORED_EXTENSIONS).toContain('tsx');
      expect(IGNORED_EXTENSIONS).toContain('jsx');
    });

    test('should include documentation extensions', () => {
      expect(IGNORED_EXTENSIONS).toContain('md');
      expect(IGNORED_EXTENSIONS).toContain('markdown');
    });

    test('should include test file extensions', () => {
      expect(IGNORED_EXTENSIONS).toContain('test.js');
      expect(IGNORED_EXTENSIONS).toContain('spec.js');
      expect(IGNORED_EXTENSIONS).toContain('e2e.js');
    });
  });

  describe('IGNORED_FILES', () => {
    test('should export ignored files list', () => {
      expect(Array.isArray(IGNORED_FILES)).toBe(true);
      expect(IGNORED_FILES.length).toBeGreaterThan(0);
    });

    test('should include config files', () => {
      expect(IGNORED_FILES).toContain('tsconfig.json');
      expect(IGNORED_FILES).toContain('babel.config.js');
      expect(IGNORED_FILES).toContain('prettier.config.js');
    });

    test('should include build files', () => {
      expect(IGNORED_FILES).toContain('makefile');
      expect(IGNORED_FILES).toContain('gulpfile.js');
      expect(IGNORED_FILES).toContain('gruntfile.js');
    });

    test('should include CI/CD files', () => {
      expect(IGNORED_FILES).toContain('.travis.yml');
      expect(IGNORED_FILES).toContain('circle.yml');
    });
  });

  describe('IGNORED_FOLDERS', () => {
    test('should export ignored folders list', () => {
      expect(Array.isArray(IGNORED_FOLDERS)).toBe(true);
      expect(IGNORED_FOLDERS.length).toBeGreaterThan(0);
    });

    test('should include test folders', () => {
      expect(IGNORED_FOLDERS).toContain('__tests__');
      expect(IGNORED_FOLDERS).toContain('test');
      expect(IGNORED_FOLDERS).toContain('tests');
    });

    test('should include documentation folders', () => {
      expect(IGNORED_FOLDERS).toContain('docs');
      expect(IGNORED_FOLDERS).toContain('doc');
      expect(IGNORED_FOLDERS).toContain('website');
    });

    test('should include coverage folder', () => {
      expect(IGNORED_FOLDERS).toContain('coverage');
      expect(IGNORED_FOLDERS).toContain('.nyc_output');
    });
  });
});
