import type { StackEvent } from '@aws-sdk/client-cloudformation';
import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    command: 'stacktape deploy',
    region: 'us-east-1',
    targetStack: {
      stackName: 'my-stack-dev'
    }
  }
}));

mock.module('@domain-services/calculated-stack-overview-manager', () => ({
  calculatedStackOverviewManager: {
    findStpParentNameOfCfResource: mock(({ cfLogicalName }) => {
      if (cfLogicalName === 'MyFunctionRole') {
        return 'myFunction';
      }
      return null;
    })
  }
}));

mock.module('@domain-services/deployed-stack-overview-manager', () => ({
  deployedStackOverviewManager: {
    deployedFunctions: [],
    getStpResource: mock(({ nameChain }) => ({
      cloudformationChildResources: {
        MyFunctionAlias: {},
        MyFunctionVersion: {}
      }
    }))
  }
}));

mock.module('@shared/naming/console-links', () => ({
  consoleLinks: {
    stackUrl: mock((region, stackId, tab) => `https://console.aws.amazon.com/cloudformation/${region}/${stackId}/${tab}`)
  }
}));

mock.module('@shared/naming/logical-names', () => ({
  cfLogicalNames: {
    serviceDiscoveryPrivateNamespace: mock(() => 'PrivateNamespace')
  }
}));

mock.module('@shared/utils/stack-info-map', () => ({
  getCloudformationChildResources: mock((args) => args.resource?.cloudformationChildResources || {})
}));

mock.module('@utils/printer', () => ({
  printer: {
    colorize: mock((color, text) => text),
    prettyCommand: mock((cmd) => `\`${cmd}\``),
    prettyOption: mock((opt) => `--${opt}`)
  }
}));

