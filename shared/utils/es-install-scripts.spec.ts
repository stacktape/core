import { describe, expect, test } from 'bun:test';
import { getEsInstallScript } from './es-install-scripts';

describe('es-install-scripts', () => {
  describe('getEsInstallScript', () => {
    test('should return npm CI install script', () => {
      const script = getEsInstallScript('npm', 'CI');
      expect(script).toEqual(['npm', 'ci']);
    });

    test('should return npm normal install script', () => {
      const script = getEsInstallScript('npm', 'normal');
      expect(script).toEqual(['npm', 'install']);
    });

    test('should return yarn CI install script', () => {
      const script = getEsInstallScript('yarn', 'CI');
      expect(script).toEqual(['yarn', 'install', '--frozen-lockfile', '--ignore-platform', '--ignore-engines']);
    });

    test('should return yarn normal install script', () => {
      const script = getEsInstallScript('yarn', 'normal');
      expect(script).toEqual(['yarn', 'install']);
    });

    test('should return pnpm CI install script', () => {
      const script = getEsInstallScript('pnpm', 'CI');
      expect(script).toEqual(['pnpm', 'install', '--frozen-lockfile']);
    });

    test('should return pnpm normal install script', () => {
      const script = getEsInstallScript('pnpm', 'normal');
      expect(script).toEqual(['pnpm', 'install']);
    });

    test('should return bun CI install script', () => {
      const script = getEsInstallScript('bun', 'CI');
      expect(script).toEqual(['bun', 'install', '--frozen-lockfile']);
    });

    test('should return bun normal install script', () => {
      const script = getEsInstallScript('bun', 'normal');
      expect(script).toEqual(['bun', 'install']);
    });

    test('should return deno CI install script', () => {
      const script = getEsInstallScript('deno', 'CI');
      expect(script).toEqual(['deno', 'install', '--frozen']);
    });

    test('should return deno normal install script', () => {
      const script = getEsInstallScript('deno', 'normal');
      expect(script).toEqual(['deno', 'install']);
    });
  });
});
