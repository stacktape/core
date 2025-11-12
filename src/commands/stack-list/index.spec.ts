import { describe, expect, mock, test } from 'bun:test';
import { StackStatus } from '@aws-sdk/client-cloudformation';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    invokedFrom: 'cli'
  }
}));

mock.module('@domain-services/budget-manager', () => ({
  budgetManager: {
    init: mock(async () => {}),
    getBudgetInfoForSpecifiedStack: mock(({ stackName }) => ({
      actualSpend: { Amount: '10.50', Unit: 'USD' },
      forecastedSpend: { Amount: '15.00', Unit: 'USD' }
    }))
  }
}));

mock.module('@shared/naming/utils', () => ({
  getStacktapeStackInfoFromTemplateDescription: mock((description) => ({
    projectName: 'test-project',
    stage: 'dev',
    region: 'us-east-1'
  })),
  isStacktapeStackDescription: mock((description) => description?.includes('stacktape'))
}));

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    listStacks: mock(async () => [
      {
        StackName: 'test-project-dev',
        StackId: 'arn:aws:cloudformation:us-east-1:123456789012:stack/test-project-dev/abc123',
        StackStatus: StackStatus.CREATE_COMPLETE,
        CreationTime: new Date('2024-01-01'),
        LastUpdatedTime: new Date('2024-01-02'),
        TemplateDescription: 'Created by stacktape'
      },
      {
        StackName: 'test-project-prod',
        StackId: 'arn:aws:cloudformation:us-east-1:123456789012:stack/test-project-prod/def456',
        StackStatus: StackStatus.UPDATE_COMPLETE,
        CreationTime: new Date('2024-01-03'),
        LastUpdatedTime: new Date('2024-01-04'),
        TemplateDescription: 'Created by stacktape'
      },
      {
        StackName: 'deleted-stack',
        StackId: 'arn:aws:cloudformation:us-east-1:123456789012:stack/deleted-stack/ghi789',
        StackStatus: StackStatus.DELETE_COMPLETE,
        CreationTime: new Date('2024-01-05'),
        TemplateDescription: 'Created by stacktape'
      }
    ])
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    printListStack: mock(() => {})
  }
}));

mock.module('../_utils/initialization', () => ({
  loadUserCredentials: mock(async () => {})
}));

describe('stack-list command', () => {
  test('should list all non-deleted stacks with budget info', async () => {
    const { commandStackList } = await import('./index');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { budgetManager } = await import('@domain-services/budget-manager');
    const { loadUserCredentials } = await import('../_utils/initialization');

    const result = await commandStackList();

    expect(loadUserCredentials).toHaveBeenCalled();
    expect(awsSdkManager.listStacks).toHaveBeenCalled();
    expect(budgetManager.init).toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0].stackName).toBe('test-project-dev');
    expect(result[0].stackStatus).toBe(StackStatus.CREATE_COMPLETE);
    expect(result[0].actualSpend).toBe('10.50');
    expect(result[0].forecastedSpend).toBe('15.00');
    expect(result[1].stackName).toBe('test-project-prod');
  });

  test('should exclude DELETE_COMPLETE stacks', async () => {
    const { commandStackList } = await import('./index');

    const result = await commandStackList();

    expect(result.every((stack) => stack.stackStatus !== StackStatus.DELETE_COMPLETE)).toBe(true);
  });

  test('should print stack list when invoked from CLI', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { printer } = await import('@utils/printer');
    globalStateManager.invokedFrom = 'cli';

    const { commandStackList } = await import('./index');
    await commandStackList();

    expect(printer.printListStack).toHaveBeenCalled();
  });

  test('should not print when invoked from SDK', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { printer } = await import('@utils/printer');
    globalStateManager.invokedFrom = 'sdk';

    (printer.printListStack as any).mock.calls = [];

    const { commandStackList } = await import('./index');
    await commandStackList();

    expect(printer.printListStack).not.toHaveBeenCalled();
  });
});
