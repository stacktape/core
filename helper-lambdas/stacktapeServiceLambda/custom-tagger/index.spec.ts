import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock AWS SDK clients
const mockSend = mock(async () => ({}));

const mockRoute53Client = {
  send: mock(async () => ({}))
};

const mockServiceDiscoveryClient = {
  send: mock(async () => ({}))
};

const mockEC2Client = {
  send: mock(async () => ({}))
};

mock.module('@aws-sdk/client-route-53', () => ({
  Route53Client: class {
    constructor() {
      return mockRoute53Client;
    }
  },
  ChangeTagsForResourceCommand: class {
    constructor(public input: any) {}
  }
}));

mock.module('@aws-sdk/client-servicediscovery', () => ({
  ServiceDiscoveryClient: class {
    constructor() {
      return mockServiceDiscoveryClient;
    }
  },
  GetNamespaceCommand: class {
    constructor(public input: any) {}
  }
}));

mock.module('@aws-sdk/client-ec2', () => ({
  EC2Client: class {
    constructor() {
      return mockEC2Client;
    }
  },
  DescribeNetworkInterfacesCommand: class {
    constructor(public input: any) {}
  },
  CreateTagsCommand: class {
    constructor(public input: any) {}
  }
}));

const mockTagNames = {
  cfAttributionLogicalName: () => 'stacktape:cf-attribution-logical-name',
  stackName: () => 'stacktape:stack-name',
  projectName: () => 'stacktape:project-name',
  stage: () => 'stacktape:stage',
  globallyUniqueStackHash: () => 'stacktape:globally-unique-stack-hash'
};

mock.module('@shared/naming/tag-names', () => ({
  tagNames: mockTagNames
}));

const mockChunkArray = mock((arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
});

mock.module('@shared/utils/misc', () => ({
  chunkArray: mockChunkArray
}));

