import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mock(async () => {}),
    finishEvent: mock(async () => {}),
    updateEvent: mock(async () => {})
  }
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: {
      resourceName: 'myBucket',
      bucketId: undefined,
      sourcePath: undefined,
      invalidateCdnCache: false
    }
  }
}));

mock.module('@domain-services/cloudformation-stack-manager', () => ({
  stackManager: {
    existingStackResources: [
      {
        LogicalResourceId: 'MyBucketS3Bucket',
        PhysicalResourceId: 'my-bucket-physical-id'
      }
    ]
  }
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: {
    allBuckets: [
      {
        name: 'myBucket',
        directoryUpload: {
          directoryPath: 'dist',
          headersPreset: 'spa',
          excludeFilesPatterns: ['*.map'],
          fileOptions: {},
          disableS3TransferAcceleration: false
        }
      }
    ],
    isS3TransferAccelerationAvailableInDeploymentRegion: true
  }
}));

mock.module('@domain-services/deployed-stack-overview-manager', () => ({
  deployedStackOverviewManager: {
    getStpResource: mock(() => ({
      resourceType: 'bucket'
    })),
    printResourceInfo: mock(() => {})
  }
}));

mock.module('@domain-services/notification-manager', () => ({
  notificationManager: {
    sendDeploymentNotification: mock(async () => {})
  }
}));

mock.module('@errors', () => ({
  stpErrors: {
    e12: mock(() => new Error('Invalid bucket sync arguments')),
    e13: mock(({ directoryPath }) => new Error(`Directory "${directoryPath}" not accessible`)),
    e77: mock(({ resourceName }) => new Error(`Resource "${resourceName}" not found`))
  }
}));

mock.module('@shared/utils/fs-utils', () => ({
  getRelativePath: mock((path) => path.replace('/home/user/project/', '')),
  transformToUnixPath: mock((path) => path),
  isDirAccessible: mock(() => true)
}));

mock.module('@shared/utils/stack-info-map', () => ({
  getCloudformationChildResources: mock(() => ({
    MyBucketS3Bucket: {
      cloudformationResourceType: 'AWS::S3::Bucket'
    }
  }))
}));

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    syncDirectoryIntoBucket: mock(async () => ({
      deleteAmount: 5,
      filesFound: 100
    })),
    getCloudfrontDistributionForBucketName: mock(async () => []),
    invalidateCloudfrontDistributionCache: mock(async () => {})
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    info: mock(() => {})
  }
}));

mock.module('../_utils/initialization', () => ({
  initializeStackServicesForWorkingWithDeployedStack: mock(async () => {}),
  loadUserCredentials: mock(async () => {})
}));

