import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/event-manager', () => ({
  eventManager: {
    getNamespacedInstance: mock(() => ({
      startEvent: mock(async () => {}),
      finishEvent: mock(async () => {}),
      namespace: { identifier: 'test', eventType: 'BUILD' }
    }))
  }
}));

mock.module('@shared/naming/utils', () => ({
  getJobName: mock(() => 'test-function')
}));

mock.module('@shared/utils/constants', () => ({
  EDGE_LAMBDA_ENV_ASSET_REPLACER_PLACEHOLDER: '<<EDGE_ENV_PLACEHOLDER>>'
}));

mock.module('@shared/utils/exec', () => ({
  exec: mock(async () => ({ stdout: 'Build complete', stderr: '' }))
}));

mock.module('@shared/utils/fs-utils', () => ({
  dirExists: mock(() => true)
}));

mock.module('@shared/utils/misc', () => ({
  raiseError: mock((opts) => {
    throw new Error(opts.message);
  }),
  serialize: mock((obj) => ({ ...obj }))
}));

mock.module('@utils/file-loaders', () => ({
  loadFromJavascript: mock(async () => ({ default: { runtime: 'node' } })),
  loadFromTypescript: mock(async () => ({ default: { runtime: 'node' } }))
}));

mock.module('fs-extra', () => ({
  move: mock(async () => {}),
  outputFile: mock(async () => {}),
  readdir: mock(async () => []),
  remove: mock(async () => {}),
  writeFile: mock(async () => {})
}));

mock.module('./custom-artifact', () => ({
  buildUsingCustomArtifact: mock(async () => ({
    outcome: 'bundled',
    digest: 'test-digest',
    artifactPath: '/dist/artifact.zip',
    sourceFiles: [],
    size: 10,
    jobName: 'test'
  }))
}));

describe('nextjs-web', () => {
  describe('createNextjsWebArtifacts', () => {
    test('should build NextJS project', async () => {
      const { createNextjsWebArtifacts } = await import('./nextjs-web');
      const { exec } = await import('@shared/utils/exec');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {}),
        namespace: { identifier: 'nextjs', eventType: 'BUILD' }
      };

      const resource: any = {
        name: 'my-nextjs-app',
        appDirectory: './app',
        _nestedResources: {
          imageFunction: { name: 'image', handler: 'index.handler' },
          revalidationFunction: { name: 'revalidation', handler: 'index.handler' },
          revalidationInsertFunction: { name: 'insert', handler: 'index.handler' }
        }
      };

      await createNextjsWebArtifacts({
        resource,
        progressLogger: mockProgressLogger,
        existingDigests: {},
        distFolderPath: '/dist',
        cwd: '/project',
        environmentVars: []
      });

      expect(exec).toHaveBeenCalled();
    });

    test('should use OpenNext CLI', async () => {
      const { createNextjsWebArtifacts } = await import('./nextjs-web');
      const { exec } = await import('@shared/utils/exec');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {}),
        namespace: { identifier: 'nextjs', eventType: 'BUILD' }
      };

      const resource: any = {
        name: 'my-nextjs-app',
        _nestedResources: {
          imageFunction: { name: 'image', handler: 'index.handler' },
          revalidationFunction: { name: 'revalidation', handler: 'index.handler' },
          revalidationInsertFunction: { name: 'insert', handler: 'index.handler' }
        }
      };

      await createNextjsWebArtifacts({
        resource,
        progressLogger: mockProgressLogger,
        existingDigests: {},
        distFolderPath: '/dist',
        cwd: '/project',
        environmentVars: []
      });

      const callArgs = exec.mock.calls[0][1];
      expect(callArgs).toContain('@opennextjs/aws@^3.6.2');
      expect(callArgs).toContain('build');
    });

    test('should move assets to bucket-content', async () => {
      const { createNextjsWebArtifacts } = await import('./nextjs-web');
      const { move } = await import('fs-extra');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {}),
        namespace: { identifier: 'nextjs', eventType: 'BUILD' }
      };

      const resource: any = {
        name: 'my-nextjs-app',
        _nestedResources: {
          imageFunction: { name: 'image', handler: 'index.handler' },
          revalidationFunction: { name: 'revalidation', handler: 'index.handler' },
          revalidationInsertFunction: { name: 'insert', handler: 'index.handler' }
        }
      };

      await createNextjsWebArtifacts({
        resource,
        progressLogger: mockProgressLogger,
        existingDigests: {},
        distFolderPath: '/dist',
        cwd: '/project',
        environmentVars: []
      });

      expect(move).toHaveBeenCalled();
    });

    test('should create server wrapper for edge lambda', async () => {
      const { createNextjsWebArtifacts } = await import('./nextjs-web');
      const { writeFile } = await import('fs-extra');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {}),
        namespace: { identifier: 'nextjs', eventType: 'BUILD' }
      };

      const resource: any = {
        name: 'my-nextjs-app',
        useEdgeLambda: true,
        _nestedResources: {
          imageFunction: { name: 'image', handler: 'index.handler' },
          revalidationFunction: { name: 'revalidation', handler: 'index.handler' },
          revalidationInsertFunction: { name: 'insert', handler: 'index.handler' },
          serverEdgeFunction: { name: 'server-edge', handler: 'index-wrap.handler' }
        }
      };

      await createNextjsWebArtifacts({
        resource,
        progressLogger: mockProgressLogger,
        existingDigests: {},
        distFolderPath: '/dist',
        cwd: '/project',
        environmentVars: []
      });

      expect(writeFile).toHaveBeenCalled();
    });

    test('should build all function artifacts', async () => {
      const { createNextjsWebArtifacts } = await import('./nextjs-web');
      const { buildUsingCustomArtifact } = await import('./custom-artifact');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {}),
        namespace: { identifier: 'nextjs', eventType: 'BUILD' }
      };

      const resource: any = {
        name: 'my-nextjs-app',
        _nestedResources: {
          imageFunction: { name: 'image', handler: 'index.handler' },
          revalidationFunction: { name: 'revalidation', handler: 'index.handler' },
          revalidationInsertFunction: { name: 'insert', handler: 'index.handler' }
        }
      };

      const result = await createNextjsWebArtifacts({
        resource,
        progressLogger: mockProgressLogger,
        existingDigests: {},
        distFolderPath: '/dist',
        cwd: '/project',
        environmentVars: []
      });

      expect(buildUsingCustomArtifact).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);
    });

    test('should pass environment variables to build', async () => {
      const { createNextjsWebArtifacts } = await import('./nextjs-web');
      const { exec } = await import('@shared/utils/exec');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {}),
        namespace: { identifier: 'nextjs', eventType: 'BUILD' }
      };

      const resource: any = {
        name: 'my-nextjs-app',
        _nestedResources: {
          imageFunction: { name: 'image', handler: 'index.handler' },
          revalidationFunction: { name: 'revalidation', handler: 'index.handler' },
          revalidationInsertFunction: { name: 'insert', handler: 'index.handler' }
        }
      };

      await createNextjsWebArtifacts({
        resource,
        progressLogger: mockProgressLogger,
        existingDigests: {},
        distFolderPath: '/dist',
        cwd: '/project',
        environmentVars: [{ name: 'API_URL', value: 'https://api.example.com' }]
      });

      const callArgs = exec.mock.calls[0][2];
      expect(callArgs.env.API_URL).toBe('https://api.example.com');
    });
  });
});