describe('stacktapeServiceLambda/custom-tagger', () => {
  let handler: any;
  const originalEnv = process.env;

  beforeEach(async () => {
    mock.restore();

    // Clear mocks
    mockRoute53Client.send.mockClear();
    mockServiceDiscoveryClient.send.mockClear();
    mockEC2Client.send.mockClear();
    mockChunkArray.mockClear();

    // Set up environment variables
    process.env = {
      ...originalEnv,
      STACK_NAME: 'test-stack-dev',
      PROJECT_NAME: 'test-stack',
      STAGE: 'dev',
      GLOBALLY_UNIQUE_STACK_HASH: 'abc123def456'
    };

    // Set up default implementations
    mockServiceDiscoveryClient.send.mockResolvedValue({
      Namespace: {
        Properties: {
          DnsProperties: {
            HostedZoneId: 'Z1234567890ABC'
          }
        }
      }
    });

    mockRoute53Client.send.mockResolvedValue({});
    mockEC2Client.send.mockResolvedValue({
      NetworkInterfaces: [],
      NextToken: undefined
    });

    mockChunkArray.mockImplementation((arr, size) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    });

    const module = await import('./index');
    handler = module.default;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('CloudMap namespace - hosted zone tagging', () => {
    test('should tag hosted zone for CloudMap namespace', async () => {
      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [
          {
            attributionCfResourceLogicalName: 'MyServiceDiscoveryNamespace',
            namespaceId: 'ns-abc123',
            extraTags: []
          }
        ],
        tagNetworkInterfaceWithSecurityGroup: []
      };

      await handler(input);

      expect(mockServiceDiscoveryClient.send).toHaveBeenCalled();
      expect(mockRoute53Client.send).toHaveBeenCalled();

      const route53Call = mockRoute53Client.send.mock.calls[0][0];
      expect(route53Call.input.ResourceId).toBe('Z1234567890ABC');
      expect(route53Call.input.ResourceType).toBe('hostedzone');
      expect(route53Call.input.AddTags).toEqual([
        { Key: 'stacktape:cf-attribution-logical-name', Value: 'MyServiceDiscoveryNamespace' },
        { Key: 'stacktape:stack-name', Value: 'test-stack-dev' },
        { Key: 'stacktape:project-name', Value: 'test-stack' },
        { Key: 'stacktape:stage', Value: 'dev' },
        { Key: 'stacktape:globally-unique-stack-hash', Value: 'abc123def456' }
      ]);
    });

    test('should tag multiple hosted zones', async () => {
      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [
          {
            attributionCfResourceLogicalName: 'Namespace1',
            namespaceId: 'ns-1',
            extraTags: []
          },
          {
            attributionCfResourceLogicalName: 'Namespace2',
            namespaceId: 'ns-2',
            extraTags: []
          }
        ],
        tagNetworkInterfaceWithSecurityGroup: []
      };

      await handler(input);

      expect(mockServiceDiscoveryClient.send).toHaveBeenCalledTimes(2);
      expect(mockRoute53Client.send).toHaveBeenCalledTimes(2);
    });

    test('should include extra tags', async () => {
      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [
          {
            attributionCfResourceLogicalName: 'MyNamespace',
            namespaceId: 'ns-abc',
            extraTags: [
              { Key: 'Environment', Value: 'production' },
              { Key: 'Team', Value: 'platform' }
            ]
          }
        ],
        tagNetworkInterfaceWithSecurityGroup: []
      };

      await handler(input);

      const route53Call = mockRoute53Client.send.mock.calls[0][0];
      expect(route53Call.input.AddTags).toContainEqual(
        { Key: 'Environment', Value: 'production' }
      );
      expect(route53Call.input.AddTags).toContainEqual(
        { Key: 'Team', Value: 'platform' }
      );
    });

    test('should handle GetNamespace failures gracefully', async () => {
      mockServiceDiscoveryClient.send.mockRejectedValueOnce(new Error('Namespace not found'));

      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [
          {
            attributionCfResourceLogicalName: 'MyNamespace',
            namespaceId: 'ns-missing',
            extraTags: []
          }
        ],
        tagNetworkInterfaceWithSecurityGroup: []
      };

      // Should not throw - errors are logged but not propagated
      await expect(handler(input)).resolves.not.toThrow();
    });

    test('should handle ChangeTagsForResource failures gracefully', async () => {
      mockRoute53Client.send.mockRejectedValueOnce(new Error('Access denied'));

      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [
          {
            attributionCfResourceLogicalName: 'MyNamespace',
            namespaceId: 'ns-abc',
            extraTags: []
          }
        ],
        tagNetworkInterfaceWithSecurityGroup: []
      };

      // Should not throw - errors are logged but not propagated
      await expect(handler(input)).resolves.not.toThrow();
    });
  });

  describe('Security group - network interface tagging', () => {
    test('should tag network interfaces with security group', async () => {
      mockEC2Client.send.mockResolvedValueOnce({
        NetworkInterfaces: [
          { NetworkInterfaceId: 'eni-123' },
          { NetworkInterfaceId: 'eni-456' }
        ],
        NextToken: undefined
      });

      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [],
        tagNetworkInterfaceWithSecurityGroup: [
          {
            attributionCfResourceLogicalName: 'MySecurityGroup',
            securityGroupId: 'sg-abc123',
            extraTags: []
          }
        ]
      };

      await handler(input);

      expect(mockEC2Client.send).toHaveBeenCalledTimes(2); // DescribeNetworkInterfaces + CreateTags

      // Check DescribeNetworkInterfaces call
      const describeCall = mockEC2Client.send.mock.calls[0][0];
      expect(describeCall.input.Filters).toEqual([
        { Name: 'group-id', Values: ['sg-abc123'] }
      ]);

      // Check CreateTags call
      const createTagsCall = mockEC2Client.send.mock.calls[1][0];
      expect(createTagsCall.input.Resources).toEqual(['eni-123', 'eni-456']);
      expect(createTagsCall.input.Tags).toEqual([
        { Key: 'stacktape:cf-attribution-logical-name', Value: 'MySecurityGroup' },
        { Key: 'stacktape:stack-name', Value: 'test-stack-dev' },
        { Key: 'stacktape:project-name', Value: 'test-stack' },
        { Key: 'stacktape:stage', Value: 'dev' },
        { Key: 'stacktape:globally-unique-stack-hash', Value: 'abc123def456' }
      ]);
    });

    test('should chunk network interfaces when exceeding 500', async () => {
      const networkInterfaces = Array.from({ length: 1200 }, (_, i) => ({
        NetworkInterfaceId: `eni-${i}`
      }));

      mockEC2Client.send.mockResolvedValueOnce({
        NetworkInterfaces: networkInterfaces,
        NextToken: undefined
      });

      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [],
        tagNetworkInterfaceWithSecurityGroup: [
          {
            attributionCfResourceLogicalName: 'MySecurityGroup',
            securityGroupId: 'sg-large',
            extraTags: []
          }
        ]
      };

      await handler(input);

      expect(mockChunkArray).toHaveBeenCalledWith(networkInterfaces, 500);
      // Should have 3 CreateTags calls (1200 / 500 = 3 chunks)
      const createTagsCalls = mockEC2Client.send.mock.calls.filter(
        (call) => call[0].constructor.name === 'CreateTagsCommand'
      );
      expect(createTagsCalls.length).toBe(3);
    });

    test('should handle paginated network interface results', async () => {
      mockEC2Client.send
        .mockResolvedValueOnce({
          NetworkInterfaces: [
            { NetworkInterfaceId: 'eni-1' },
            { NetworkInterfaceId: 'eni-2' }
          ],
          NextToken: 'token-1'
        })
        .mockResolvedValueOnce({
          NetworkInterfaces: [
            { NetworkInterfaceId: 'eni-3' },
            { NetworkInterfaceId: 'eni-4' }
          ],
          NextToken: 'token-2'
        })
        .mockResolvedValueOnce({
          NetworkInterfaces: [
            { NetworkInterfaceId: 'eni-5' }
          ],
          NextToken: undefined
        });

      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [],
        tagNetworkInterfaceWithSecurityGroup: [
          {
            attributionCfResourceLogicalName: 'MySecurityGroup',
            securityGroupId: 'sg-paginated',
            extraTags: []
          }
        ]
      };

      await handler(input);

      // Should have 3 DescribeNetworkInterfaces calls
      const describeCalls = mockEC2Client.send.mock.calls.filter(
        (call) => call[0].constructor.name === 'DescribeNetworkInterfacesCommand'
      );
      expect(describeCalls.length).toBe(3);

      // Check pagination tokens
      expect(describeCalls[1][0].input.NextToken).toBe('token-1');
      expect(describeCalls[2][0].input.NextToken).toBe('token-2');
    });

    test('should tag multiple security groups', async () => {
      mockEC2Client.send
        .mockResolvedValueOnce({
          NetworkInterfaces: [{ NetworkInterfaceId: 'eni-1' }],
          NextToken: undefined
        })
        .mockResolvedValueOnce({}) // CreateTags for first SG
        .mockResolvedValueOnce({
          NetworkInterfaces: [{ NetworkInterfaceId: 'eni-2' }],
          NextToken: undefined
        })
        .mockResolvedValueOnce({}); // CreateTags for second SG

      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [],
        tagNetworkInterfaceWithSecurityGroup: [
          {
            attributionCfResourceLogicalName: 'SG1',
            securityGroupId: 'sg-1',
            extraTags: []
          },
          {
            attributionCfResourceLogicalName: 'SG2',
            securityGroupId: 'sg-2',
            extraTags: []
          }
        ]
      };

      await handler(input);

      expect(mockEC2Client.send).toHaveBeenCalledTimes(4);
    });

    test('should include extra tags for network interfaces', async () => {
      mockEC2Client.send.mockResolvedValueOnce({
        NetworkInterfaces: [{ NetworkInterfaceId: 'eni-123' }],
        NextToken: undefined
      });

      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [],
        tagNetworkInterfaceWithSecurityGroup: [
          {
            attributionCfResourceLogicalName: 'MySecurityGroup',
            securityGroupId: 'sg-abc',
            extraTags: [
              { Key: 'Application', Value: 'web' },
              { Key: 'Owner', Value: 'team-a' }
            ]
          }
        ]
      };

      await handler(input);

      const createTagsCall = mockEC2Client.send.mock.calls[1][0];
      expect(createTagsCall.input.Tags).toContainEqual(
        { Key: 'Application', Value: 'web' }
      );
      expect(createTagsCall.input.Tags).toContainEqual(
        { Key: 'Owner', Value: 'team-a' }
      );
    });

    test('should handle empty network interfaces result', async () => {
      mockEC2Client.send.mockResolvedValueOnce({
        NetworkInterfaces: [],
        NextToken: undefined
      });

      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [],
        tagNetworkInterfaceWithSecurityGroup: [
          {
            attributionCfResourceLogicalName: 'MySecurityGroup',
            securityGroupId: 'sg-empty',
            extraTags: []
          }
        ]
      };

      await handler(input);

      // Should only have DescribeNetworkInterfaces call, no CreateTags
      const createTagsCalls = mockEC2Client.send.mock.calls.filter(
        (call) => call[0].constructor.name === 'CreateTagsCommand'
      );
      expect(createTagsCalls.length).toBe(0);
    });

    test('should handle DescribeNetworkInterfaces failures gracefully', async () => {
      mockEC2Client.send.mockRejectedValueOnce(new Error('Access denied'));

      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [],
        tagNetworkInterfaceWithSecurityGroup: [
          {
            attributionCfResourceLogicalName: 'MySecurityGroup',
            securityGroupId: 'sg-fail',
            extraTags: []
          }
        ]
      };

      // Should not throw - errors are logged but not propagated
      await expect(handler(input)).resolves.not.toThrow();
    });

    test('should handle CreateTags failures gracefully', async () => {
      mockEC2Client.send
        .mockResolvedValueOnce({
          NetworkInterfaces: [{ NetworkInterfaceId: 'eni-123' }],
          NextToken: undefined
        })
        .mockRejectedValueOnce(new Error('Tagging failed'));

      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [],
        tagNetworkInterfaceWithSecurityGroup: [
          {
            attributionCfResourceLogicalName: 'MySecurityGroup',
            securityGroupId: 'sg-abc',
            extraTags: []
          }
        ]
      };

      // Should not throw - errors are logged but not propagated
      await expect(handler(input)).resolves.not.toThrow();
    });
  });

  describe('combined operations', () => {
    test('should handle both CloudMap and security group tagging', async () => {
      mockEC2Client.send.mockResolvedValueOnce({
        NetworkInterfaces: [{ NetworkInterfaceId: 'eni-123' }],
        NextToken: undefined
      });

      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [
          {
            attributionCfResourceLogicalName: 'MyNamespace',
            namespaceId: 'ns-abc',
            extraTags: []
          }
        ],
        tagNetworkInterfaceWithSecurityGroup: [
          {
            attributionCfResourceLogicalName: 'MySecurityGroup',
            securityGroupId: 'sg-abc',
            extraTags: []
          }
        ]
      };

      await handler(input);

      expect(mockServiceDiscoveryClient.send).toHaveBeenCalled();
      expect(mockRoute53Client.send).toHaveBeenCalled();
      expect(mockEC2Client.send).toHaveBeenCalled();
    });

    test('should handle empty input', async () => {
      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [],
        tagNetworkInterfaceWithSecurityGroup: []
      };

      await handler(input);

      expect(mockServiceDiscoveryClient.send).not.toHaveBeenCalled();
      expect(mockRoute53Client.send).not.toHaveBeenCalled();
      expect(mockEC2Client.send).not.toHaveBeenCalled();
    });

    test('should handle partial failures', async () => {
      mockServiceDiscoveryClient.send.mockRejectedValueOnce(new Error('Namespace error'));
      mockEC2Client.send.mockResolvedValueOnce({
        NetworkInterfaces: [{ NetworkInterfaceId: 'eni-123' }],
        NextToken: undefined
      });

      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [
          {
            attributionCfResourceLogicalName: 'MyNamespace',
            namespaceId: 'ns-fail',
            extraTags: []
          }
        ],
        tagNetworkInterfaceWithSecurityGroup: [
          {
            attributionCfResourceLogicalName: 'MySecurityGroup',
            securityGroupId: 'sg-success',
            extraTags: []
          }
        ]
      };

      // Should not throw - errors are logged but operation continues
      await expect(handler(input)).resolves.not.toThrow();

      // Security group tagging should still succeed
      expect(mockEC2Client.send).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    test('should handle missing environment variables', async () => {
      delete process.env.STACK_NAME;
      delete process.env.PROJECT_NAME;
      delete process.env.STAGE;
      delete process.env.GLOBALLY_UNIQUE_STACK_HASH;

      mockEC2Client.send.mockResolvedValueOnce({
        NetworkInterfaces: [{ NetworkInterfaceId: 'eni-123' }],
        NextToken: undefined
      });

      const module = await import('./index');
      const newHandler = module.default;

      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [],
        tagNetworkInterfaceWithSecurityGroup: [
          {
            attributionCfResourceLogicalName: 'MySecurityGroup',
            securityGroupId: 'sg-abc',
            extraTags: []
          }
        ]
      };

      await newHandler(input);

      const createTagsCall = mockEC2Client.send.mock.calls[1][0];
      expect(createTagsCall.input.Tags).toContainEqual(
        { Key: 'stacktape:stack-name', Value: undefined }
      );
    });

    test('should handle very large number of extra tags', async () => {
      const manyTags = Array.from({ length: 50 }, (_, i) => ({
        Key: `Tag${i}`,
        Value: `Value${i}`
      }));

      mockEC2Client.send.mockResolvedValueOnce({
        NetworkInterfaces: [{ NetworkInterfaceId: 'eni-123' }],
        NextToken: undefined
      });

      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [],
        tagNetworkInterfaceWithSecurityGroup: [
          {
            attributionCfResourceLogicalName: 'MySecurityGroup',
            securityGroupId: 'sg-abc',
            extraTags: manyTags
          }
        ]
      };

      await handler(input);

      const createTagsCall = mockEC2Client.send.mock.calls[1][0];
      expect(createTagsCall.input.Tags.length).toBeGreaterThan(50);
    });

    test('should handle network interfaces with exactly 500 items', async () => {
      const exactly500 = Array.from({ length: 500 }, (_, i) => ({
        NetworkInterfaceId: `eni-${i}`
      }));

      mockEC2Client.send.mockResolvedValueOnce({
        NetworkInterfaces: exactly500,
        NextToken: undefined
      });

      const input = {
        tagHostedZoneAttributedToCloudMapNamespace: [],
        tagNetworkInterfaceWithSecurityGroup: [
          {
            attributionCfResourceLogicalName: 'MySecurityGroup',
            securityGroupId: 'sg-500',
            extraTags: []
          }
        ]
      };

      await handler(input);

      const createTagsCalls = mockEC2Client.send.mock.calls.filter(
        (call) => call[0].constructor.name === 'CreateTagsCommand'
      );
      expect(createTagsCalls.length).toBe(1);
    });
  });
});
