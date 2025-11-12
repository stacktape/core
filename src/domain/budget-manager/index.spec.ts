import { describe, expect, test, beforeEach, mock } from 'bun:test';

const mockGetAllTagsUsedInRegion = mock(() => []);
const mockGetTagsUsableInCostExploring = mock(() => ({ tags: [] }));
const mockListBudgets = mock(() => []);
const mockStartEvent = mock(async () => {});
const mockFinishEvent = mock(async () => {});

const mockGlobalStateManager = {
  region: 'us-east-1',
  targetAwsAccount: {
    awsAccountId: '123456789012'
  }
};

const mockCfLogicalNames = {
  stackBudget: mock((stackName) => `${stackName}Budget`)
};

const mockTagNames = {
  globallyUniqueStackHash: mock(() => 'stp:stack-hash')
};

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    getAllTagsUsedInRegion: mockGetAllTagsUsedInRegion,
    getTagsUsableInCostExploring: mockGetTagsUsableInCostExploring,
    listBudgets: mockListBudgets
  }
}));

mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mockStartEvent,
    finishEvent: mockFinishEvent
  }
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: mockGlobalStateManager
}));

mock.module('@shared/naming/logical-names', () => ({
  cfLogicalNames: mockCfLogicalNames
}));

mock.module('@shared/naming/tag-names', () => ({
  tagNames: mockTagNames
}));