describe('cloudformation-stack-manager/utils', () => {
  describe('cfFailedEventHandlers', () => {
    test('should match replacement with disable-rollback error', async () => {
      const { cfFailedEventHandlers } = await import('./utils');

      const event: StackEvent = {
        LogicalResourceId: 'MyBucket',
        ResourceType: 'AWS::S3::Bucket',
        ResourceStatusReason: 'Replacement type updates not supported on stack with disable-rollback.',
        Timestamp: new Date()
      } as StackEvent;

      const handler = cfFailedEventHandlers.find((h) => h.eventMatchFunction(event));
      expect(handler).toBeDefined();

      const result = await handler.handlerFunction(event);
      expect(result.errorMessage).toContain('MyBucket');
      expect(result.errorMessage).toContain('AWS::S3::Bucket');
      expect(result.errorMessage).toContain('needs to be replaced');
    });

    test('should match namespace deletion error', async () => {
      const { cfFailedEventHandlers } = await import('./utils');

      const event: StackEvent = {
        LogicalResourceId: 'PrivateNamespace',
        ResourceType: 'AWS::ServiceDiscovery::PrivateDnsNamespace',
        ResourceStatusReason: 'Namespace has associated services. Please delete the services before deleting the namespace',
        Timestamp: new Date()
      } as StackEvent;

      const handler = cfFailedEventHandlers.find((h) => h.eventMatchFunction(event));
      expect(handler).toBeDefined();

      const result = await handler.handlerFunction(event);
      expect(result.errorMessage).toContain('Failed to delete namespace');
      expect(result.hints).toBeDefined();
      expect(result.hints[0]).toContain('Try running the command');
    });

    test('should match database option group deletion error', async () => {
      const { cfFailedEventHandlers } = await import('./utils');

      const event: StackEvent = {
        LogicalResourceId: 'DBOptionGroup',
        ResourceType: 'AWS::RDS::OptionGroup',
        ResourceStatusReason: 'The option group my-option-group cannot be deleted because it is in use',
        Timestamp: new Date()
      } as StackEvent;

      const handler = cfFailedEventHandlers.find((h) => h.eventMatchFunction(event));
      expect(handler).toBeDefined();

      const result = await handler.handlerFunction(event);
      expect(result.errorMessage).toContain('option group');
      expect(result.errorMessage).toContain('DBOptionGroup');
      expect(result.hints).toBeDefined();
      expect(result.hints.length).toBeGreaterThan(0);
    });

    test('should match user-initiated cancellation', async () => {
      const { cfFailedEventHandlers } = await import('./utils');

      const event: StackEvent = {
        LogicalResourceId: 'my-stack-dev',
        ResourceType: 'AWS::CloudFormation::Stack',
        ResourceStatusReason: 'User Initiated',
        Timestamp: new Date()
      } as StackEvent;

      const handler = cfFailedEventHandlers.find((h) => h.eventMatchFunction(event));
      expect(handler).toBeDefined();

      const result = await handler.handlerFunction(event);
      expect(result.errorMessage).toBe('Update of the stack was cancelled by the user.');
    });

    test('should match lambda blue/green deployment failure', async () => {
      const { cfFailedEventHandlers } = await import('./utils');

      // Setup deployed functions
      const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
      deployedStackOverviewManager.deployedFunctions = [
        {
          nameChain: ['myFunction'],
          stpResourceName: 'myFunction',
          resource: {
            cloudformationChildResources: {
              MyFunctionAlias: {},
              MyFunctionVersion: {}
            }
          }
        } as any
      ];

      const event: StackEvent = {
        LogicalResourceId: 'MyFunctionAlias',
        ResourceType: 'AWS::Lambda::Alias',
        ResourceStatusReason: 'Rollback successful after deployment failure',
        Timestamp: new Date()
      } as StackEvent;

      const handler = cfFailedEventHandlers.find((h) => h.eventMatchFunction(event));
      expect(handler).toBeDefined();

      const result = await handler.handlerFunction(event);
      expect(result.errorMessage).toContain('Blue/green deployment');
      expect(result.errorMessage).toContain('myFunction');
    });

    test('should match ECS Circuit Breaker failure', async () => {
      const { cfFailedEventHandlers } = await import('./utils');

      const event: StackEvent = {
        LogicalResourceId: 'MyECSService',
        ResourceType: 'AWS::ECS::Service',
        ResourceStatusReason: 'Resource failed due to Circuit Breaker',
        Timestamp: new Date()
      } as StackEvent;

      const handler = cfFailedEventHandlers.find((h) => h.eventMatchFunction(event));
      expect(handler).toBeDefined();

      const mockPoller = {
        getFailureMessage: mock(() => 'Service failed to stabilize')
      };

      const result = await handler.handlerFunction(event, {
        ecsDeploymentStatusPollers: {
          MyECSService: mockPoller as any
        }
      });

      expect(result.errorMessage).toContain('Deployment of');
      expect(result.errorMessage).toContain('MyECSService');
      expect(result.errorMessage).toContain('Service failed to stabilize');
    });

    test('should match blue-green deployment timeout', async () => {
      const { cfFailedEventHandlers } = await import('./utils');

      const event: StackEvent = {
        LogicalResourceId: 'MyService',
        ResourceType: 'Stacktape::ECSBlueGreenV1::Service',
        ResourceStatusReason: 'The deployment timed out waiting for service to stabilize',
        Timestamp: new Date()
      } as StackEvent;

      const handler = cfFailedEventHandlers.find((h) => h.eventMatchFunction(event));
      expect(handler).toBeDefined();

      const result = await handler.handlerFunction(event);
      expect(result.errorMessage).toContain('Deployment of');
      expect(result.errorMessage).toContain('failed after multiple attempts');
    });

    test('should match AWS quota errors', async () => {
      const { cfFailedEventHandlers } = await import('./utils');

      const event: StackEvent = {
        LogicalResourceId: 'MyVPC',
        ResourceType: 'AWS::EC2::VPC',
        ResourceStatusReason: 'The maximum number of VPCs has been reached.',
        Timestamp: new Date()
      } as StackEvent;

      const handler = cfFailedEventHandlers.find((h) => h.eventMatchFunction(event));
      expect(handler).toBeDefined();

      const result = await handler.handlerFunction(event);
      expect(result.errorMessage).toContain('MyVPC');
      expect(result.errorMessage).toContain('The maximum number of VPCs has been reached');
      expect(result.hints).toBeDefined();
      expect(result.hints[0]).toContain('quota');
    });

    test('should have default handler that matches any event', async () => {
      const { cfFailedEventHandlers } = await import('./utils');

      const event: StackEvent = {
        LogicalResourceId: 'SomeResource',
        ResourceType: 'AWS::Some::Resource',
        ResourceStatusReason: 'Some random error occurred',
        Timestamp: new Date()
      } as StackEvent;

      // The default handler should always be found
      const handler = cfFailedEventHandlers.find((h) => h.eventMatchFunction(event));
      expect(handler).toBeDefined();

      const result = await handler.handlerFunction(event);
      expect(result.errorMessage).toContain('SomeResource');
      expect(result.errorMessage).toContain('Some random error occurred');
    });

    test('should include parent resource name when available', async () => {
      const { cfFailedEventHandlers } = await import('./utils');

      const event: StackEvent = {
        LogicalResourceId: 'MyFunctionRole',
        ResourceType: 'AWS::IAM::Role',
        ResourceStatusReason: 'Role already exists',
        Timestamp: new Date()
      } as StackEvent;

      const handler = cfFailedEventHandlers[cfFailedEventHandlers.length - 1]; // Default handler
      const result = await handler.handlerFunction(event);

      expect(result.errorMessage).toContain('MyFunctionRole');
      expect(result.errorMessage).toContain('myFunction'); // Parent name
      expect(result.errorMessage).toContain('Role already exists');
    });

    test('handlers should be ordered correctly with default handler last', async () => {
      const { cfFailedEventHandlers } = await import('./utils');

      // Last handler should match everything
      const lastHandler = cfFailedEventHandlers[cfFailedEventHandlers.length - 1];
      const anyEvent: StackEvent = {
        LogicalResourceId: 'AnyResource',
        ResourceType: 'AWS::Any::Resource',
        ResourceStatusReason: 'Any reason',
        Timestamp: new Date()
      } as StackEvent;

      expect(lastHandler.eventMatchFunction(anyEvent)).toBe(true);
    });
  });

  describe('getHintsAfterStackFailureOperation', () => {
    test('should return rollback hints for update with auto-rollback enabled', async () => {
      const { getHintsAfterStackFailureOperation } = await import('./utils');

      const hints = getHintsAfterStackFailureOperation({
        cfStackAction: 'update',
        stackId: 'stack-12345',
        isAutoRollbackEnabled: true
      });

      expect(hints.length).toBe(2);
      expect(hints[0]).toContain('monitor stack rollback');
      expect(hints[0]).toContain('https://console.aws.amazon.com');
      expect(hints[1]).toContain('disable automatic rollback');
      expect(hints[1]).toContain('disableAutoRollback');
    });

    test('should return manual rollback hint for update with auto-rollback disabled', async () => {
      const { getHintsAfterStackFailureOperation } = await import('./utils');

      const hints = getHintsAfterStackFailureOperation({
        cfStackAction: 'update',
        stackId: 'stack-12345',
        isAutoRollbackEnabled: false
      });

      expect(hints.length).toBe(1);
      expect(hints[0]).toContain('Automatic rollback is disabled');
      expect(hints[0]).toContain('stacktape rollback');
    });

    test('should return deletion hint for create with auto-rollback enabled', async () => {
      const { getHintsAfterStackFailureOperation } = await import('./utils');

      const hints = getHintsAfterStackFailureOperation({
        cfStackAction: 'create',
        stackId: 'stack-12345',
        isAutoRollbackEnabled: true
      });

      expect(hints.length).toBe(1);
      expect(hints[0]).toContain('Stack will be deleted');
      expect(hints[0]).toContain('monitor the deletion progress');
      expect(hints[0]).toContain('https://console.aws.amazon.com');
    });

    test('should return manual rollback hint for create with auto-rollback disabled', async () => {
      const { getHintsAfterStackFailureOperation } = await import('./utils');

      const hints = getHintsAfterStackFailureOperation({
        cfStackAction: 'create',
        stackId: 'stack-12345',
        isAutoRollbackEnabled: false
      });

      expect(hints.length).toBe(1);
      expect(hints[0]).toContain('Automatic rollback is disabled');
      expect(hints[0]).toContain('stacktape rollback');
    });

    test('should return manual deletion hint for delete operation', async () => {
      const { getHintsAfterStackFailureOperation } = await import('./utils');

      const hints = getHintsAfterStackFailureOperation({
        cfStackAction: 'delete',
        stackId: 'stack-12345',
        isAutoRollbackEnabled: true
      });

      expect(hints.length).toBe(1);
      expect(hints[0]).toContain('delete them manually');
      expect(hints[0]).toContain('AWS console');
    });

    test('should return empty hints for rollback operation', async () => {
      const { getHintsAfterStackFailureOperation } = await import('./utils');

      const hints = getHintsAfterStackFailureOperation({
        cfStackAction: 'rollback',
        stackId: 'stack-12345',
        isAutoRollbackEnabled: true
      });

      expect(hints.length).toBe(0);
    });

    test('should include region and stack ID in console links', async () => {
      const { getHintsAfterStackFailureOperation } = await import('./utils');

      const hints = getHintsAfterStackFailureOperation({
        cfStackAction: 'update',
        stackId: 'arn:aws:cloudformation:us-west-2:123456789012:stack/my-stack/abc-123',
        isAutoRollbackEnabled: true
      });

      expect(hints[0]).toContain('us-east-1'); // From mocked global state
      expect(hints[0]).toContain('arn:aws:cloudformation:us-west-2:123456789012:stack/my-stack/abc-123');
    });
  });
});
