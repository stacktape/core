import { beforeEach, describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/aws/sdk-manager', () => ({
  AwsSdkManager: mock(
    class {
      getS3Client = mock();
      uploadToBucket = mock();
      getCloudFormationClient = mock();
      deployStack = mock();
      deleteStack = mock();
      describeStacks = mock();
      listStackResources = mock();
    }
  )
}));

describe('aws-sdk-manager', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('should export awsSdkManager instance', async () => {
    const { awsSdkManager } = await import('./index');

    expect(awsSdkManager).toBeDefined();
  });

  test('should be instance of AwsSdkManager', async () => {
    const { awsSdkManager } = await import('./index');
    const { AwsSdkManager } = await import('@shared/aws/sdk-manager');

    expect(awsSdkManager instanceof AwsSdkManager).toBe(true);
  });

  test('should have SDK methods', async () => {
    const { awsSdkManager } = await import('./index');

    expect(typeof awsSdkManager.getS3Client).toBe('function');
    expect(typeof awsSdkManager.uploadToBucket).toBe('function');
    expect(typeof awsSdkManager.getCloudFormationClient).toBe('function');
  });
});