describe('bucket-sync command', () => {
  test('should sync bucket using resource name', async () => {
    const { initializeStackServicesForWorkingWithDeployedStack } = await import('../_utils/initialization');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { eventManager } = await import('@application-services/event-manager');

    const { commandBucketSync } = await import('./index');
    await commandBucketSync();

    expect(initializeStackServicesForWorkingWithDeployedStack).toHaveBeenCalledWith({
      commandModifiesStack: false,
      commandRequiresConfig: true
    });
    expect(awsSdkManager.syncDirectoryIntoBucket).toHaveBeenCalled();
    expect(eventManager.startEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'SYNC_BUCKET' })
    );
    expect(eventManager.finishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'SYNC_BUCKET' })
    );
  });

  test('should sync bucket using bucket ID', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { loadUserCredentials } = await import('../_utils/initialization');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    globalStateManager.args = {
      bucketId: 'my-bucket-id',
      sourcePath: '/path/to/source'
    };

    const { commandBucketSync } = await import('./index');
    await commandBucketSync();

    expect(loadUserCredentials).toHaveBeenCalled();
    expect(awsSdkManager.syncDirectoryIntoBucket).toHaveBeenCalledWith(
      expect.objectContaining({
        bucketName: 'my-bucket-id'
      })
    );
  });

  test('should invalidate CDN cache when requested', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { eventManager } = await import('@application-services/event-manager');
    globalStateManager.args = {
      resourceName: 'myBucket',
      invalidateCdnCache: true
    };
    (awsSdkManager.getCloudfrontDistributionForBucketName as any).mockImplementation(async () => [
      { Id: 'dist-123' }
    ]);

    const { commandBucketSync } = await import('./index');
    await commandBucketSync();

    expect(awsSdkManager.getCloudfrontDistributionForBucketName).toHaveBeenCalled();
    expect(awsSdkManager.invalidateCloudfrontDistributionCache).toHaveBeenCalledWith({
      distributionId: 'dist-123',
      invalidatePaths: ['/*']
    });
    expect(eventManager.startEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'INVALIDATE_CACHE' })
    );
  });

  test('should throw error for invalid arguments', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args = {
      resourceName: 'myBucket',
      bucketId: 'my-bucket-id' // Can't use both
    };

    const { commandBucketSync } = await import('./index');

    await expect(commandBucketSync()).rejects.toThrow('Invalid bucket sync arguments');
  });

  test('should throw error when directory not accessible', async () => {
    const { isDirAccessible } = await import('@shared/utils/fs-utils');
    (isDirAccessible as any).mockImplementation(() => false);

    const { commandBucketSync } = await import('./index');

    await expect(commandBucketSync()).rejects.toThrow('not accessible');
  });

  test('should use headers preset from config', async () => {
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');

    const { commandBucketSync } = await import('./index');
    await commandBucketSync();

    expect(awsSdkManager.syncDirectoryIntoBucket).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadConfiguration: expect.objectContaining({
          headersPreset: 'spa'
        })
      })
    );
  });

  test('should use exclude patterns from config', async () => {
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');

    const { commandBucketSync } = await import('./index');
    await commandBucketSync();

    expect(awsSdkManager.syncDirectoryIntoBucket).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadConfiguration: expect.objectContaining({
          excludeFilesPatterns: ['*.map']
        })
      })
    );
  });

  test('should disable S3 transfer acceleration when configured', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    configManager.allBuckets[0].directoryUpload.disableS3TransferAcceleration = true;

    const { commandBucketSync } = await import('./index');
    await commandBucketSync();

    expect(awsSdkManager.syncDirectoryIntoBucket).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadConfiguration: expect.objectContaining({
          disableS3TransferAcceleration: true
        })
      })
    );
  });

  test('should report sync progress', async () => {
    const { eventManager } = await import('@application-services/event-manager');

    const { commandBucketSync } = await import('./index');
    await commandBucketSync();

    // The onProgress callback should update event progress
    const syncCall = (await import('@utils/aws-sdk-manager')).awsSdkManager.syncDirectoryIntoBucket as any;
    const onProgress = syncCall.mock.calls[0][0].onProgress;

    await onProgress({ progressPercent: 50 });

    expect(eventManager.updateEvent).toHaveBeenCalledWith({
      eventType: 'SYNC_BUCKET',
      additionalMessage: '50%'
    });
  });

  test('should send deployment notifications', async () => {
    const { notificationManager } = await import('@domain-services/notification-manager');

    const { commandBucketSync } = await import('./index');
    await commandBucketSync();

    expect(notificationManager.sendDeploymentNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ type: 'progress' })
      })
    );
    expect(notificationManager.sendDeploymentNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ type: 'success' })
      })
    );
  });

  test('should print resource info when using resource name', async () => {
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args = { resourceName: 'myBucket' };

    const { commandBucketSync } = await import('./index');
    await commandBucketSync();

    expect(deployedStackOverviewManager.printResourceInfo).toHaveBeenCalledWith(['myBucket']);
  });

  test('should not print resource info when using bucket ID', async () => {
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args = {
      bucketId: 'my-bucket-id',
      sourcePath: '/path/to/source'
    };

    (deployedStackOverviewManager.printResourceInfo as any).mock.calls = [];

    const { commandBucketSync } = await import('./index');
    await commandBucketSync();

    expect(deployedStackOverviewManager.printResourceInfo).not.toHaveBeenCalled();
  });

  test('should return null', async () => {
    const { commandBucketSync } = await import('./index');
    const result = await commandBucketSync();

    expect(result).toBe(null);
  });
});
