import { describe, expect, mock, test } from 'bun:test';

// Mock AWS SDK
mock.module('@aws-sdk/client-pricing', () => ({
  PricingClient: mock(function () {
    return {
      send: mock(async () => ({
        PriceList: [
          JSON.stringify({
            product: {
              attributes: {
                instanceType: 't3.micro',
                memory: '1 GiB',
                vcpu: '2'
              }
            },
            terms: {
              OnDemand: {
                'term1': {
                  priceDimensions: {
                    'dim1': {
                      pricePerUnit: {
                        USD: '0.0104'
                      }
                    }
                  }
                }
              }
            }
          })
        ]
      }))
    };
  }),
  GetProductsCommand: mock(function (params) {
    this.input = params;
  })
}));

describe('pricing-info', () => {
  describe('getFargateTaskPricing', () => {
    test('should get Fargate task pricing', async () => {
      const { getFargateTaskPricing } = await import('./pricing-info');

      const pricing = await getFargateTaskPricing({
        region: 'us-east-1',
        cpuUnits: 256,
        memoryMb: 512
      });

      expect(pricing).toBeDefined();
      expect(typeof pricing).toBe('object');
    });

    test('should return pricing for different CPU and memory', async () => {
      const { getFargateTaskPricing } = await import('./pricing-info');

      const pricing1 = await getFargateTaskPricing({
        region: 'us-east-1',
        cpuUnits: 256,
        memoryMb: 512
      });

      const pricing2 = await getFargateTaskPricing({
        region: 'us-west-2',
        cpuUnits: 1024,
        memoryMb: 2048
      });

      expect(pricing1).toBeDefined();
      expect(pricing2).toBeDefined();
    });
  });

  describe('getLambdaPricing', () => {
    test('should get Lambda function pricing', async () => {
      const { getLambdaPricing } = await import('./pricing-info');

      const pricing = await getLambdaPricing({
        region: 'us-east-1',
        memoryMb: 1024,
        architecture: 'x86_64'
      });

      expect(pricing).toBeDefined();
      expect(typeof pricing).toBe('object');
    });

    test('should handle different architectures', async () => {
      const { getLambdaPricing } = await import('./pricing-info');

      const pricingX86 = await getLambdaPricing({
        region: 'us-east-1',
        memoryMb: 1024,
        architecture: 'x86_64'
      });

      const pricingArm = await getLambdaPricing({
        region: 'us-east-1',
        memoryMb: 1024,
        architecture: 'arm64'
      });

      expect(pricingX86).toBeDefined();
      expect(pricingArm).toBeDefined();
    });

    test('should handle different memory sizes', async () => {
      const { getLambdaPricing } = await import('./pricing-info');

      const pricing512 = await getLambdaPricing({
        region: 'us-east-1',
        memoryMb: 512,
        architecture: 'x86_64'
      });

      const pricing2048 = await getLambdaPricing({
        region: 'us-east-1',
        memoryMb: 2048,
        architecture: 'x86_64'
      });

      expect(pricing512).toBeDefined();
      expect(pricing2048).toBeDefined();
    });
  });

  describe('getEC2Pricing', () => {
    test('should get EC2 instance pricing', async () => {
      const { getEC2Pricing } = await import('./pricing-info');

      const pricing = await getEC2Pricing({
        region: 'us-east-1',
        instanceType: 't3.micro'
      });

      expect(pricing).toBeDefined();
      expect(typeof pricing).toBe('object');
    });

    test('should handle different instance types', async () => {
      const { getEC2Pricing } = await import('./pricing-info');

      const pricingMicro = await getEC2Pricing({
        region: 'us-east-1',
        instanceType: 't3.micro'
      });

      const pricingLarge = await getEC2Pricing({
        region: 'us-east-1',
        instanceType: 't3.large'
      });

      expect(pricingMicro).toBeDefined();
      expect(pricingLarge).toBeDefined();
    });
  });

  describe('getRDSPricing', () => {
    test('should get RDS instance pricing', async () => {
      const { getRDSPricing } = await import('./pricing-info');

      const pricing = await getRDSPricing({
        region: 'us-east-1',
        instanceType: 'db.t3.micro',
        engine: 'postgres'
      });

      expect(pricing).toBeDefined();
      expect(typeof pricing).toBe('object');
    });

    test('should handle different database engines', async () => {
      const { getRDSPricing } = await import('./pricing-info');

      const pricingPostgres = await getRDSPricing({
        region: 'us-east-1',
        instanceType: 'db.t3.micro',
        engine: 'postgres'
      });

      const pricingMySQL = await getRDSPricing({
        region: 'us-east-1',
        instanceType: 'db.t3.micro',
        engine: 'mysql'
      });

      expect(pricingPostgres).toBeDefined();
      expect(pricingMySQL).toBeDefined();
    });
  });

  describe('getElastiCachePricing', () => {
    test('should get ElastiCache pricing', async () => {
      const { getElastiCachePricing } = await import('./pricing-info');

      const pricing = await getElastiCachePricing({
        region: 'us-east-1',
        nodeType: 'cache.t3.micro',
        engine: 'redis'
      });

      expect(pricing).toBeDefined();
      expect(typeof pricing).toBe('object');
    });

    test('should handle different cache engines', async () => {
      const { getElastiCachePricing } = await import('./pricing-info');

      const pricingRedis = await getElastiCachePricing({
        region: 'us-east-1',
        nodeType: 'cache.t3.micro',
        engine: 'redis'
      });

      const pricingMemcached = await getElastiCachePricing({
        region: 'us-east-1',
        nodeType: 'cache.t3.micro',
        engine: 'memcached'
      });

      expect(pricingRedis).toBeDefined();
      expect(pricingMemcached).toBeDefined();
    });
  });

  describe('getS3Pricing', () => {
    test('should get S3 storage pricing', async () => {
      const { getS3Pricing } = await import('./pricing-info');

      const pricing = await getS3Pricing({
        region: 'us-east-1',
        storageClass: 'STANDARD'
      });

      expect(pricing).toBeDefined();
      expect(typeof pricing).toBe('object');
    });

    test('should handle different storage classes', async () => {
      const { getS3Pricing } = await import('./pricing-info');

      const pricingStandard = await getS3Pricing({
        region: 'us-east-1',
        storageClass: 'STANDARD'
      });

      const pricingIA = await getS3Pricing({
        region: 'us-east-1',
        storageClass: 'STANDARD_IA'
      });

      expect(pricingStandard).toBeDefined();
      expect(pricingIA).toBeDefined();
    });
  });

  describe('getDynamoDBPricing', () => {
    test('should get DynamoDB pricing', async () => {
      const { getDynamoDBPricing } = await import('./pricing-info');

      const pricing = await getDynamoDBPricing({
        region: 'us-east-1',
        capacityMode: 'ON_DEMAND'
      });

      expect(pricing).toBeDefined();
      expect(typeof pricing).toBe('object');
    });

    test('should handle provisioned capacity mode', async () => {
      const { getDynamoDBPricing } = await import('./pricing-info');

      const pricingOnDemand = await getDynamoDBPricing({
        region: 'us-east-1',
        capacityMode: 'ON_DEMAND'
      });

      const pricingProvisioned = await getDynamoDBPricing({
        region: 'us-east-1',
        capacityMode: 'PROVISIONED'
      });

      expect(pricingOnDemand).toBeDefined();
      expect(pricingProvisioned).toBeDefined();
    });
  });

  describe('getNATGatewayPricing', () => {
    test('should get NAT Gateway pricing', async () => {
      const { getNATGatewayPricing } = await import('./pricing-info');

      const pricing = await getNATGatewayPricing({
        region: 'us-east-1'
      });

      expect(pricing).toBeDefined();
      expect(typeof pricing).toBe('object');
    });
  });

  describe('getApplicationLoadBalancerPricing', () => {
    test('should get ALB pricing', async () => {
      const { getApplicationLoadBalancerPricing } = await import('./pricing-info');

      const pricing = await getApplicationLoadBalancerPricing({
        region: 'us-east-1'
      });

      expect(pricing).toBeDefined();
      expect(typeof pricing).toBe('object');
    });
  });
});
