import { describe, expect, mock, test } from 'bun:test';

// Mock logical names
mock.module('@shared/naming/logical-names', () => ({
  cfLogicalNames: {
    workloadSecurityGroup: mock((name) => `${name}SecurityGroup`)
  }
}));

// Mock config manager
mock.module('..', () => ({
  configManager: {
    allLambdasToUpload: [],
    allContainerWorkloads: []
  }
}));

// Mock resource references
mock.module('./resource-references', () => ({
  getPropsOfResourceReferencedInConfig: mock(({ stpResourceReference, stpResourceType }) => ({
    name: stpResourceReference,
    type: stpResourceType
  }))
}));

describe('config-manager/utils/efs-filesystems', () => {
  describe('resolveReferenceToEfsFilesystem', () => {
    test('should call getPropsOfResourceReferencedInConfig with correct resource type', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToEfsFilesystem } = await import('./efs-filesystems');

      resolveReferenceToEfsFilesystem({
        stpResourceReference: 'myEfs',
        referencedFrom: 'myLambda'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'myEfs',
        stpResourceType: 'efs-filesystem',
        referencedFrom: 'myLambda',
        referencedFromType: undefined
      });
    });

    test('should pass referencedFromType to getPropsOfResourceReferencedInConfig', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToEfsFilesystem } = await import('./efs-filesystems');

      resolveReferenceToEfsFilesystem({
        stpResourceReference: 'efs1',
        referencedFrom: 'myResource',
        referencedFromType: 'lambda-function'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'efs1',
        stpResourceType: 'efs-filesystem',
        referencedFrom: 'myResource',
        referencedFromType: 'lambda-function'
      });
    });

    test('should return result from getPropsOfResourceReferencedInConfig', async () => {
      const { resolveReferenceToEfsFilesystem } = await import('./efs-filesystems');

      const result = resolveReferenceToEfsFilesystem({
        stpResourceReference: 'myEfs',
        referencedFrom: 'myResource'
      });

      expect(result.name).toBe('myEfs');
      expect(result.type).toBe('efs-filesystem');
    });
  });

  describe('resolveReferencesToMountedEfsFilesystems', () => {
    test('should return empty array when lambda has no volume mounts', async () => {
      const { resolveReferencesToMountedEfsFilesystems } = await import('./efs-filesystems');

      const resource: any = {
        type: 'function',
        volumeMounts: [],
        nameChain: ['myLambda'],
        configParentResourceType: 'lambda-function'
      };

      const result = resolveReferencesToMountedEfsFilesystems({ resource });

      expect(result).toEqual([]);
    });

    test('should resolve single EFS filesystem for lambda', async () => {
      const { resolveReferencesToMountedEfsFilesystems } = await import('./efs-filesystems');

      const resource: any = {
        type: 'function',
        volumeMounts: [
          {
            properties: {
              efsFilesystemName: 'efs1'
            }
          }
        ],
        nameChain: ['myLambda'],
        configParentResourceType: 'lambda-function'
      };

      const result = resolveReferencesToMountedEfsFilesystems({ resource });

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('efs1');
    });

    test('should deduplicate EFS filesystems for lambda', async () => {
      const { resolveReferencesToMountedEfsFilesystems } = await import('./efs-filesystems');

      const resource: any = {
        type: 'function',
        volumeMounts: [
          {
            properties: {
              efsFilesystemName: 'efs1'
            }
          },
          {
            properties: {
              efsFilesystemName: 'efs1'
            }
          }
        ],
        nameChain: ['myLambda'],
        configParentResourceType: 'lambda-function'
      };

      const result = resolveReferencesToMountedEfsFilesystems({ resource });

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('efs1');
    });

    test('should resolve multiple unique EFS filesystems for lambda', async () => {
      const { resolveReferencesToMountedEfsFilesystems } = await import('./efs-filesystems');

      const resource: any = {
        type: 'function',
        volumeMounts: [
          {
            properties: {
              efsFilesystemName: 'efs1'
            }
          },
          {
            properties: {
              efsFilesystemName: 'efs2'
            }
          }
        ],
        nameChain: ['myLambda'],
        configParentResourceType: 'lambda-function'
      };

      const result = resolveReferencesToMountedEfsFilesystems({ resource });

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('efs1');
      expect(result[1].name).toBe('efs2');
    });

    test('should resolve EFS filesystems from multi-container workload', async () => {
      const { resolveReferencesToMountedEfsFilesystems } = await import('./efs-filesystems');

      const resource: any = {
        type: 'multi-container-workload',
        containers: [
          {
            volumeMounts: [
              {
                properties: {
                  efsFilesystemName: 'efs1'
                }
              }
            ]
          }
        ],
        nameChain: ['myWorkload'],
        configParentResourceType: 'multi-container-workload'
      };

      const result = resolveReferencesToMountedEfsFilesystems({ resource });

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('efs1');
    });

    test('should deduplicate EFS filesystems across containers', async () => {
      const { resolveReferencesToMountedEfsFilesystems } = await import('./efs-filesystems');

      const resource: any = {
        type: 'multi-container-workload',
        containers: [
          {
            volumeMounts: [
              {
                properties: {
                  efsFilesystemName: 'efs1'
                }
              }
            ]
          },
          {
            volumeMounts: [
              {
                properties: {
                  efsFilesystemName: 'efs1'
                }
              }
            ]
          }
        ],
        nameChain: ['myWorkload'],
        configParentResourceType: 'multi-container-workload'
      };

      const result = resolveReferencesToMountedEfsFilesystems({ resource });

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('efs1');
    });

    test('should handle containers without volume mounts', async () => {
      const { resolveReferencesToMountedEfsFilesystems } = await import('./efs-filesystems');

      const resource: any = {
        type: 'multi-container-workload',
        containers: [
          {
            volumeMounts: []
          },
          {
            // No volumeMounts property
          }
        ],
        nameChain: ['myWorkload'],
        configParentResourceType: 'multi-container-workload'
      };

      const result = resolveReferencesToMountedEfsFilesystems({ resource });

      expect(result).toEqual([]);
    });

    test('should handle volume mounts without EFS filesystem name', async () => {
      const { resolveReferencesToMountedEfsFilesystems } = await import('./efs-filesystems');

      const resource: any = {
        type: 'function',
        volumeMounts: [
          {
            properties: {
              // No efsFilesystemName
            }
          }
        ],
        nameChain: ['myLambda'],
        configParentResourceType: 'lambda-function'
      };

      const result = resolveReferencesToMountedEfsFilesystems({ resource });

      expect(result).toEqual([]);
    });
  });

  describe('getMountsForEfsFilesystem', () => {
    test('should return empty array when no resources mount the filesystem', async () => {
      const { configManager } = await import('..');
      const { getMountsForEfsFilesystem } = await import('./efs-filesystems');

      configManager.allLambdasToUpload = [];
      configManager.allContainerWorkloads = [];

      const result = getMountsForEfsFilesystem({
        efsFileSystemNameChain: 'efs1'
      });

      expect(result).toEqual([]);
    });

    test('should find lambda mounting the filesystem', async () => {
      const { configManager } = await import('..');
      const { getMountsForEfsFilesystem } = await import('./efs-filesystems');

      const lambda: any = {
        type: 'function',
        name: 'myLambda',
        volumeMounts: [
          {
            properties: {
              efsFilesystemName: 'efs1'
            }
          }
        ]
      };

      configManager.allLambdasToUpload = [lambda];
      configManager.allContainerWorkloads = [];

      const result = getMountsForEfsFilesystem({
        efsFileSystemNameChain: 'efs1'
      });

      expect(result.length).toBe(1);
      expect(result[0].mountingResource).toBe(lambda);
      expect(result[0].mountingResourceCfLogicalNameOfSecurityGroup).toBe('myLambdaSecurityGroup');
    });

    test('should handle array nameChain', async () => {
      const { configManager } = await import('..');
      const { getMountsForEfsFilesystem } = await import('./efs-filesystems');

      const lambda: any = {
        type: 'function',
        name: 'myLambda',
        volumeMounts: [
          {
            properties: {
              efsFilesystemName: 'app.efs1'
            }
          }
        ]
      };

      configManager.allLambdasToUpload = [lambda];
      configManager.allContainerWorkloads = [];

      const result = getMountsForEfsFilesystem({
        efsFileSystemNameChain: ['app', 'efs1']
      });

      expect(result.length).toBe(1);
      expect(result[0].mountingResource).toBe(lambda);
    });

    test('should find container workload mounting the filesystem', async () => {
      const { configManager } = await import('..');
      const { getMountsForEfsFilesystem } = await import('./efs-filesystems');

      const workload: any = {
        type: 'multi-container-workload',
        name: 'myWorkload',
        containers: [
          {
            volumeMounts: [
              {
                properties: {
                  efsFilesystemName: 'efs1'
                }
              }
            ]
          }
        ]
      };

      configManager.allLambdasToUpload = [];
      configManager.allContainerWorkloads = [workload];

      const result = getMountsForEfsFilesystem({
        efsFileSystemNameChain: 'efs1'
      });

      expect(result.length).toBe(1);
      expect(result[0].mountingResource).toBe(workload);
      expect(result[0].mountingResourceCfLogicalNameOfSecurityGroup).toBe('myWorkloadSecurityGroup');
    });

    test('should find multiple resources mounting the same filesystem', async () => {
      const { configManager } = await import('..');
      const { getMountsForEfsFilesystem } = await import('./efs-filesystems');

      const lambda: any = {
        type: 'function',
        name: 'lambda1',
        volumeMounts: [
          {
            properties: {
              efsFilesystemName: 'efs1'
            }
          }
        ]
      };

      const workload: any = {
        type: 'multi-container-workload',
        name: 'workload1',
        containers: [
          {
            volumeMounts: [
              {
                properties: {
                  efsFilesystemName: 'efs1'
                }
              }
            ]
          }
        ]
      };

      configManager.allLambdasToUpload = [lambda];
      configManager.allContainerWorkloads = [workload];

      const result = getMountsForEfsFilesystem({
        efsFileSystemNameChain: 'efs1'
      });

      expect(result.length).toBe(2);
    });

    test('should ignore resources mounting different filesystems', async () => {
      const { configManager } = await import('..');
      const { getMountsForEfsFilesystem } = await import('./efs-filesystems');

      const lambda: any = {
        type: 'function',
        name: 'lambda1',
        volumeMounts: [
          {
            properties: {
              efsFilesystemName: 'efs2'
            }
          }
        ]
      };

      configManager.allLambdasToUpload = [lambda];
      configManager.allContainerWorkloads = [];

      const result = getMountsForEfsFilesystem({
        efsFileSystemNameChain: 'efs1'
      });

      expect(result).toEqual([]);
    });

    test('should handle lambda without volume mounts', async () => {
      const { configManager } = await import('..');
      const { getMountsForEfsFilesystem } = await import('./efs-filesystems');

      const lambda: any = {
        type: 'function',
        name: 'lambda1'
        // No volumeMounts
      };

      configManager.allLambdasToUpload = [lambda];
      configManager.allContainerWorkloads = [];

      const result = getMountsForEfsFilesystem({
        efsFileSystemNameChain: 'efs1'
      });

      expect(result).toEqual([]);
    });
  });
});