describe('BudgetManager', () => {
  let budgetManager: any;

  beforeEach(async () => {
    mock.restore();
    mockGetAllTagsUsedInRegion.mockClear();
    mockGetTagsUsableInCostExploring.mockClear();
    mockListBudgets.mockClear();
    mockStartEvent.mockClear();
    mockFinishEvent.mockClear();
    mockCfLogicalNames.stackBudget.mockClear();
    mockTagNames.globallyUniqueStackHash.mockClear();

    mockGetAllTagsUsedInRegion.mockResolvedValue([]);
    mockGetTagsUsableInCostExploring.mockResolvedValue({ tags: [] });
    mockListBudgets.mockResolvedValue([]);
    mockCfLogicalNames.stackBudget.mockImplementation((stackName) => `${stackName}Budget`);
    mockTagNames.globallyUniqueStackHash.mockReturnValue('stp:stack-hash');
    mockGlobalStateManager.region = 'us-east-1';

    const module = await import('./index');
    budgetManager = module.budgetManager;
    await budgetManager.init();
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();
      await manager.init();
      expect(manager.tagsUsedInRegion).toEqual([]);
      expect(manager.tagsUsableInCostExploring).toEqual({ tags: [] });
      expect(manager.budgets).toEqual([]);
    });

    test('should fetch budget info on initialization', async () => {
      mockGetAllTagsUsedInRegion.mockResolvedValueOnce(['tag1', 'tag2']);
      mockGetTagsUsableInCostExploring.mockResolvedValueOnce({
        tags: ['tag1', 'stp:stack-hash']
      });
      mockListBudgets.mockResolvedValueOnce([
        {
          BudgetName: 'test-stack-budget',
          BudgetLimit: { Amount: '100', Unit: 'USD' }
        }
      ]);

      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();
      await manager.init();

      expect(mockStartEvent).toHaveBeenCalledWith({
        eventType: 'FETCH_BUDGET_INFO',
        description: 'Fetching budget info'
      });

      expect(mockGetAllTagsUsedInRegion).toHaveBeenCalled();
      expect(mockGetTagsUsableInCostExploring).toHaveBeenCalled();
      expect(mockListBudgets).toHaveBeenCalledWith({
        accountId: '123456789012'
      });

      expect(manager.tagsUsedInRegion).toEqual(['tag1', 'tag2']);
      expect(manager.tagsUsableInCostExploring.tags).toContain('stp:stack-hash');
      expect(manager.budgets).toHaveLength(1);

      expect(mockFinishEvent).toHaveBeenCalledWith({
        eventType: 'FETCH_BUDGET_INFO'
      });
    });

    test('should fetch all data in parallel', async () => {
      mockGetAllTagsUsedInRegion.mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return ['tag1'];
      });
      mockGetTagsUsableInCostExploring.mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { tags: ['tag2'] };
      });
      mockListBudgets.mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return [];
      });

      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();

      const startTime = Date.now();
      await manager.init();
      const duration = Date.now() - startTime;

      // Should take ~10ms not ~30ms if running in parallel
      expect(duration).toBeLessThan(25);
      expect(mockGetAllTagsUsedInRegion).toHaveBeenCalled();
      expect(mockGetTagsUsableInCostExploring).toHaveBeenCalled();
      expect(mockListBudgets).toHaveBeenCalled();
    });
  });

  describe('loadBudgets', () => {
    test('should load budgets', async () => {
      const budgets = [
        {
          BudgetName: 'budget1',
          CalculatedSpend: {
            ActualSpend: { Amount: '50', Unit: 'USD' },
            ForecastedSpend: { Amount: '75', Unit: 'USD' }
          }
        }
      ];

      mockListBudgets.mockResolvedValueOnce(budgets);

      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();
      await manager.loadBudgets();

      expect(mockListBudgets).toHaveBeenCalledWith({
        accountId: '123456789012'
      });
      expect(manager.budgets).toEqual(budgets);
    });

    test('should handle empty budget list', async () => {
      mockListBudgets.mockResolvedValueOnce([]);

      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();
      await manager.loadBudgets();

      expect(manager.budgets).toEqual([]);
    });
  });

  describe('isBudgetingEnabled', () => {
    test('should return true when stack hash tag is available in cost explorer', async () => {
      mockGetTagsUsableInCostExploring.mockResolvedValueOnce({
        tags: ['tag1', 'stp:stack-hash', 'tag2']
      });

      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();
      await manager.init();

      const isEnabled = manager.isBudgetingEnabled();
      expect(isEnabled).toBe(true);
    });

    test('should return false when stack hash tag is not available', async () => {
      mockGetTagsUsableInCostExploring.mockResolvedValueOnce({
        tags: ['tag1', 'tag2']
      });

      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();
      await manager.init();

      const isEnabled = manager.isBudgetingEnabled();
      expect(isEnabled).toBe(false);
    });

    test('should return false when tags are undefined', async () => {
      mockGetTagsUsableInCostExploring.mockResolvedValueOnce({
        tags: undefined
      });

      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();
      await manager.init();

      const isEnabled = manager.isBudgetingEnabled();
      expect(isEnabled).toBe(false);
    });

    test('should return false when cost explorer has error', async () => {
      mockGetTagsUsableInCostExploring.mockResolvedValueOnce({
        error: 'COST_EXPLORER_ERROR',
        tags: []
      });

      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();
      await manager.init();

      const isEnabled = manager.isBudgetingEnabled();
      expect(isEnabled).toBe(false);
    });
  });

  describe('isBudgetingAvailableForDeploymentRegion', () => {
    test('should return true for standard regions', () => {
      mockGlobalStateManager.region = 'us-east-1';
      const isAvailable = budgetManager.isBudgetingAvailableForDeploymentRegion();
      expect(isAvailable).toBe(true);
    });

    test('should return true for us-west-2', () => {
      mockGlobalStateManager.region = 'us-west-2';
      const isAvailable = budgetManager.isBudgetingAvailableForDeploymentRegion();
      expect(isAvailable).toBe(true);
    });

    test('should return true for eu-west-1', () => {
      mockGlobalStateManager.region = 'eu-west-1';
      const isAvailable = budgetManager.isBudgetingAvailableForDeploymentRegion();
      expect(isAvailable).toBe(true);
    });

    test('should return false for ap-east-1', () => {
      mockGlobalStateManager.region = 'ap-east-1';
      const isAvailable = budgetManager.isBudgetingAvailableForDeploymentRegion();
      expect(isAvailable).toBe(false);
    });

    test('should return false for ap-northeast-3', () => {
      mockGlobalStateManager.region = 'ap-northeast-3';
      const isAvailable = budgetManager.isBudgetingAvailableForDeploymentRegion();
      expect(isAvailable).toBe(false);
    });

    test('should return false for af-south-1', () => {
      mockGlobalStateManager.region = 'af-south-1';
      const isAvailable = budgetManager.isBudgetingAvailableForDeploymentRegion();
      expect(isAvailable).toBe(false);
    });

    test('should return false for eu-north-1', () => {
      mockGlobalStateManager.region = 'eu-north-1';
      const isAvailable = budgetManager.isBudgetingAvailableForDeploymentRegion();
      expect(isAvailable).toBe(false);
    });

    test('should return false for me-south-1', () => {
      mockGlobalStateManager.region = 'me-south-1';
      const isAvailable = budgetManager.isBudgetingAvailableForDeploymentRegion();
      expect(isAvailable).toBe(false);
    });

    test('should return false for ap-southeast-3', () => {
      mockGlobalStateManager.region = 'ap-southeast-3';
      const isAvailable = budgetManager.isBudgetingAvailableForDeploymentRegion();
      expect(isAvailable).toBe(false);
    });
  });

  describe('getBudgetInfoForSpecifiedStack', () => {
    test('should return budget info for stack', async () => {
      mockGlobalStateManager.region = 'us-east-1';
      mockListBudgets.mockResolvedValueOnce([
        {
          BudgetName: 'test-stack-Budget-us-east-1',
          CalculatedSpend: {
            ActualSpend: { Amount: '50.00', Unit: 'USD' },
            ForecastedSpend: { Amount: '75.50', Unit: 'USD' }
          }
        }
      ]);

      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();
      await manager.init();

      const budgetInfo = manager.getBudgetInfoForSpecifiedStack({
        stackName: 'test-stack'
      });

      expect(budgetInfo.actualSpend).toEqual({ Amount: '50.00', Unit: 'USD' });
      expect(budgetInfo.forecastedSpend).toEqual({ Amount: '75.50', Unit: 'USD' });
    });

    test('should return empty budget info when stack has no budget', async () => {
      mockListBudgets.mockResolvedValueOnce([]);

      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();
      await manager.init();

      const budgetInfo = manager.getBudgetInfoForSpecifiedStack({
        stackName: 'nonexistent-stack'
      });

      expect(budgetInfo.actualSpend).toBeUndefined();
      expect(budgetInfo.forecastedSpend).toBeUndefined();
    });

    test('should match budget by stack name prefix and region', async () => {
      mockGlobalStateManager.region = 'eu-west-1';
      mockListBudgets.mockResolvedValueOnce([
        {
          BudgetName: 'my-stack-Budget-eu-west-1-extra',
          CalculatedSpend: {
            ActualSpend: { Amount: '100', Unit: 'USD' },
            ForecastedSpend: { Amount: '150', Unit: 'USD' }
          }
        },
        {
          BudgetName: 'other-stack-Budget-eu-west-1',
          CalculatedSpend: {
            ActualSpend: { Amount: '200', Unit: 'USD' },
            ForecastedSpend: { Amount: '250', Unit: 'USD' }
          }
        }
      ]);

      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();
      await manager.init();

      const budgetInfo = manager.getBudgetInfoForSpecifiedStack({
        stackName: 'my-stack'
      });

      expect(budgetInfo.actualSpend).toEqual({ Amount: '100', Unit: 'USD' });
    });

    test('should not match budget from different region', async () => {
      mockGlobalStateManager.region = 'us-east-1';
      mockListBudgets.mockResolvedValueOnce([
        {
          BudgetName: 'test-stack-Budget-us-west-2',
          CalculatedSpend: {
            ActualSpend: { Amount: '100', Unit: 'USD' },
            ForecastedSpend: { Amount: '150', Unit: 'USD' }
          }
        }
      ]);

      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();
      await manager.init();

      const budgetInfo = manager.getBudgetInfoForSpecifiedStack({
        stackName: 'test-stack'
      });

      expect(budgetInfo.actualSpend).toBeUndefined();
      expect(budgetInfo.forecastedSpend).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    test('should handle API errors gracefully', async () => {
      mockListBudgets.mockRejectedValueOnce(new Error('Budgets API Error'));

      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();

      await expect(manager.init()).rejects.toThrow('Budgets API Error');
    });

    test('should handle budgets without calculated spend', async () => {
      mockListBudgets.mockResolvedValueOnce([
        {
          BudgetName: 'test-stack-Budget-us-east-1',
          BudgetLimit: { Amount: '100', Unit: 'USD' }
        }
      ]);

      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();
      await manager.init();

      const budgetInfo = manager.getBudgetInfoForSpecifiedStack({
        stackName: 'test-stack'
      });

      expect(budgetInfo.actualSpend).toBeUndefined();
      expect(budgetInfo.forecastedSpend).toBeUndefined();
    });

    test('should handle multiple budgets for same stack', async () => {
      mockGlobalStateManager.region = 'us-east-1';
      mockListBudgets.mockResolvedValueOnce([
        {
          BudgetName: 'test-stack-Budget-us-east-1-v1',
          CalculatedSpend: {
            ActualSpend: { Amount: '50', Unit: 'USD' }
          }
        },
        {
          BudgetName: 'test-stack-Budget-us-east-1-v2',
          CalculatedSpend: {
            ActualSpend: { Amount: '60', Unit: 'USD' }
          }
        }
      ]);

      const { BudgetManager } = await import('./index');
      const manager = new BudgetManager();
      await manager.init();

      const budgetInfo = manager.getBudgetInfoForSpecifiedStack({
        stackName: 'test-stack'
      });

      // Should return the first matching budget
      expect(budgetInfo.actualSpend).toEqual({ Amount: '50', Unit: 'USD' });
    });
  });
});
