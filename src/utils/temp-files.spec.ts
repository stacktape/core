import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    invocationId: 'test-invocation-123'
  }
}));

mock.module('@shared/naming/fs-paths', () => ({
  fsPaths: {
    absoluteTempFolderPath: mock(({ invocationId }) => `/tmp/.stacktape-${invocationId}`),
    absoluteBuildFolderPath: mock(({ invocationId }) => `/tmp/.stacktape-${invocationId}/build`),
    absoluteInitialCfTemplateFilePath: mock(({ invocationId }) => `/tmp/.stacktape-${invocationId}/initial-template.json`),
    absoluteCfTemplateFilePath: mock(({ invocationId }) => `/tmp/.stacktape-${invocationId}/cf-template.json`),
    absoluteStpTemplateFilePath: mock(({ invocationId }) => `/tmp/.stacktape-${invocationId}/stp-template.json`)
  }
}));

mock.module('fs-extra', () => ({
  default: {
    remove: mock(async () => {}),
    ensureDir: mock(async () => {}),
    outputFile: mock(async () => {})
  }
}));

describe('temp-files', () => {
  describe('deleteTempFolder', () => {
    test('should delete temp folder', async () => {
      const fsExtra = await import('fs-extra');
      const { deleteTempFolder } = await import('./temp-files');

      await deleteTempFolder();

      expect(fsExtra.default.remove).toHaveBeenCalledWith('/tmp/.stacktape-test-invocation-123');
    });

    test('should use correct invocation ID', async () => {
      const { fsPaths } = await import('@shared/naming/fs-paths');
      const { deleteTempFolder } = await import('./temp-files');

      await deleteTempFolder();

      expect(fsPaths.absoluteTempFolderPath).toHaveBeenCalledWith({ invocationId: 'test-invocation-123' });
    });
  });

  describe('ensureTempFolder', () => {
    test('should ensure temp folder exists', async () => {
      const fsExtra = await import('fs-extra');
      const { ensureTempFolder } = await import('./temp-files');

      await ensureTempFolder();

      expect(fsExtra.default.ensureDir).toHaveBeenCalledWith('/tmp/.stacktape-test-invocation-123');
    });

    test('should use correct invocation ID', async () => {
      const { fsPaths } = await import('@shared/naming/fs-paths');
      const { ensureTempFolder } = await import('./temp-files');

      await ensureTempFolder();

      expect(fsPaths.absoluteTempFolderPath).toHaveBeenCalledWith({ invocationId: 'test-invocation-123' });
    });
  });

  describe('deleteBuildFolder', () => {
    test('should delete build folder', async () => {
      const fsExtra = await import('fs-extra');
      const { deleteBuildFolder } = await import('./temp-files');

      await deleteBuildFolder();

      expect(fsExtra.default.remove).toHaveBeenCalledWith('/tmp/.stacktape-test-invocation-123/build');
    });

    test('should use correct invocation ID', async () => {
      const { fsPaths } = await import('@shared/naming/fs-paths');
      const { deleteBuildFolder } = await import('./temp-files');

      await deleteBuildFolder();

      expect(fsPaths.absoluteBuildFolderPath).toHaveBeenCalledWith({ invocationId: 'test-invocation-123' });
    });
  });

  describe('saveToInitialCfTemplateFile', () => {
    test('should save initial CloudFormation template', async () => {
      const fsExtra = await import('fs-extra');
      const { saveToInitialCfTemplateFile } = await import('./temp-files');

      const template = { Resources: {}, Outputs: {} };
      await saveToInitialCfTemplateFile(template);

      expect(fsExtra.default.outputFile).toHaveBeenCalledWith(
        '/tmp/.stacktape-test-invocation-123/initial-template.json',
        template
      );
    });

    test('should handle JSON content', async () => {
      const fsExtra = await import('fs-extra');
      const { saveToInitialCfTemplateFile } = await import('./temp-files');

      const content = JSON.stringify({ test: 'data' });
      await saveToInitialCfTemplateFile(content);

      expect(fsExtra.default.outputFile).toHaveBeenCalledWith(
        '/tmp/.stacktape-test-invocation-123/initial-template.json',
        content
      );
    });
  });

  describe('saveToCfTemplateFile', () => {
    test('should save CloudFormation template', async () => {
      const fsExtra = await import('fs-extra');
      const { saveToCfTemplateFile } = await import('./temp-files');

      const template = { Resources: { MyBucket: { Type: 'AWS::S3::Bucket' } } };
      await saveToCfTemplateFile(template);

      expect(fsExtra.default.outputFile).toHaveBeenCalledWith(
        '/tmp/.stacktape-test-invocation-123/cf-template.json',
        template
      );
    });

    test('should handle string content', async () => {
      const fsExtra = await import('fs-extra');
      const { saveToCfTemplateFile } = await import('./temp-files');

      const content = 'template content';
      await saveToCfTemplateFile(content);

      expect(fsExtra.default.outputFile).toHaveBeenCalledWith(
        '/tmp/.stacktape-test-invocation-123/cf-template.json',
        content
      );
    });
  });

  describe('saveToStpTemplateFile', () => {
    test('should save Stacktape template', async () => {
      const fsExtra = await import('fs-extra');
      const { saveToStpTemplateFile } = await import('./temp-files');

      const template = { serviceName: 'my-service', resources: {} };
      await saveToStpTemplateFile(template);

      expect(fsExtra.default.outputFile).toHaveBeenCalledWith(
        '/tmp/.stacktape-test-invocation-123/stp-template.json',
        template
      );
    });

    test('should handle any content type', async () => {
      const fsExtra = await import('fs-extra');
      const { saveToStpTemplateFile } = await import('./temp-files');

      const content = { any: 'object', with: ['array', 'values'] };
      await saveToStpTemplateFile(content);

      expect(fsExtra.default.outputFile).toHaveBeenCalledWith(
        '/tmp/.stacktape-test-invocation-123/stp-template.json',
        content
      );
    });
  });

  describe('integration', () => {
    test('should handle multiple operations in sequence', async () => {
      const { ensureTempFolder, saveToCfTemplateFile, deleteTempFolder } = await import('./temp-files');

      await ensureTempFolder();
      await saveToCfTemplateFile({ test: 'template' });
      await deleteTempFolder();

      expect(true).toBe(true);
    });

    test('should use consistent invocation ID across operations', async () => {
      const { fsPaths } = await import('@shared/naming/fs-paths');
      const { ensureTempFolder, deleteBuildFolder, saveToCfTemplateFile } = await import('./temp-files');

      await ensureTempFolder();
      await deleteBuildFolder();
      await saveToCfTemplateFile({});

      const calls = fsPaths.absoluteTempFolderPath.mock.calls;
      calls.forEach((call) => {
        expect(call[0].invocationId).toBe('test-invocation-123');
      });
    });
  });
});
